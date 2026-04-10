/**
 * Integration tests for Google Merchant feed routes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { merchantRoutes } from "./index.js";

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    product: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "prod-1",
          name: "Xiaomi Pro 2",
          slug: "xiaomi-pro-2",
          sku: "XP2",
          description: "Trottinette haut de gamme",
          priceHt: 399,
          tvaRate: 20,
          status: "ACTIVE",
          brand: { name: "Xiaomi" },
          categories: [{ category: { name: "Trottinettes" } }],
          images: [{ url: "https://img.test/xp2.jpg", isPrimary: true }],
          variants: [{ stockQuantity: 5, stockReserved: 0 }],
        },
      ]),
    },
  });

  app.decorate("redis", { get: vi.fn(), set: vi.fn(), del: vi.fn() });

  return app;
}

describe("Merchant routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(merchantRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("GET /merchant/feed returns product feed", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/merchant/feed" });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.items).toBeDefined();
    expect(json.targetCountry).toBe("FR");
  });

  it("GET /merchant/local-inventory returns inventory data", async () => {
    (app.prisma as any).productVariant = {
      findMany: vi.fn().mockResolvedValue([
        { id: "v1", sku: "XP2-D", stockQuantity: 5, stockReserved: 0 },
      ]),
    };

    const res = await app.inject({ method: "GET", url: "/api/v1/merchant/local-inventory" });
    expect(res.statusCode).toBe(200);
  });
});
