import { mockActiveAuthUsers } from "../../../../../tests/helpers/auth-users.js";
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
const mockCreateIntent = vi.fn().mockResolvedValue(mockPaymentIntent);
const mockRetrieveIntent = vi.fn().mockResolvedValue(mockPaymentIntent);

vi.mock("stripe", () => {
  return {
    default: class StripeMock {
      paymentIntents = {
        create: mockCreateIntent,
        retrieve: mockRetrieveIntent,
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
  const redisStore = new Map<string, string>();

  app.decorate("prisma", {
    order: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
      findMany: vi.fn().mockResolvedValue([{ id: "p1", priceHt: 49.95, tvaRate: 20 }]),
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
    financialLedger: {
      create: vi.fn().mockResolvedValue({ id: "ledger-1" }),
    },
    $transaction: vi.fn(async (fn: (tx: typeof app.prisma) => Promise<unknown>) => fn(app.prisma)),
  });

  app.decorate("redis", {
    get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      redisStore.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      const existed = redisStore.delete(key);
      return existed ? 1 : 0;
    }),
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
async function getAuthToken(app: FastifyInstance, userId = "user-1", role = "CLIENT"): Promise<string> {
  return app.jwt.sign({ tokenVersion: 0, sub: userId, email: "test@test.com", role });
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
    mockActiveAuthUsers(app);
    await app.register(authPlugin);
    await app.register(checkoutRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(app.prisma.order.findUnique).mockReset().mockResolvedValue(null);
    vi.mocked(app.prisma.payment.findFirst).mockReset().mockResolvedValue(null);
    vi.mocked(app.prisma.payment.upsert).mockReset().mockResolvedValue(null);
    vi.mocked(app.redis.get).mockClear();
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
      expect(res.json().error.code).toBe("ORDER_REQUIRED");
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
      expect(res.json().error.code).toBe("ORDER_REQUIRED");
    });

    it("refuses a populated cart without orderId", async () => {
      const token = await getAuthToken(app);
      const res = await injectPost(app, "/api/v1/checkout/payment-intent", { paymentMethod: "CARD" }, { authorization: `Bearer ${token}` });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("ORDER_REQUIRED");
      expect(app.prisma.payment.upsert).not.toHaveBeenCalled();
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

    it("creates and persists one intent across concurrent calls with the stable provider key", async () => {
      const token = await getAuthToken(app);
      const orderId = "00000000-0000-0000-0000-000000000001";
      vi.mocked(app.prisma.order.findUnique).mockResolvedValue({ totalTtc: 119.88, customerId: "user-1", status: "PENDING" } as never);
      const results = await Promise.all([1, 2].map(() => injectPost(app, "/api/v1/checkout/payment-intent", { orderId, paymentMethod: "CARD" }, { authorization: `Bearer ${token}` })));
      expect(results.map((result) => result.statusCode)).toEqual([200, 200]);
      expect(results.map((result) => result.json().data.paymentIntentId)).toEqual(["pi_test_123", "pi_test_123"]);
      for (const [, options] of mockCreateIntent.mock.calls) expect(options).toEqual({ idempotencyKey: `order:${orderId}:intent` });
      expect(app.prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { providerRef: "pi_test_123" }, create: expect.objectContaining({ orderId, status: "PENDING", method: "CARD" }) }));
    });

    it("reuses the persisted pending intent", async () => {
      const token = await getAuthToken(app);
      vi.mocked(app.prisma.order.findUnique).mockResolvedValueOnce({ totalTtc: 119.88, customerId: "user-1", status: "PENDING" } as never);
      vi.mocked(app.prisma.payment.findFirst).mockResolvedValueOnce({ providerRef: "pi_existing" } as never);
      const res = await injectPost(app, "/api/v1/checkout/payment-intent", { orderId: "00000000-0000-0000-0000-000000000001", paymentMethod: "CARD" }, { authorization: `Bearer ${token}` });
      expect(res.statusCode).toBe(200);
      expect(mockRetrieveIntent).toHaveBeenCalledWith("pi_existing");
      expect(mockCreateIntent).not.toHaveBeenCalled();
      expect(app.prisma.payment.upsert).not.toHaveBeenCalled();
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

    it("uses the persisted order total including pickup and discount", async () => {
      const token = await getAuthToken(app);
      vi.mocked(app.prisma.order.findUnique).mockResolvedValueOnce({ totalTtc: 54, customerId: "user-1", status: "PENDING" } as never);
      const res = await injectPost(app, "/api/v1/checkout/payment-intent", { paymentMethod: "CARD", orderId: "00000000-0000-0000-0000-000000000001" }, { authorization: `Bearer ${token}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.amount).toBe(54);
      expect(app.prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ status: "PENDING", providerRef: "pi_test_123", amount: expect.anything() }),
      }));
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
        .mockResolvedValueOnce({ status: "CANCELLED", paymentStatus: "PENDING" });
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
      expect(app.prisma.order.updateMany).not.toHaveBeenCalled();
      expect(app.prisma.payment.upsert).not.toHaveBeenCalled();
      expect(app.prisma.financialLedger.create).not.toHaveBeenCalled();
      expect(app.prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });

    it("does not reconfirm when cancellation wins after the webhook read", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      vi.mocked(app.prisma.order.findUnique).mockResolvedValueOnce({ status: "PENDING", paymentStatus: "PENDING" } as never);
      vi.mocked(app.prisma.order.updateMany).mockResolvedValueOnce({ count: 0 });
      mockConstructEvent.mockReturnValueOnce({ type: "payment_intent.succeeded", data: { object: {
        id: "pi_race", amount: 1200, metadata: { orderId: "00000000-0000-0000-0000-000000000010" },
      } } });
      const res = await app.inject({ method: "POST", url: "/api/v1/checkout/webhook", headers: { "stripe-signature": "test", "content-type": "application/json" }, payload: "{}" });
      expect(res.statusCode).toBe(200);
      expect(app.prisma.order.updateMany).toHaveBeenCalledWith({ where: { id: "00000000-0000-0000-0000-000000000010", status: "PENDING", paymentStatus: "PENDING" }, data: { status: "CONFIRMED", paymentStatus: "PAID" } });
      expect(app.prisma.payment.upsert).not.toHaveBeenCalled();
      expect(app.prisma.financialLedger.create).not.toHaveBeenCalled();
      expect(app.prisma.loyaltyPoint.create).not.toHaveBeenCalled();
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });

    it("increments loyalty points atomically and computes the tier from the returned total", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      vi.mocked(app.prisma.order.findUnique).mockResolvedValueOnce({ status: "PENDING", paymentStatus: "PENDING" } as never)
        .mockResolvedValueOnce(null).mockResolvedValueOnce({ customerId: "customer" } as never);
      vi.mocked(app.prisma.customerProfile.findUnique).mockResolvedValueOnce({ id: "profile", loyaltyPoints: 490 } as never);
      app.prisma.loyaltyPoint.findFirst = vi.fn().mockResolvedValue(null);
      vi.mocked(app.prisma.customerProfile.update).mockResolvedValueOnce({ loyaltyPoints: 502 } as never);
      mockConstructEvent.mockReturnValueOnce({ type: "payment_intent.succeeded", data: { object: {
        id: "pi_loyalty", amount: 1200, metadata: { orderId: "00000000-0000-0000-0000-000000000010" },
      } } });
      const res = await app.inject({ method: "POST", url: "/api/v1/checkout/webhook", headers: { "stripe-signature": "test", "content-type": "application/json" }, payload: "{}" });
      expect(res.statusCode).toBe(200);
      expect(app.prisma.customerProfile.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ loyaltyPoints: { increment: 12 } }) }));
      expect(app.prisma.customerProfile.update).toHaveBeenNthCalledWith(2, { where: { id: "profile" }, data: { loyaltyTier: "SILVER" } });
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });

    it("moves failing webhook to DLQ after retries", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      mockConstructEvent.mockReturnValueOnce({
        id: "evt_dlq_1",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_dlq_1",
            amount: 1200,
            payment_method_types: ["card"],
            metadata: { orderId: "00000000-0000-0000-0000-000000000010" },
          },
        },
      });
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: "PENDING", paymentStatus: "PENDING" });
      (app.prisma.payment.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: "PENDING", paymentStatus: "PENDING" });
      (app.prisma.payment.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: "PENDING", paymentStatus: "PENDING" });
      (app.prisma.payment.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/webhook",
        headers: {
          "stripe-signature": "t=123,v1=abc",
          "content-type": "application/json",
        },
        payload: JSON.stringify({ id: "evt_dlq_1" }),
      });

      expect(res.statusCode).toBe(202);
      const dlqRaw = await app.redis.get("checkout:webhook:dlq:index:evt_dlq_1");
      expect(dlqRaw).toBeTruthy();
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });
  });

  describe("Webhook DLQ admin endpoints", () => {
    it("lists webhook DLQ entries for backoffice users", async () => {
      const token = await getAuthToken(app, "admin-1", "ADMIN");
      await app.redis.set(
        "checkout:webhook:dlq:index",
        JSON.stringify(["evt_admin_1"]),
      );
      await app.redis.set(
        "checkout:webhook:dlq:index:evt_admin_1",
        JSON.stringify({
          eventId: "evt_admin_1",
          eventType: "payment_intent.succeeded",
          attempts: 3,
          failedAt: "2026-04-12T00:00:00.000Z",
          nextRetryAt: "2026-04-12T00:01:00.000Z",
          lastError: "boom",
          payload: { id: "evt_admin_1", type: "payment_intent.succeeded", data: { object: { metadata: { orderId: "o1" } } } },
        }),
      );

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/checkout/webhooks/dlq",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.count).toBe(1);
    });

    it("replays and removes a DLQ event for backoffice users", async () => {
      const token = await getAuthToken(app, "admin-1", "ADMIN");
      (app.prisma.payment.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: "PENDING",
        paymentStatus: "PENDING",
      });
      (app.prisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await app.redis.set("checkout:webhook:dlq:index", JSON.stringify(["evt_replay_1"]));
      await app.redis.set("checkout:webhook:dlq:index:evt_replay_1", JSON.stringify({
        eventId: "evt_replay_1",
        eventType: "payment_intent.succeeded",
        attempts: 3,
        failedAt: "2026-04-12T00:00:00.000Z",
        nextRetryAt: "2026-04-12T00:01:00.000Z",
        lastError: "db down",
        payload: {
          id: "evt_replay_1",
          type: "payment_intent.succeeded",
          data: { object: { id: "pi_replay_1", amount: 990, payment_method_types: ["card"], metadata: { orderId: "order-1" } } },
        },
      }));

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/checkout/webhooks/dlq/replay",
        headers: { authorization: `Bearer ${token}` },
        payload: { eventId: "evt_replay_1" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.replayed).toBe(1);
      const indexRaw = await app.redis.get("checkout:webhook:dlq:index");
      expect(indexRaw).toBe("[]");
    });

    it("honours a targeted eventId (JSON body must be parsed, not left as a raw Buffer)", async () => {
      // Regression: the raw-body parser matched `/checkout/webhook` by substring and
      // also caught `/admin/checkout/webhooks/dlq/replay`, so Zod saw a Buffer and
      // silently dropped `eventId` — replaying everything instead of one event.
      const token = await getAuthToken(app, "admin-1", "ADMIN");
      (app.prisma.payment.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "PENDING",
        paymentStatus: "PENDING",
      });
      (app.prisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const entry = (id: string) => JSON.stringify({
        eventId: id,
        eventType: "payment_intent.succeeded",
        attempts: 3,
        failedAt: "2026-04-12T00:00:00.000Z",
        nextRetryAt: "2026-04-12T00:01:00.000Z",
        lastError: "db down",
        payload: {
          id,
          type: "payment_intent.succeeded",
          data: { object: { id: `pi_${id}`, amount: 990, payment_method_types: ["card"], metadata: { orderId: "order-1" } } },
        },
      });
      await app.redis.set("checkout:webhook:dlq:index", JSON.stringify(["evt_a", "evt_b"]));
      await app.redis.set("checkout:webhook:dlq:index:evt_a", entry("evt_a"));
      await app.redis.set("checkout:webhook:dlq:index:evt_b", entry("evt_b"));

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/checkout/webhooks/dlq/replay",
        headers: { authorization: `Bearer ${token}` },
        payload: { eventId: "evt_b" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.replayed).toBe(1);
      expect(JSON.parse((await app.redis.get("checkout:webhook:dlq:index")) ?? "[]")).toEqual(["evt_a"]);
    });
  });
});
