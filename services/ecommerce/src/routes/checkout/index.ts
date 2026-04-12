import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import Stripe from "stripe";
import { z } from "zod";

/** Transaction client type — PrismaClient minus connection/transaction methods. */
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

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

    // Handle events — wrap in try/catch so Stripe retries on failure
    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const pi = event.data.object as Stripe.PaymentIntent;
          await handlePaymentSuccess(app, pi);
          break;
        }
        case "payment_intent.payment_failed": {
          const pi = event.data.object as Stripe.PaymentIntent;
          await handlePaymentFailure(app, pi);
          break;
        }
        default:
          app.log.info({ type: event.type }, "Unhandled Stripe event");
      }
    } catch (err) {
      app.log.error({ err, eventType: event.type }, "Webhook handler failed");
      return reply.status(500).send({ error: "Webhook processing failed" });
    }

    return reply.status(200).send({ received: true });
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
      select: { status: true },
    });

    if (currentOrder?.status === "PENDING") {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMED",
          paymentStatus: "PAID",
        },
      });
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
        toStatus: currentOrder?.status === "PENDING" ? "CONFIRMED" : fromStatus,
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
