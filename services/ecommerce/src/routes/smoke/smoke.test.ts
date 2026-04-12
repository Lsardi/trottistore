import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { authRoutes } from "../auth/index.js";
import { productRoutes } from "../products/index.js";
import { cartRoutes } from "../cart/index.js";
import { orderRoutes } from "../orders/index.js";

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-secret";
  process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    product: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(async ({ where }: any) => {
        if (where?.slug === "smoke-scooter") {
          return {
            id: "prod-1",
            name: "Smoke Scooter",
            slug: "smoke-scooter",
            status: "ACTIVE",
            brand: null,
            categories: [],
            images: [],
            variants: [],
          };
        }
        return null;
      }),
      count: vi.fn().mockResolvedValue(0),
    },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    address: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue(null),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue(null),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    paymentInstallment: {
      create: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    payment: {
      create: vi.fn().mockResolvedValue(null),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    customerProfile: {
      create: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === "function") {
        return arg(app.prisma);
      }
      return Promise.all(arg);
    }),
  });

  app.decorate("redis", {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    xadd: vi.fn().mockResolvedValue("1-0"),
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

describe("E-commerce smoke suite", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(authRoutes, { prefix: "/api/v1" });
    await app.register(productRoutes, { prefix: "/api/v1" });
    await app.register(cartRoutes, { prefix: "/api/v1" });
    await app.register(orderRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("smoke/auth: GET /api/v1/auth/me without token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
  });

  it("smoke/auth: rejects token with unknown role", async () => {
    const token = app.jwt.sign({
      sub: "00000000-0000-0000-0000-000000000444",
      email: "badrole@trottistore.test",
      role: "TECHNICIEN",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    } as unknown as Record<string, unknown>);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("smoke/auth: POST /api/v1/auth/logout-all revokes refresh tokens for current user", async () => {
    const token = app.jwt.sign({
      sub: "00000000-0000-0000-0000-000000000555",
      email: "logoutall@trottistore.test",
      role: "CLIENT",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    } as Record<string, unknown>);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout-all",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(app.prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "00000000-0000-0000-0000-000000000555", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("smoke/catalogue: GET /api/v1/products returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/products" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it("smoke/pdp: GET /api/v1/products/:slug returns 200 for existing slug", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products/smoke-scooter",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.slug).toBe("smoke-scooter");
  });

  it("smoke/cart: GET /api/v1/cart with session header returns 200", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cart",
      headers: { "x-session-id": "smoke-session-1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.itemCount).toBe(0);
  });

  it("smoke/checkout: POST /api/v1/orders without auth returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      payload: {
        shippingAddressId: "00000000-0000-0000-0000-000000000001",
        paymentMethod: "CARD",
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
  });
});
