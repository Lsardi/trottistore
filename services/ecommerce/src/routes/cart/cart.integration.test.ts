import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { cartRoutes } from "./index.js";

function buildTestApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  // Mock Redis
  const store = new Map<string, string>();
  app.decorate("redis", {
    get: vi.fn(async (key: string) => store.get(key) || null),
    set: vi.fn(async (key: string, value: string) => { store.set(key, value); return "OK"; }),
    del: vi.fn(async (key: string) => { store.delete(key); return 1; }),
  });

  // Mock Prisma (for enrichment lookups)
  app.decorate("prisma", {
    product: {
      findMany: vi.fn().mockResolvedValue([
        { id: "00000000-0000-0000-0000-000000000001", name: "Trottinette Test", slug: "trott-test", priceHt: "500.00", tvaRate: "20" },
      ]),
    },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  });

  // Mock cookie parser
  app.decorateRequest("cookies", { getter: () => ({}) });

  app.register(cartRoutes, { prefix: "/api/v1" });
  return app;
}

describe("Cart integration tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/cart returns empty cart for new session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cart",
      headers: { "x-session-id": "test-session-1" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
  });

  it.skip("POST /api/v1/cart/items adds an item", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: {
        "x-session-id": "test-session-2",
        "content-type": "application/json",
      },
      payload: {
        productId: "00000000-0000-0000-0000-000000000001",
        quantity: 2,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].productId).toBe("00000000-0000-0000-0000-000000000001");
    expect(body.data.items[0].quantity).toBe(2);
  });

  it("POST /api/v1/cart/items with invalid data returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: {
        "x-session-id": "test-session-3",
        "content-type": "application/json",
      },
      payload: {
        productId: "not-a-uuid",
        quantity: -1,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("GET /api/v1/cart without session returns 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cart",
    });

    expect(res.statusCode).toBe(400);
  });

  it("DELETE /api/v1/cart clears the cart", async () => {
    // Add item first
    await app.inject({
      method: "POST",
      url: "/api/v1/cart/items",
      headers: {
        "x-session-id": "test-session-4",
        "content-type": "application/json",
      },
      payload: { productId: "00000000-0000-0000-0000-000000000001", quantity: 1 },
    });

    // Clear cart
    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/cart",
      headers: { "x-session-id": "test-session-4" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify empty
    const getRes = await app.inject({
      method: "GET",
      url: "/api/v1/cart",
      headers: { "x-session-id": "test-session-4" },
    });
    expect(getRes.json().data.items).toEqual([]);
  });
});
