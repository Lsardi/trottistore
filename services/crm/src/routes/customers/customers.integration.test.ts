import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { customerRoutes } from "./index.js";

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function buildTestApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  // Mock prisma
  app.decorate("prisma", {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    customerProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    customerInteraction: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({
        id: "interaction-1",
        type: "NOTE",
        channel: "MANUAL",
        createdAt: new Date().toISOString(),
      }),
    },
    loyaltyPoint: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (fn: any) => {
      if (typeof fn === "function") {
        return fn(app.prisma);
      }
      // Array-style transaction: return the array of results
      if (Array.isArray(fn)) {
        return Promise.all(fn);
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

describe("CRM Customers integration tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(customerRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /api/v1/customers ────────────────────────────────────

  it("GET /api/v1/customers returns 200 with { success, data, pagination }", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/customers",
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
      hasNext: false,
      hasPrev: false,
    });
  });

  it("GET /api/v1/customers supports search and filter params", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/customers?search=john&loyaltyTier=GOLD&sort=total_spent",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("GET /api/v1/customers supports pagination params", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/customers?page=3&limit=10",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.pagination.page).toBe(3);
    expect(body.pagination.limit).toBe(10);
  });

  // ── GET /api/v1/customers/:id ────────────────────────────────

  it("GET /api/v1/customers/:id with non-existent ID returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/customers/non-existent-id",
    });

    expect(res.statusCode).toBe(404);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("non-existent-id");
  });

  it("GET /api/v1/customers/:id returns customer when found", async () => {
    const mockCustomer = {
      id: "user-1",
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      phone: null,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      customerProfile: null,
      addresses: [],
      orders: [],
      interactions: [],
    };

    (app.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCustomer);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/customers/user-1",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe("john@example.com");
  });

  // ── GET /api/v1/customers/:id/timeline ───────────────────────

  it("GET /api/v1/customers/:id/timeline with non-existent customer returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/customers/non-existent-id/timeline",
    });

    expect(res.statusCode).toBe(404);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
