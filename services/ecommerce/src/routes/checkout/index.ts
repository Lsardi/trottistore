import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import Stripe from "stripe";
import { z } from "zod";

// --- Zod Schemas ---

const createPaymentIntentSchema = z.object({
  orderId: z.string().uuid().optional(),
  paymentMethod: z.enum(["CARD", "APPLE_PAY", "GOOGLE_PAY", "LINK"]),
  shippingMethod: z.enum(["DELIVERY", "STORE_PICKUP"]).optional().default("DELIVERY"),
});

// --- Types ---

type RequestUser = { userId: string; role: string };

function getRequestUser(request: { user?: unknown }): RequestUser | undefined {
  const user = request.user as Partial<RequestUser> | undefined;
  if (!user) return undefined;
  if (typeof user.userId !== "string" || typeof user.role !== "string") return undefined;
  return { userId: user.userId, role: user.role };
}

// --- Stripe client ---

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// --- Routes ---

export async function checkoutRoutes(app: FastifyInstance) {
  // Register raw body parser for webhook route (Stripe signature requires exact raw body)
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body, done) => {
      // Store raw buffer for webhook signature verification
      done(null, body);
    },
  );

  // Auth required for checkout (except webhook)
  app.addHook("onRequest", async (request, reply) => {
    if (request.url.includes("/checkout/webhook")) return;
    await app.authenticate(request, reply);
  });

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

    const user = getRequestUser(request);
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentification requise" },
      });
    }

    const body = createPaymentIntentSchema.parse(request.body);

    let totalTtc: number;
    let amountCents: number;

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

      if (order.customerId !== user.userId) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Cette commande ne vous appartient pas" },
        });
      }

      totalTtc = Number(order.totalTtc);
      amountCents = Math.round(totalTtc * 100);
    } else {
      // Cart-first flow: calculate from Redis cart
      const cartKey = `cart:${user.userId}`;
      const cartData = await app.redis.get(cartKey);
      if (!cartData) {
        return reply.status(400).send({
          success: false,
          error: { code: "EMPTY_CART", message: "Le panier est vide" },
        });
      }

      const cart = JSON.parse(cartData);
      if (!cart.items || cart.items.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: "EMPTY_CART", message: "Le panier est vide" },
        });
      }

      let totalHt = 0;
      for (const item of cart.items) {
        totalHt += (item.unitPriceHt || 0) * (item.quantity || 1);
      }
      const tvaRate = 0.20;
      const tvaAmount = Math.round(totalHt * tvaRate * 100) / 100;
      // Store pickup = free shipping
      const shippingCost = body.shippingMethod === "STORE_PICKUP" ? 0 : (totalHt >= 100 ? 0 : 6.90);
      totalTtc = totalHt + tvaAmount + shippingCost;
      amountCents = Math.round(totalTtc * 100);
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
        paymentIntent = await createPaymentIntent(stripe, amountCents, user.userId, body.orderId);
      }
    } else {
      paymentIntent = await createPaymentIntent(stripe, amountCents, user.userId);
    }

    return {
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalTtc,
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

    // Update order status
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
      },
    });

    // Decrement stock for each order item
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { variantId: true, quantity: true },
    });

    for (const item of items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }
    }

    // Add status history
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: "PENDING",
        toStatus: "CONFIRMED",
        note: `Paiement Stripe confirme (${pi.id})`,
      },
    });
  });

  app.log.info({ orderId, paymentIntentId: pi.id, amount: pi.amount / 100 }, "Payment confirmed, order updated");
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
