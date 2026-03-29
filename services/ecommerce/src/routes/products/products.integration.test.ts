import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { productRoutes } from "./index.js";
import { categoryRoutes } from "../categories/index.js";

// ---------------------------------------------------------------------------
// Test helper: builds a minimal Fastify app with mocked prisma & redis
// ---------------------------------------------------------------------------

function buildTestApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  // Mock prisma
  app.decorate("prisma", {
    product: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
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

describe("Products integration tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(productRoutes, { prefix: "/api/v1" });
    await app.register(categoryRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /api/v1/products ─────────────────────────────────────

  it("GET /api/v1/products returns 200 with { success, data } shape", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products",
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

  it("GET /api/v1/products respects pagination params", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products?page=2&limit=5",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(5);
  });

  it("GET /api/v1/products with invalid page returns 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products?page=-1",
    });

    expect(res.statusCode).toBe(400);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/products supports filter params", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products?search=scooter&sort=price_asc&inStock=true",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  // ── GET /api/v1/products/:slug ───────────────────────────────

  it("GET /api/v1/products/:slug with non-existent slug returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products/does-not-exist",
    });

    expect(res.statusCode).toBe(404);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("does-not-exist");
  });

  it("GET /api/v1/products/:slug returns product when found", async () => {
    const mockProduct = {
      id: "prod-1",
      name: "Test Scooter",
      slug: "test-scooter",
      status: "ACTIVE",
      brand: { id: "b1", name: "Brand", slug: "brand" },
      categories: [],
      images: [],
      variants: [],
    };

    (app.prisma.product.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockProduct);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products/test-scooter",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe("test-scooter");
  });

  // ── GET /api/v1/categories ───────────────────────────────────

  it("GET /api/v1/categories returns 200 with { success, data }", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/categories",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });
});
