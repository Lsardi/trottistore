/**
 * Integration tests for stock routes.
 *
 * Covers: create movement, list movements, alerts, summary, auth.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { stockRoutes } from "./index.js";

const VARIANT_ID = "00000000-0000-0000-0000-000000000030";

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    productVariant: {
      findUnique: vi.fn().mockResolvedValue({
        id: VARIANT_ID,
        stockQuantity: 20,
        stockReserved: 0,
        lowStockThreshold: 5,
        product: { name: "Xiaomi Pro 2" },
      }),
      update: vi.fn().mockResolvedValue({ id: VARIANT_ID, stockQuantity: 25 }),
    },
    stockMovement: {
      create: vi.fn().mockResolvedValue({ id: "mv-1" }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    stockAlert: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(async (fn: any) => {
      if (typeof fn === "function") return fn(app.prisma);
      return Promise.all(fn);
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
  return app.jwt.sign({ sub: "admin-1", email: "admin@test.com", role });
}

describe("Stock routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(stockRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stock/alerts" });
    expect(res.statusCode).toBe(401);
  });

  it("POST /stock/movements creates a movement", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/stock/movements",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        variantId: VARIANT_ID,
        type: "IN_PURCHASE",
        quantity: 5,
        reason: "Réapprovisionnement",
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it("POST /stock/movements rejects zero quantity", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/stock/movements",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        variantId: VARIANT_ID,
        type: "IN_PURCHASE",
        quantity: 0,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /stock/movements lists movements", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stock/movements",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("GET /stock/alerts returns alerts", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stock/alerts",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("GET /stock/movements/summary returns summary", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stock/movements/summary",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
