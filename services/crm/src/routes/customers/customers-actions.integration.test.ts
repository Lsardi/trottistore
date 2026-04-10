/**
 * Integration tests for customer admin actions: status change, merge.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { customerRoutes } from "./index.js";

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: "user-1", role: "CLIENT", status: "ACTIVE" }),
      update: vi.fn().mockResolvedValue({ id: "user-1", email: "alice@test.com", status: "SUSPENDED" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    customerProfile: {
      findUnique: vi.fn().mockResolvedValue({ id: "prof-1", loyaltyPoints: 100, totalOrders: 5, totalSpent: 500 }),
      update: vi.fn().mockResolvedValue(null),
    },
    customerInteraction: {
      create: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    order: {
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    repairTicket: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    address: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    review: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    customerSegment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    loyaltyPoint: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === "function") return arg(app.prisma);
      return Promise.all(arg);
    }),
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

describe("Customer admin actions", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(customerRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  describe("PUT /customers/:id/status", () => {
    it("suspends a customer", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/customers/user-1/status",
        payload: { status: "SUSPENDED", reason: "Fraude suspectée" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(app.prisma.customerInteraction.create).toHaveBeenCalledOnce();
    });

    it("returns 404 for unknown customer", async () => {
      (app.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/customers/unknown/status",
        payload: { status: "BANNED" },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /customers/merge", () => {
    it("merges two accounts", async () => {
      (app.prisma.user.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: "user-1", role: "CLIENT" })
        .mockResolvedValueOnce({ id: "user-2", role: "CLIENT" });

      (app.prisma.customerProfile.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: "prof-1", loyaltyPoints: 100, totalOrders: 5, totalSpent: 500 })
        .mockResolvedValueOnce({ id: "prof-2", loyaltyPoints: 50, totalOrders: 2, totalSpent: 200 });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/customers/merge",
        payload: {
          keepId: "00000000-0000-0000-0000-000000000001",
          mergeId: "00000000-0000-0000-0000-000000000002",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.message).toContain("fusionnés");
    });

    it("rejects merging same account", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/customers/merge",
        payload: {
          keepId: "00000000-0000-0000-0000-000000000001",
          mergeId: "00000000-0000-0000-0000-000000000001",
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("SAME_ACCOUNT");
    });
  });
});
