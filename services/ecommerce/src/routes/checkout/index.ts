import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import Stripe from "stripe";
import { z } from "zod";
import { getRequestCorrelation, mergeRequestCorrelation, type RequestCorrelation } from "@trottistore/shared";
import { sendEmail } from "@trottistore/shared/notifications";
import { invoiceEmail } from "../../emails/templates.js";
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

  // CL-01: Warn loudly if test key is used in production.
  // Currently NOT blocking because the prod env doubles as dev.
  // Switch to `return null` here when going live with real customers.
  if (process.env.NODE_ENV === "production" && key.startsWith("sk_test_")) {
    console.warn(
      "[CL-01] STRIPE_SECRET_KEY is a test key (sk_test_...) in production. " +
      "Checkout works but cannot charge real cards. Rotate to sk_live_... before go-live.",
    );
  }

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
      // Exact path match: `includes()` also caught /admin/checkout/webhooks/dlq/replay
      // and left its JSON body as a Buffer, breaking Zod validation on the replay route.
      const path = request.url.split("?")[0];
      if (path.endsWith("/checkout/webhook")) {
        // Webhook needs raw buffer for Stripe signature verification
        done(null, body);
      } else {
        // All other routes need parsed JSON
        try {
          const str = body.toString().trim();
          const parsed = str ? JSON.parse(str) : {};
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

    if (!body.orderId) {
      return reply.status(400).send({ success: false, error: { code: "ORDER_REQUIRED", message: "Une commande est obligatoire" } });
    }
    let totalTtc: Decimal;
    let amountCents: number;
    let paymentOwnerId = user?.userId ?? "guest";

    {
      // Order-first flow: read amount from existing order
      const order = await app.prisma.order.findUnique({
        where: { id: body.orderId },
        select: { totalTtc: true, customerId: true, status: true, paymentStatus: true },
      });

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: { code: "ORDER_NOT_FOUND", message: "Commande introuvable" },
        });
      }

      // F2: Block payment intent creation for non-payable orders
      const PAYABLE_STATUSES = new Set(["PENDING"]);
      if (!PAYABLE_STATUSES.has(order.status) || order.paymentStatus === "PAID") {
        return reply.status(400).send({
          success: false,
          error: { code: "ORDER_NOT_PAYABLE", message: `Commande en statut ${order.status}, paiement impossible` },
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
    }

    if (amountCents < 50) {
      return reply.status(400).send({
        success: false,
        error: { code: "AMOUNT_TOO_LOW", message: "Montant minimum 0.50€" },
      });
    }

    // Create or reuse PaymentIntent
    let paymentIntent: Stripe.PaymentIntent;

    {
      // Check for existing PaymentIntent on this order
      const existingPayment = await app.prisma.payment.findFirst({
        where: { orderId: body.orderId, provider: "stripe", method: { not: "REFUND" }, status: { in: ["PENDING", "FAILED"] } },
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
        await app.prisma.payment.upsert({
          where: { providerRef: paymentIntent.id },
          create: { orderId: body.orderId, provider: "stripe", providerRef: paymentIntent.id,
            amount: totalTtc, method: body.paymentMethod, status: "PENDING" },
          update: {},
        });
      }
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
    const correlation = getRequestCorrelation(request);
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
      app.log.error({ err, ...correlation }, "Webhook signature verification failed");
      return reply.status(400).send({ error: "Invalid signature" });
    }

    // Handle events with bounded retries; if all retries fail, move to DLQ.
    try {
      const attempt = await processWebhookEventWithRetry(app, event, correlation);
      checkoutMetrics.webhookEvents.inc({ event_type: event.type, result: "success" });
      if (attempt > 1) {
        checkoutMetrics.webhookRetries.inc({ event_type: event.type, result: "success" });
      }
    } catch (err) {
      checkoutMetrics.webhookEvents.inc({ event_type: event.type, result: "error" });
      checkoutMetrics.webhookRetries.inc({ event_type: event.type, result: "failed" });
      await moveWebhookEventToDlq(app, event, err);
      checkoutMetrics.webhookDlq.inc({ event_type: event.type });
      app.log.error({ err, ...correlation, eventType: event.type, eventId: event.id }, "Webhook moved to DLQ after retries");
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
        await processWebhookEventWithRetry(
          app,
          entry.payload,
          mergeRequestCorrelation(getRequestCorrelation(request), {
            order_id: entry.payload.type.includes("payment_intent")
              ? (entry.payload.data.object as Stripe.PaymentIntent).metadata.orderId
              : undefined,
            payment_intent_id: entry.payload.type.includes("payment_intent")
              ? (entry.payload.data.object as Stripe.PaymentIntent).id
              : undefined,
          }),
        );
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
  orderId: string,
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: "eur",
    payment_method_types: ["card", "link"],
    metadata: {
      userId,
      orderId,
    },
  }, { idempotencyKey: `order:${orderId}:intent` });
}

async function processWebhookEvent(
  app: FastifyInstance,
  event: Stripe.Event,
  correlation: RequestCorrelation,
): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await handlePaymentSuccess(
        app,
        pi,
        mergeRequestCorrelation(correlation, {
          payment_intent_id: pi.id,
          order_id: pi.metadata.orderId,
        }),
      );
      return;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await handlePaymentFailure(
        app,
        pi,
        mergeRequestCorrelation(correlation, {
          payment_intent_id: pi.id,
          order_id: pi.metadata.orderId,
        }),
      );
      return;
    }
    default:
      checkoutMetrics.webhookEvents.inc({ event_type: event.type, result: "ignored" });
      app.log.info({ ...correlation, type: event.type }, "Unhandled Stripe event");
  }
}

async function processWebhookEventWithRetry(
  app: FastifyInstance,
  event: Stripe.Event,
  correlation: RequestCorrelation,
): Promise<number> {
  for (let attempt = 1; attempt <= WEBHOOK_MAX_RETRIES; attempt += 1) {
    try {
      await processWebhookEvent(app, event, correlation);
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

async function handlePaymentSuccess(
  app: FastifyInstance,
  pi: Stripe.PaymentIntent,
  correlation: RequestCorrelation,
): Promise<void> {
  const orderId = pi.metadata.orderId;
  if (!orderId) {
    app.log.warn(
      { ...mergeRequestCorrelation(correlation, { payment_intent_id: pi.id }) },
      "PaymentIntent succeeded but no orderId in metadata",
    );
    return;
  }

  // Idempotence: check if already processed
  const existingPayment = await app.prisma.payment.findFirst({
    where: { providerRef: pi.id, status: "CONFIRMED" },
  });
  if (existingPayment) {
    app.log.info({ ...correlation }, "Payment already confirmed (idempotent)");
    return;
  }

  const processed = await app.prisma.$transaction(async (tx) => {
    const currentOrder = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, paymentStatus: true } });
    if (!currentOrder || WEBHOOK_TERMINAL_STATUSES.has(currentOrder.status) || currentOrder.paymentStatus === "PAID") return false;
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: currentOrder.status, paymentStatus: currentOrder.paymentStatus },
      data: { ...(WEBHOOK_CONFIRMABLE_STATUSES.has(currentOrder.status) ? { status: "CONFIRMED" } : {}), paymentStatus: "PAID" },
    });
    if (claimed.count !== 1) return false;
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

    try {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { orderNumber: true },
      });
      if (order) {
        await tx.financialLedger.create({
          data: {
            orderId,
            orderNumber: order.orderNumber,
            operation: "CHARGE",
            amountCents: pi.amount,
            currency: "EUR",
            provider: "stripe",
            providerRef: pi.id,
            reason: "Stripe payment confirmed",
            metadata: { paymentIntentId: pi.id, source: "webhook" },
          },
        });
        checkoutMetrics.ledgerEntries.inc({ operation: "CHARGE" });
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== "P2002") {
        throw err;
      }
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
    return true;
  });
  if (!processed) return;

  app.log.info({ ...correlation, amount: pi.amount / 100 }, "Payment confirmed, order updated");

  // CL-08: Auto-send invoice email after payment confirmation (CGI art. 289-VII)
  try {
    const orderForInvoice = await app.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        totalTtc: true,
        customer: { select: { email: true, firstName: true } },
      },
    });

    if (orderForInvoice?.customer?.email) {
      // Create invoice record (idempotent upsert — same as buildInvoicePdf)
      const invoice = await app.prisma.invoice.upsert({
        where: { orderId },
        create: {
          orderId,
          orderNumber: orderForInvoice.orderNumber,
          totalTtc: orderForInvoice.totalTtc,
        },
        update: {},
      });

      const year = new Date(invoice.issuedAt).getFullYear();
      const invoiceRef = `FAC-${year}-${String(invoice.invoiceNumber).padStart(6, "0")}`;
      const baseUrl = process.env.BASE_URL || "https://trottistore.fr";

      const { subject, html } = invoiceEmail({
        orderNumber: orderForInvoice.orderNumber,
        invoiceRef,
        customerName: orderForInvoice.customer.firstName || "Client",
        totalTtc: Number(orderForInvoice.totalTtc).toFixed(2),
        invoiceUrl: `${baseUrl}/mon-compte`,
      });

      sendEmail(orderForInvoice.customer.email, subject, html).catch((err: unknown) =>
        app.log.error({ err, orderId }, "Failed to send invoice email"),
      );

      app.log.info({ orderId, invoiceRef }, "Invoice email queued");
    }
  } catch (err) {
    // Invoice email is important but must not break the payment flow
    app.log.error({ err, orderId }, "Invoice email generation failed");
  }
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
    const incremented = await tx.customerProfile.update({
      where: { id: profile.id },
      data: {
        loyaltyPoints: { increment: points },
        totalOrders: { increment: 1 },
        totalSpent: { increment: amountEur },
        lastOrderAt: new Date(),
      },
    });

    const newTier = incremented.loyaltyPoints >= 2000 ? "GOLD" : incremented.loyaltyPoints >= 500 ? "SILVER" : "BRONZE";
    await tx.customerProfile.update({ where: { id: profile.id }, data: { loyaltyTier: newTier } });
    app.log.info({ userId: order.customerId, points, newTier }, "Loyalty points awarded");
  } catch (err) {
    // Non-blocking: loyalty errors should not fail the payment
    app.log.error({ err, orderId }, "Failed to award loyalty points");
  }
}

async function handlePaymentFailure(
  app: FastifyInstance,
  pi: Stripe.PaymentIntent,
  correlation: RequestCorrelation,
): Promise<void> {
  const orderId = pi.metadata.orderId;
  if (!orderId) return;

  await app.prisma.payment.updateMany({
    where: { providerRef: pi.id, status: "PENDING" },
    data: { status: "FAILED" },
  });

  app.log.warn(
    {
      ...mergeRequestCorrelation(correlation, { order_id: orderId, payment_intent_id: pi.id }),
      error: pi.last_payment_error?.message,
    },
    "Payment failed",
  );
}
