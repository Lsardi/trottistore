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
