import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import Stripe from "stripe";
import { z } from "zod";
import { checkoutMetrics } from "../../plugins/metrics.js";

/** Transaction client type — PrismaClient minus connection/transaction methods. */
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
const WEBHOOK_CONFIRMABLE_STATUSES = new Set(["PENDING"]);
const WEBHOOK_TERMINAL_STATUSES = new Set(["CANCELLED", "REFUNDED", "DELIVERED"]);
const WEBHOOK_DLQ_INDEX_KEY = "checkout:webhook:dlq:index";
const WEBHOOK_DLQ_TTL_SECONDS = 60 * 60 * 24 * 7;
const WEBHOOK_MAX_RETRIES = 3;
const WEBHOOK_RETRY_BACKOFF_MS = [250, 1000, 3000] as const;

// --- Zod Schemas ---

const createPaymentIntentSchema = z.object({
  orderId: z.string().uuid().optional(),
  paymentMethod: z.enum(["CARD", "APPLE_PAY", "GOOGLE_PAY", "LINK"]),
  shippingMethod: z.enum(["DELIVERY", "STORE_PICKUP"]).optional().default("DELIVERY"),
});

// --- Types ---

type RequestUser = { userId: string; role: string };
type CartItem = { productId: string; variantId?: string | null; quantity: number };
type CartPayload = { items?: CartItem[] };
type StoredWebhookDlqEntry = {
  eventId: string;
  eventType: string;
  attempts: number;
  failedAt: string;
  nextRetryAt: string;
  lastError: string;
  payload: Stripe.Event;
};

function getRequestUser(request: { user?: unknown }): RequestUser | undefined {
  const user = request.user as Partial<RequestUser> | undefined;
  if (!user) return undefined;
  if (typeof user.userId !== "string" || typeof user.role !== "string") return undefined;
  return { userId: user.userId, role: user.role };
}

function getSessionId(request: FastifyRequest): string | undefined {
  const sessionHeader = request.headers["x-session-id"];
  if (typeof sessionHeader === "string") return sessionHeader;
  if (Array.isArray(sessionHeader) && typeof sessionHeader[0] === "string") return sessionHeader[0];
  return request.cookies?.sessionId;
}

function getCartKey(request: FastifyRequest, user?: RequestUser): string {
  if (user?.userId) return `cart:${user.userId}`;
  const sessionId = getSessionId(request);
  if (!sessionId) {
    throw new Error("MISSING_SESSION_ID");
  }
  return `cart:session:${sessionId}`;
}

function isBackofficeRole(role?: string): boolean {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "MANAGER";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryBackoffMs(attempt: number): number {
  return WEBHOOK_RETRY_BACKOFF_MS[Math.max(0, Math.min(attempt - 1, WEBHOOK_RETRY_BACKOFF_MS.length - 1))];
}

// --- Stripe client ---

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// --- Routes ---

export async function checkoutRoutes(app: FastifyInstance) {
  // Register raw body parser for webhook route (Stripe signature requires exact raw body).
  // For non-webhook routes, parse the buffer as JSON so Zod validation works.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (request, body, done) => {
      if (request.url.includes("/checkout/webhook")) {
        // Webhook needs raw buffer for Stripe signature verification
        done(null, body);
      } else {
        // All other routes need parsed JSON
        try {
          const parsed = JSON.parse(body.toString());
          done(null, parsed);
        } catch (err) {
          done(err as Error, undefined);
        }
      }
    },
  );

  // POST /checkout/payment-intent — Create a Stripe PaymentIntent
  app.post("/checkout/payment-intent", async (request, reply) => {
    if (process.env.FEATURE_CHECKOUT_EXPRESS !== "true") {
      return reply.status(503).send({
        success: false,
        error: { code: "FEATURE_DISABLED", message: "Checkout express non active" },
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      return reply.status(503).send({
        success: false,
        error: { code: "STRIPE_NOT_CONFIGURED", message: "Stripe non configure" },
      });
    }

    if (typeof request.headers.authorization === "string") {
      await app.authenticate(request, reply);
      if (reply.sent) return;
    }
    const user = getRequestUser(request);

    const body = createPaymentIntentSchema.parse(request.body);

    let totalTtc: Decimal;
    let amountCents: number;
    let paymentOwnerId = user?.userId ?? "guest";

    if (body.orderId) {
      // Order-first flow: read amount from existing order
      const order = await app.prisma.order.findUnique({
        where: { id: body.orderId },
        select: { totalTtc: true, customerId: true, status: true },
      });

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: { code: "ORDER_NOT_FOUND", message: "Commande introuvable" },
        });
      }

      if (user) {
        if (order.customerId !== user.userId) {
          return reply.status(403).send({
            success: false,
            error: { code: "FORBIDDEN", message: "Cette commande ne vous appartient pas" },
          });
        }
      } else {
        // Guest order: must present the session id that created it.
        const sessionId = getSessionId(request);
        if (!sessionId) {
          return reply.status(400).send({
            success: false,
            error: { code: "MISSING_SESSION_ID", message: "Missing x-session-id header" },
          });
        }
        const linkedSessionId = await app.redis.get(`checkout:guest-order:${body.orderId}`);
        if (!linkedSessionId || linkedSessionId !== sessionId) {
          return reply.status(403).send({
            success: false,
            error: { code: "FORBIDDEN", message: "Cette commande ne vous appartient pas" },
          });
        }
      }

      paymentOwnerId = order.customerId;
      totalTtc = new Decimal(order.totalTtc);
      amountCents = totalTtc.mul(100).round().toNumber();
    } else {
      // Cart-first flow: calculate from Redis cart
      let cartKey: string;
      try {
        cartKey = getCartKey(request, user);
      } catch {
        return reply.status(400).send({
          success: false,
          error: { code: "MISSING_SESSION_ID", message: "Missing x-session-id header" },
        });
      }
      const cartData = await app.redis.get(cartKey);
      if (!cartData) {
        return reply.status(400).send({
          success: false,
          error: { code: "EMPTY_CART", message: "Le panier est vide" },
        });
      }

      const cart = JSON.parse(cartData) as CartPayload;
      if (!cart.items || cart.items.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: "EMPTY_CART", message: "Le panier est vide" },
        });
      }

      const productIds = [...new Set(cart.items.map((i) => i.productId))];
      const variantIds = cart.items
        .map((i) => i.variantId)
        .filter((id): id is string => typeof id === "string");
      const [products, variants] = await Promise.all([
        app.prisma.product.findMany({
          where: { id: { in: productIds }, status: "ACTIVE" },
          select: { id: true, priceHt: true },
        }),
        variantIds.length > 0
          ? app.prisma.productVariant.findMany({
              where: { id: { in: variantIds }, isActive: true },
              select: { id: true, productId: true, priceOverride: true },
            })
          : Promise.resolve([]),
      ]);

      const productMap = new Map(products.map((p) => [p.id, p]));
      const variantMap = new Map(variants.map((v) => [v.id, v]));
      let totalHt = new Decimal(0);
      for (const item of cart.items) {
        const product = productMap.get(item.productId);
        if (!product) continue;
        const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
        const unitPriceHt = new Decimal(
          variant && variant.productId === item.productId && variant.priceOverride != null
            ? variant.priceOverride
            : product.priceHt,
        );
        totalHt = totalHt.add(unitPriceHt.mul(item.quantity || 1));
      }
      const tvaAmount = totalHt.mul(20).div(100);
      // Store pickup = free shipping
      const shippingCost = body.shippingMethod === "STORE_PICKUP"
        ? new Decimal(0)
        : (totalHt.gte(100) ? new Decimal(0) : new Decimal(6.9));
      totalTtc = totalHt.add(tvaAmount).add(shippingCost);
      amountCents = totalTtc.mul(100).round().toNumber();
    }

    if (amountCents < 50) {
      return reply.status(400).send({
        success: false,
        error: { code: "AMOUNT_TOO_LOW", message: "Montant minimum 0.50€" },
      });
    }

    // Create or reuse PaymentIntent
    let paymentIntent: Stripe.PaymentIntent;

    if (body.orderId) {
      // Check for existing PaymentIntent on this order
      const existingPayment = await app.prisma.payment.findFirst({
        where: { orderId: body.orderId, provider: "stripe", status: "PENDING" },
      });

      if (existingPayment?.providerRef) {
        // Reuse existing PaymentIntent (idempotence)
        paymentIntent = await stripe.paymentIntents.retrieve(existingPayment.providerRef);
        if (paymentIntent.amount !== amountCents) {
          paymentIntent = await stripe.paymentIntents.update(existingPayment.providerRef, {
            amount: amountCents,
          });
        }
      } else {
        paymentIntent = await createPaymentIntent(stripe, amountCents, paymentOwnerId, body.orderId);
      }
    } else {
      paymentIntent = await createPaymentIntent(stripe, amountCents, paymentOwnerId);
    }

    return {
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalTtc.toNumber(),
        amountCents,
        currency: "eur",
      },
    };
  });

  // POST /checkout/webhook — Stripe webhook handler
  app.post("/checkout/webhook", async (request: FastifyRequest, reply: FastifyReply) => {
    const stripe = getStripe();
    if (!stripe) {
      return reply.status(503).send({ error: "Stripe not configured" });
    }

    const sig = request.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return reply.status(400).send({ error: "Missing signature or secret" });
    }

    let event: Stripe.Event;
    try {
      // request.body is a raw Buffer thanks to our custom content type parser
      const rawBody = Buffer.isBuffer(request.body)
        ? request.body
        : typeof request.body === "string"
          ? request.body
          : Buffer.from(JSON.stringify(request.body));
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      app.log.error({ err }, "Webhook signature verification failed");
      return reply.status(400).send({ error: "Invalid signature" });
    }

    // Handle events with bounded retries; if all retries fail, move to DLQ.
    try {
      const attempt = await processWebhookEventWithRetry(app, event);
      checkoutMetrics.webhookEvents.inc({ event_type: event.type, result: "success" });
      if (attempt > 1) {
        checkoutMetrics.webhookRetries.inc({ event_type: event.type, result: "success" });
      }
    } catch (err) {
      checkoutMetrics.webhookEvents.inc({ event_type: event.type, result: "error" });
      checkoutMetrics.webhookRetries.inc({ event_type: event.type, result: "failed" });
      await moveWebhookEventToDlq(app, event, err);
      checkoutMetrics.webhookDlq.inc({ event_type: event.type });
      app.log.error({ err, eventType: event.type, eventId: event.id }, "Webhook moved to DLQ after retries");
      // Ack to Stripe once persisted in DLQ to avoid infinite provider retries.
      return reply.status(202).send({ queued: true, eventId: event.id });
    }

    return reply.status(200).send({ received: true });
  });

  app.get("/admin/checkout/webhooks/dlq", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    if (!isBackofficeRole(user?.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Backoffice access required" },
      });
    }

    const entries = await listWebhookDlqEntries(app);
    return {
      success: true,
      data: {
        count: entries.length,
        entries: entries.map((entry) => ({
          eventId: entry.eventId,
          eventType: entry.eventType,
          attempts: entry.attempts,
          failedAt: entry.failedAt,
          nextRetryAt: entry.nextRetryAt,
          lastError: entry.lastError,
        })),
      },
    };
  });

  app.post("/admin/checkout/webhooks/dlq/replay", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    if (!isBackofficeRole(user?.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Backoffice access required" },
      });
    }

    const body = z.object({
      eventId: z.string().min(1).optional(),
      limit: z.number().int().min(1).max(20).default(10),
    }).parse(request.body ?? {});

    const entries = await listWebhookDlqEntries(app);
    const toReplay = body.eventId
      ? entries.filter((entry) => entry.eventId === body.eventId)
      : entries.slice(0, body.limit);

    if (toReplay.length === 0) {
      return {
        success: true,
        data: { replayed: 0, failed: 0, results: [] as Array<Record<string, unknown>> },
      };
    }

    const results: Array<Record<string, unknown>> = [];
    for (const entry of toReplay) {
      try {
        await processWebhookEventWithRetry(app, entry.payload);
        await removeWebhookDlqEntry(app, entry.eventId);
        checkoutMetrics.webhookReplay.inc({ result: "success" });
        results.push({ eventId: entry.eventId, result: "replayed" });
      } catch (err) {
        checkoutMetrics.webhookReplay.inc({ result: "failed" });
        await moveWebhookEventToDlq(app, entry.payload, err, entry.attempts + WEBHOOK_MAX_RETRIES);
        results.push({
          eventId: entry.eventId,
          result: "failed",
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    const replayed = results.filter((r) => r.result === "replayed").length;
    return {
      success: true,
      data: {
        replayed,
        failed: results.length - replayed,
        results,
      },
    };
  });

  // GET /checkout/config — Public Stripe config (publishable key)
  app.get("/checkout/config", async (_request, reply) => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey || process.env.FEATURE_CHECKOUT_EXPRESS !== "true") {
      return reply.status(503).send({
        success: false,
        error: { code: "NOT_AVAILABLE", message: "Checkout express non disponible" },
      });
    }

    return {
      success: true,
      data: {
        publishableKey,
        supportedMethods: ["card", "apple_pay", "google_pay", "link"],
      },
    };
  });
}

// --- Helpers ---

async function createPaymentIntent(
  stripe: Stripe,
  amountCents: number,
  userId: string,
  orderId?: string,
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: "eur",
    payment_method_types: ["card", "link"],
    metadata: {
      userId,
      ...(orderId ? { orderId } : {}),
    },
  });
}

async function processWebhookEvent(app: FastifyInstance, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await handlePaymentSuccess(app, pi);
      return;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await handlePaymentFailure(app, pi);
      return;
    }
    default:
      checkoutMetrics.webhookEvents.inc({ event_type: event.type, result: "ignored" });
      app.log.info({ type: event.type }, "Unhandled Stripe event");
  }
}

async function processWebhookEventWithRetry(
  app: FastifyInstance,
  event: Stripe.Event,
): Promise<number> {
  for (let attempt = 1; attempt <= WEBHOOK_MAX_RETRIES; attempt += 1) {
    try {
      await processWebhookEvent(app, event);
      return attempt;
    } catch (err) {
      if (attempt >= WEBHOOK_MAX_RETRIES) throw err;
      await delay(getRetryBackoffMs(attempt));
    }
  }
  return WEBHOOK_MAX_RETRIES;
}

async function getWebhookDlqIndex(app: FastifyInstance): Promise<string[]> {
  const raw = await app.redis.get(WEBHOOK_DLQ_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

async function setWebhookDlqIndex(app: FastifyInstance, ids: string[]): Promise<void> {
  await app.redis.set(WEBHOOK_DLQ_INDEX_KEY, JSON.stringify(ids), "EX", WEBHOOK_DLQ_TTL_SECONDS);
}

async function listWebhookDlqEntries(app: FastifyInstance): Promise<StoredWebhookDlqEntry[]> {
  const ids = await getWebhookDlqIndex(app);
  const entries = await Promise.all(ids.map(async (eventId) => {
    const raw = await app.redis.get(`${WEBHOOK_DLQ_INDEX_KEY}:${eventId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredWebhookDlqEntry;
    } catch {
      return null;
    }
  }));
  return entries.filter((entry): entry is StoredWebhookDlqEntry => entry !== null);
}

async function moveWebhookEventToDlq(
  app: FastifyInstance,
  event: Stripe.Event,
  error: unknown,
  attempts?: number,
): Promise<void> {
  const eventId = event.id || `evt_${Date.now()}`;
  const key = `${WEBHOOK_DLQ_INDEX_KEY}:${eventId}`;
  const currentRaw = await app.redis.get(key);
  let currentAttempts = 0;
  if (currentRaw) {
    try {
      const parsed = JSON.parse(currentRaw) as StoredWebhookDlqEntry;
      currentAttempts = parsed.attempts;
    } catch {
      currentAttempts = 0;
    }
  }

  const nextAttempts = attempts ?? (currentAttempts + WEBHOOK_MAX_RETRIES);
  const backoffMs = getRetryBackoffMs(Math.max(1, nextAttempts));
  const entry: StoredWebhookDlqEntry = {
    eventId,
    eventType: event.type,
    attempts: nextAttempts,
    failedAt: new Date().toISOString(),
    nextRetryAt: new Date(Date.now() + backoffMs).toISOString(),
    lastError: error instanceof Error ? error.message : "unknown",
    payload: event,
  };
  await app.redis.set(key, JSON.stringify(entry), "EX", WEBHOOK_DLQ_TTL_SECONDS);

  const ids = await getWebhookDlqIndex(app);
  if (!ids.includes(eventId)) {
    ids.push(eventId);
    await setWebhookDlqIndex(app, ids);
  }
}

async function removeWebhookDlqEntry(app: FastifyInstance, eventId: string): Promise<void> {
  await app.redis.del(`${WEBHOOK_DLQ_INDEX_KEY}:${eventId}`);
  const ids = await getWebhookDlqIndex(app);
  await setWebhookDlqIndex(app, ids.filter((id) => id !== eventId));
}

async function handlePaymentSuccess(app: FastifyInstance, pi: Stripe.PaymentIntent): Promise<void> {
  const orderId = pi.metadata.orderId;
  if (!orderId) {
    app.log.warn({ paymentIntentId: pi.id }, "PaymentIntent succeeded but no orderId in metadata");
    return;
  }

  // Idempotence: check if already processed
  const existingPayment = await app.prisma.payment.findFirst({
    where: { providerRef: pi.id, status: "CONFIRMED" },
  });
  if (existingPayment) {
    app.log.info({ paymentIntentId: pi.id }, "Payment already confirmed (idempotent)");
    return;
  }

  await app.prisma.$transaction(async (tx) => {
    // Update or create payment record
    await tx.payment.upsert({
      where: { providerRef: pi.id },
      create: {
        orderId,
        provider: "stripe",
        providerRef: pi.id,
        amount: pi.amount / 100,
        method: pi.payment_method_types?.[0]?.toUpperCase() || "CARD",
        status: "CONFIRMED",
        receivedAt: new Date(),
      },
      update: {
        status: "CONFIRMED",
        receivedAt: new Date(),
      },
    });

    // Item 5 — Only overwrite order status if still PENDING.
    // If admin has already advanced the order (e.g. PREPARING), don't regress it.
    const currentOrder = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true, paymentStatus: true },
    });

    if (currentOrder?.status && WEBHOOK_CONFIRMABLE_STATUSES.has(currentOrder.status)) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMED",
          paymentStatus: "PAID",
        },
      });
    } else if (currentOrder?.status && WEBHOOK_TERMINAL_STATUSES.has(currentOrder.status)) {
      app.log.warn(
        { orderId, currentStatus: currentOrder.status, paymentIntentId: pi.id },
        "Webhook payment success received for terminal order status; skipping status transition",
      );
    } else {
      // Order already advanced past PENDING — just confirm payment status
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PAID" },
      });
      app.log.info(
        { orderId, currentStatus: currentOrder?.status },
        "Webhook: order already past PENDING, only updating paymentStatus",
      );
    }

    // Stock was already decremented (or reserved, for installments) at order creation
    // in routes/orders/index.ts. Decrementing here would cause a double-decrement
    // on every Stripe payment. Webhook only confirms payment + order status.

    // Add status history
    const fromStatus = currentOrder?.status ?? "PENDING";
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus,
        toStatus: currentOrder?.status && WEBHOOK_CONFIRMABLE_STATUSES.has(currentOrder.status)
          ? "CONFIRMED"
          : fromStatus,
        note: `Paiement Stripe confirme (${pi.id})`,
      },
    });

    // Award loyalty points (1 point per EUR spent)
    await awardLoyaltyPoints(tx, orderId, pi.amount / 100, app);
  });

  app.log.info({ orderId, paymentIntentId: pi.id, amount: pi.amount / 100 }, "Payment confirmed, order updated");
}

/**
 * Award loyalty points to the customer after a confirmed purchase.
 * 1 point per EUR spent. Updates the tier based on total points.
 *
 * Tiers: BRONZE (0-499), SILVER (500-1999), GOLD (2000+)
 */
async function awardLoyaltyPoints(
  tx: TransactionClient,
  orderId: string,
  amountEur: number,
  app: FastifyInstance,
): Promise<void> {
  try {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { customerId: true },
    });
    if (!order) return;

    const profile = await tx.customerProfile.findUnique({
      where: { userId: order.customerId },
    });
    if (!profile) return;

    const points = Math.floor(amountEur);
    if (points <= 0) return;

    // Idempotence: don't award twice for the same order (webhook retry protection)
    const alreadyAwarded = await tx.loyaltyPoint.findFirst({
      where: { profileId: profile.id, referenceId: orderId, type: "PURCHASE" },
    });
    if (alreadyAwarded) {
      app.log.info({ orderId }, "Loyalty points already awarded (idempotent skip)");
      return;
    }

    // Award points
    await tx.loyaltyPoint.create({
      data: {
        profileId: profile.id,
        points,
        type: "PURCHASE",
        referenceId: orderId,
        description: `Achat #${orderId.substring(0, 8)} — ${amountEur.toFixed(2)}€`,
      },
    });

    // Update profile totals
    const newPoints = profile.loyaltyPoints + points;
    const newTier = newPoints >= 2000 ? "GOLD" : newPoints >= 500 ? "SILVER" : "BRONZE";

    await tx.customerProfile.update({
      where: { id: profile.id },
      data: {
        loyaltyPoints: newPoints,
        totalOrders: { increment: 1 },
        totalSpent: { increment: amountEur },
        lastOrderAt: new Date(),
        loyaltyTier: newTier,
      },
    });

    app.log.info({ userId: order.customerId, points, newTier }, "Loyalty points awarded");
  } catch (err) {
    // Non-blocking: loyalty errors should not fail the payment
    app.log.error({ err, orderId }, "Failed to award loyalty points");
  }
}

async function handlePaymentFailure(app: FastifyInstance, pi: Stripe.PaymentIntent): Promise<void> {
  const orderId = pi.metadata.orderId;
  if (!orderId) return;

  await app.prisma.payment.updateMany({
    where: { providerRef: pi.id },
    data: { status: "FAILED" },
  });

  app.log.warn({ orderId, paymentIntentId: pi.id, error: pi.last_payment_error?.message }, "Payment failed");
}
