import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { repairRoutes } from "./index.js";

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function buildTestApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  // Mock prisma
  app.decorate("prisma", {
    repairTicket: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({
        id: "ticket-1",
        status: "NOUVEAU",
        productModel: "Xiaomi Pro 2",
        type: "REPARATION",
        priority: "NORMAL",
        issueDescription: "Broken brake",
        createdAt: new Date().toISOString(),
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    repairStatusLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    repairPartUsed: {
      create: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({ _sum: { unitCost: 0 } }),
    },
    productVariant: {
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (fn: any) => {
      if (typeof fn === "function") {
        return fn(app.prisma);
      }
      return fn;
    }),
  });

  // Mock redis
  app.decorate("redis", {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SAV Tickets integration tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(repairRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /api/v1/repairs ──────────────────────────────────────

  it("GET /api/v1/repairs returns 200 with { success, data, pagination }", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repairs",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty("pagination");
    expect(body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("GET /api/v1/repairs supports filter params", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repairs?status=NOUVEAU&priority=HIGH&sort=priority",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  // ── GET /api/v1/repairs/:id ──────────────────────────────────

  it("GET /api/v1/repairs/:id with non-existent ID returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repairs/non-existent-id",
    });

    expect(res.statusCode).toBe(404);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  // ── POST /api/v1/repairs ─────────────────────────────────────

  it("POST /api/v1/repairs validates required fields (missing body)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/repairs",
      payload: {},
    });

    // Zod .parse() throws, which Fastify catches and returns 500 by default
    // (since there is no safeParse in this route, the error handler catches it)
    expect(res.statusCode).toBeGreaterThanOrEqual(400);

    const body = res.json();
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/repairs validates required fields (partial body)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/repairs",
      payload: {
        customerId: "not-a-uuid",
        productModel: "",
      },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);

    const body = res.json();
    expect(body.success).toBe(false);
  });

  it("POST /api/v1/repairs creates ticket with valid data", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/repairs",
      payload: {
        customerId: "00000000-0000-0000-0000-000000000001",
        productModel: "Xiaomi Pro 2",
        type: "REPARATION",
        issueDescription: "Brake not working properly",
      },
    });

    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("data");
  });
});
