/**
 * Integration tests for leads and stock alerts routes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { leadRoutes } from "./index.js";

const PRODUCT_ID = "00000000-0000-0000-0000-000000000020";

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    proLead: {
      create: vi.fn().mockResolvedValue({ id: "lead-1", createdAt: new Date() }),
    },
    product: {
      findUnique: vi.fn().mockResolvedValue({ id: PRODUCT_ID, status: "ACTIVE" }),
    },
    productVariant: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    stockAlert: {
      upsert: vi.fn().mockResolvedValue({ id: "alert-1", productId: PRODUCT_ID, email: "test@test.com", status: "ACTIVE" }),
    },
  });

  app.decorate("redis", { get: vi.fn(), set: vi.fn(), del: vi.fn() });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    reply.status(isZodError ? 400 : error.statusCode || 500).send({
      success: false,
      error: { code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR", message: error.message },
    });
  });

  return app;
}

describe("Lead routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(leadRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  describe("POST /leads/pro", () => {
    it("creates a B2B lead with valid data", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/leads/pro",
        payload: {
          company: "Flotte Express",
          contact: "Jean Dupont",
          email: "jean@flotte.fr",
          phone: "0612345678",
          fleetSize: "50+",
          message: "Intéressé par un partenariat",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(app.prisma.proLead.create).toHaveBeenCalledOnce();
    });

    it("rejects invalid email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/leads/pro",
        payload: { company: "Test", contact: "Bob", email: "not-email" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/leads/pro",
        payload: { email: "bob@test.com" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /stock-alerts", () => {
    it("creates a stock alert", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/stock-alerts",
        payload: { productId: PRODUCT_ID, email: "alice@test.com" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("returns 404 for non-existent product", async () => {
      (app.prisma.product.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/stock-alerts",
        payload: { productId: PRODUCT_ID, email: "bob@test.com" },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
