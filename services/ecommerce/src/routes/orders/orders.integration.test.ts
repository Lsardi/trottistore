import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { orderRoutes } from "./index.js";
import { authPlugin } from "../../plugins/auth.js";

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function buildTestApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-secret";
  process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || "test-cookie-secret";
  const app = Fastify({ logger: false });

  // Mock prisma
  app.decorate("prisma", {
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "order-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    address: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue({}),
    },
    paymentInstallment: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    payment: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (fn: any) => {
      if (typeof fn === "function") {
        // Pass a proxy that delegates to app.prisma for transactional calls
        return fn(app.prisma);
      }
      return fn;
    }),
  });

  // Mock redis
  app.decorate("redis", {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Orders integration tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(authPlugin);
    await app.register(orderRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /api/v1/orders ───────────────────────────────────────

  it("GET /api/v1/orders without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
    });

    expect(res.statusCode).toBe(401);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  // ── POST /api/v1/orders ──────────────────────────────────────

  it("POST /api/v1/orders without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      payload: {},
    });

    expect(res.statusCode).toBe(401);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/v1/orders with missing body returns 400 (when authenticated)", async () => {
    const authApp = buildTestApp();
    await authApp.register(authPlugin);
    await authApp.register(orderRoutes, { prefix: "/api/v1" });
    await authApp.ready();
    const token = authApp.jwt.sign({
      sub: "00000000-0000-0000-0000-000000000123",
      email: "test@test.com",
      role: "CLIENT",
    });

    const res = await authApp.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");

    await authApp.close();
  });

  it("POST /api/v1/orders with empty cart returns 400 (when authenticated)", async () => {
    const authApp = buildTestApp();
    await authApp.register(authPlugin);
    await authApp.register(orderRoutes, { prefix: "/api/v1" });
    await authApp.ready();
    const token = authApp.jwt.sign({
      sub: "00000000-0000-0000-0000-000000000123",
      email: "test@test.com",
      role: "CLIENT",
    });

    const res = await authApp.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        shippingAddressId: "00000000-0000-0000-0000-000000000001",
        paymentMethod: "CARD",
      },
    });

    expect(res.statusCode).toBe(400);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("EMPTY_CART");

    await authApp.close();
  });

  // ── GET /api/v1/orders/:id ───────────────────────────────────

  it("GET /api/v1/orders/:id without auth returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/orders/some-order-id",
    });

    expect(res.statusCode).toBe(401);
  });
});
