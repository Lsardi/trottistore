/**
 * Integration tests for checkout routes.
 *
 * Covers: payment-intent creation (cart-first, order-first),
 * feature flag gating, Stripe config, validation errors,
 * and edge cases (empty cart, missing session id, order ownership).
 *
 * Note: checkoutRoutes registers a custom content type parser
 * (Buffer for webhook signature verification) and an onRequest
 * auth hook for the authenticated flows; guest flows use x-session-id.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { checkoutRoutes } from "./index.js";

// ---------------------------------------------------------------------------
// Mock Stripe — avoid real API calls
// ---------------------------------------------------------------------------

const mockPaymentIntent = {
  id: "pi_test_123",
  client_secret: "pi_test_123_secret_abc",
  amount: 11988,
  currency: "eur",
  payment_method_types: ["card"],
};
const mockConstructEvent = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class StripeMock {
      paymentIntents = {
        create: vi.fn().mockResolvedValue(mockPaymentIntent),
        retrieve: vi.fn().mockResolvedValue(mockPaymentIntent),
        update: vi.fn().mockResolvedValue(mockPaymentIntent),
      };
      webhooks = {
        constructEvent: mockConstructEvent,
      };
    },
  };
});

// ---------------------------------------------------------------------------
// Test app builder
// ---------------------------------------------------------------------------

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.FEATURE_CHECKOUT_EXPRESS = "true";
  process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_fake";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    order: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
    payment: {
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([{ id: "p1", priceHt: 49.95 }]),
    },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([{ id: "v1", productId: "p1", priceOverride: null }]),
      update: vi.fn().mockResolvedValue(null),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue(null),
    },
    customerProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
    loyaltyPoint: {
      create: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(async (fn: any) => fn(app.prisma)),
  });

  app.decorate("redis", {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    const statusCode = isZodError ? 400 : error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR",
        message: error.message,
      },
    });
  });

  return app;
}

/** Create a JWT token for authenticated requests (matches JwtAccessPayload). */
async function getAuthToken(app: FastifyInstance, userId = "user-1"): Promise<string> {
  return app.jwt.sign({ sub: userId, email: "test@test.com", role: "CLIENT" });
}

/**
 * Inject a POST request to checkout.
 *
 * The checkout scope overrides the JSON content-type parser to return
 * raw Buffers (for webhook signature verification). Using `payload` as
 * an object with inject() sets request.body directly, bypassing the
 * content-type parser — which matches how the routes work in practice
 * since Fastify re-parses Buffer bodies for non-webhook routes.
 */
function injectPost(
  app: FastifyInstance,
  url: string,
  payload: unknown,
  headers: Record<string, string> = {},
) {
  return app.inject({
    method: "POST",
    url,
    headers: { ...headers },
    payload: payload as Record<string, unknown>,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Checkout routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(checkoutRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // GET /checkout/config
  // -----------------------------------------------------------------------

  describe("GET /checkout/config", () => {
    it("returns Stripe publishable key (public endpoint)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/checkout/config",
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.publishableKey).toBe("pk_test_fake");
      expect(json.data.supportedMethods).toContain("card");
    });

    it("also works with authentication header", async () => {
      const token = await getAuthToken(app);
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/checkout/config",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // POST /checkout/payment-intent
  // -----------------------------------------------------------------------

  describe("POST /checkout/payment-intent", () => {
    it("returns 400 without authentication when session id is missing", async () => {
      const res = await injectPost(app, "/api/v1/checkout/payment-intent", {
        paymentMethod: "CARD",
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("MISSING_SESSION_ID");
    });

    it("returns 503 when feature flag is disabled", async () => {
      const original = process.env.FEATURE_CHECKOUT_EXPRESS;
      process.env.FEATURE_CHECKOUT_EXPRESS = "false";
      const token = await getAuthToken(app);

      const res = await injectPost(
        app,
        "/api/v1/checkout/payment-intent",
        { paymentMethod: "CARD" },
        { authorization: `Bearer ${token}` },
      );
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe("FEATURE_DISABLED");

      process.env.FEATURE_CHECKOUT_EXPRESS = original;
    });

    it("returns 400 when cart is empty (cart-first flow)", async () => {
      const token = await getAuthToken(app);

      const res = await injectPost(
        app,
        "/api/v1/checkout/payment-intent",
        { paymentMethod: "CARD" },
        { authorization: `Bearer ${token}` },
      );
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("EMPTY_CART");
    });

    it("creates PaymentIntent from cart (cart-first flow)", async () => {
      const token = await getAuthToken(app);
      const cart = {
        items: [
          { productId: "p1", variantId: "v1", quantity: 2, unitPriceHt: 49.95 },
        ],
      };
      (app.redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(cart));

      const res = await injectPost(
        app,
        "/api/v1/checkout/payment-intent",
        { paymentMethod: "CARD" },
        { authorization: `Bearer ${token}` },
      );

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.clientSecret).toBe("pi_test_123_secret_abc");
      expect(json.data.currency).toBe("eur");
    });

    it("creates PaymentIntent from existing order (order-first flow)", async () => {
      const token = await getAuthToken(app);

      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        totalTtc: 119.88,
        customerId: "user-1",
        status: "PENDING",
      });

      const res = await injectPost(
        app,
        "/api/v1/checkout/payment-intent",
        { paymentMethod: "CARD", orderId: "00000000-0000-0000-0000-000000000001" },
        { authorization: `Bearer ${token}` },
      );

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("returns 403 when order belongs to another user", async () => {
      const token = await getAuthToken(app, "user-1");

      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        totalTtc: 119.88,
        customerId: "user-999",
        status: "PENDING",
      });

      const res = await injectPost(
        app,
        "/api/v1/checkout/payment-intent",
        { paymentMethod: "CARD", orderId: "00000000-0000-0000-0000-000000000001" },
        { authorization: `Bearer ${token}` },
      );

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
    });

    it("returns 404 when order does not exist", async () => {
      const token = await getAuthToken(app);

      const res = await injectPost(
        app,
        "/api/v1/checkout/payment-intent",
        { paymentMethod: "CARD", orderId: "00000000-0000-0000-0000-000000000099" },
        { authorization: `Bearer ${token}` },
      );

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("ORDER_NOT_FOUND");
    });

    it("returns 403 for guest when orderId is not linked to current session", async () => {
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        totalTtc: 119.88,
        customerId: "guest-user-1",
        status: "PENDING",
      });
      (app.redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce("other-session");

      const res = await injectPost(
        app,
        "/api/v1/checkout/payment-intent",
        { paymentMethod: "CARD", orderId: "00000000-0000-0000-0000-000000000001" },
        { "x-session-id": "guest-session-1" },
      );

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
    });

    it("creates PaymentIntent for guest when orderId is linked to current session", async () => {
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        totalTtc: 119.88,
        customerId: "guest-user-1",
        status: "PENDING",
      });
      (app.redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce("guest-session-1");

      const res = await injectPost(
        app,
        "/api/v1/checkout/payment-intent",
        { paymentMethod: "CARD", orderId: "00000000-0000-0000-0000-000000000001" },
        { "x-session-id": "guest-session-1" },
      );

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("applies free shipping for store pickup", async () => {
      const token = await getAuthToken(app);
      const cart = {
        items: [
          { productId: "p1", variantId: "v1", quantity: 1, unitPriceHt: 50 },
        ],
      };
      (app.redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(cart));
      (app.prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ id: "p1", priceHt: 50 }]);

      const res = await injectPost(
        app,
        "/api/v1/checkout/payment-intent",
        { paymentMethod: "CARD", shippingMethod: "STORE_PICKUP" },
        { authorization: `Bearer ${token}` },
      );

      expect(res.statusCode).toBe(200);
      const json = res.json();
      // 50 HT + 10 TVA + 0 shipping = 60 TTC
      expect(json.data.amount).toBe(60);
    });
  });

  // -----------------------------------------------------------------------
  // POST /checkout/webhook
  // -----------------------------------------------------------------------

  describe("POST /checkout/webhook", () => {
    it("returns 400 without stripe-signature header", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

      const res = await injectPost(app, "/api/v1/checkout/webhook", {
        type: "payment_intent.succeeded",
      });
      expect(res.statusCode).toBe(400);

      delete process.env.STRIPE_WEBHOOK_SECRET;
    });

    it("returns 400 without webhook secret configured", async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/webhook",
        headers: {
          "stripe-signature": "t=123,v1=abc",
          "content-type": "application/json",
        },
        payload: JSON.stringify({ type: "payment_intent.succeeded" }),
      });
      expect(res.statusCode).toBe(400);
    });

    it("does not regress terminal order status on payment_intent.succeeded", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ status: "CANCELLED", paymentStatus: "PENDING" })
        .mockResolvedValueOnce(null);
      mockConstructEvent.mockReturnValueOnce({
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_terminal_1",
            amount: 1200,
            payment_method_types: ["card"],
            metadata: { orderId: "00000000-0000-0000-0000-000000000010" },
          },
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/webhook",
        headers: {
          "stripe-signature": "t=123,v1=abc",
          "content-type": "application/json",
        },
        payload: JSON.stringify({ id: "evt_1" }),
      });

      expect(res.statusCode).toBe(200);
      expect(app.prisma.order.update).not.toHaveBeenCalled();
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });
  });
});
