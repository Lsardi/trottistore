/**
 * Integration tests for admin order actions: refund, notes, manual order.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { Decimal } from "@prisma/client/runtime/library";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { orderRoutes } from "./index.js";

vi.mock("@trottistore/shared/notifications", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    refunds = { create: vi.fn().mockResolvedValue({ id: "re_test_123" }) };
  },
}));

const USER_ID = "00000000-0000-0000-0000-000000000001";
const ORDER_ID = "00000000-0000-0000-0000-000000000050";
const PRODUCT_ID = "00000000-0000-0000-0000-000000000020";
const VARIANT_ID = "00000000-0000-0000-0000-000000000030";
const CUSTOMER_ID = "00000000-0000-0000-0000-000000000060";

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    order: {
      findUnique: vi.fn().mockResolvedValue({
        id: ORDER_ID,
        orderNumber: 1042,
        status: "CONFIRMED",
        totalTtc: new Decimal(478.8),
        paymentMethod: "CARD",
        customerId: CUSTOMER_ID,
        payments: [{ providerRef: "pi_test_1", status: "CONFIRMED", provider: "stripe" }],
        items: [{ variantId: VARIANT_ID, quantity: 1 }],
      }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: ORDER_ID, orderNumber: 1043, items: [] }),
      update: vi.fn().mockResolvedValue(null),
    },
    payment: {
      create: vi.fn().mockResolvedValue(null),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue({ id: "note-1" }),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([{
        id: VARIANT_ID,
        productId: PRODUCT_ID,
        priceOverride: null,
        stockQuantity: 10,
        stockReserved: 0,
        isActive: true,
      }]),
      update: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([{
        id: PRODUCT_ID,
        priceHt: new Decimal(399),
        tvaRate: new Decimal(20),
        status: "ACTIVE",
      }]),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: CUSTOMER_ID, status: "ACTIVE" }),
    },
    address: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    payment: {
      findFirst: vi.fn().mockResolvedValue(null), // No existing refund
      create: vi.fn().mockResolvedValue(null),
    },
    paymentInstallment: {
      create: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === "function") return arg(app.prisma);
      return Promise.all(arg);
    }),
  });

  app.decorate("redis", {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    reply.status(isZodError ? 400 : error.statusCode || 500).send({
      success: false,
      error: { code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR", message: error.message },
    });
  });

  return app;
}

async function signToken(app: FastifyInstance, role = "ADMIN"): Promise<string> {
  return app.jwt.sign({ sub: USER_ID, email: "admin@test.com", role });
}

describe("Admin order actions", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(orderRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  // Refund
  describe("POST /admin/orders/:id/refund", () => {
    it("processes a full refund", async () => {
      const token = await signToken(app);
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/orders/${ORDER_ID}/refund`,
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: "Client insatisfait" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.isFullRefund).toBe(true);
      expect(res.json().data.stripeRefundId).toBe("re_test_123");
    });

    it("returns 404 for unknown order", async () => {
      const token = await signToken(app);
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/orders/${ORDER_ID}/refund`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(res.statusCode).toBe(404);
    });

    it("rejects already refunded order", async () => {
      const token = await signToken(app);
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ORDER_ID,
        status: "REFUNDED",
        totalTtc: new Decimal(478.8),
        paymentMethod: "CARD",
        payments: [],
        items: [],
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/orders/${ORDER_ID}/refund`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("ALREADY_REFUNDED");
    });

    it("returns 403 for CLIENT role", async () => {
      const token = await signToken(app, "CLIENT");
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/orders/${ORDER_ID}/refund`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // Notes
  describe("POST /admin/orders/:id/notes", () => {
    it("adds internal note", async () => {
      const token = await signToken(app);
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ORDER_ID,
        status: "CONFIRMED",
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/orders/${ORDER_ID}/notes`,
        headers: { authorization: `Bearer ${token}` },
        payload: { note: "Client rappelé pour confirmer la livraison" },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // Status update
  describe("PUT /admin/orders/:id/status", () => {
    it("transitions an order to CONFIRMED for ADMIN role", async () => {
      const token = await signToken(app);
      (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ORDER_ID,
        status: "PENDING",
      });
      (app.prisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: ORDER_ID,
        status: "CONFIRMED",
        paymentMethod: "CARD",
      });

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/admin/orders/${ORDER_ID}/status`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "CONFIRMED", note: "Paiement confirmé" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("returns 403 for CLIENT role", async () => {
      const token = await signToken(app, "CLIENT");
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/admin/orders/${ORDER_ID}/status`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "CONFIRMED" },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
    });

    it("returns 403 for STAFF role (STAFF is not backoffice)", async () => {
      const token = await signToken(app, "STAFF");
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/admin/orders/${ORDER_ID}/status`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "CONFIRMED" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 403 for TECHNICIAN role", async () => {
      const token = await signToken(app, "TECHNICIAN");
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/admin/orders/${ORDER_ID}/status`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "CONFIRMED" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 401 without a JWT", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/admin/orders/${ORDER_ID}/status`,
        payload: { status: "CONFIRMED" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // Legacy duplicate route — must be removed
  describe("PUT /orders/:id/status (legacy duplicate, must be removed)", () => {
    it("returns 404 — the legacy route has been deleted in favor of /admin/orders/:id/status", async () => {
      // Historical bug (AUDIT_ATOMIC.md P1-1): this route duplicated
      // /admin/orders/:id/status but was on a non-prefixed path that
      // nobody (front, scripts, tests) called. It was dead code that
      // doubled the attack surface without any benefit.
      const token = await signToken(app);
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/orders/${ORDER_ID}/status`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "CONFIRMED" },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // Manual order
  describe("POST /admin/orders", () => {
    it("creates a manual order", async () => {
      const token = await signToken(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/orders",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          customerId: CUSTOMER_ID,
          items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 }],
          paymentMethod: "CASH",
          shippingMethod: "STORE_PICKUP",
          notes: "Vente en boutique",
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it("returns 403 for CLIENT", async () => {
      const token = await signToken(app, "CLIENT");
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/orders",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          customerId: CUSTOMER_ID,
          items: [{ productId: PRODUCT_ID, quantity: 1 }],
          paymentMethod: "CASH",
        },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
