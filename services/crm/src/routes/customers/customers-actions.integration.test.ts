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
      delete: vi.fn().mockResolvedValue(null),
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
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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

    // ──────────────────────────────────────────────────────────────────
    // Security regression tests for AUDIT_PRODUCTION_CRITICAL.md#P0-4
    // ──────────────────────────────────────────────────────────────────

    it("reparents loyalty log entries from merged profile to kept profile", async () => {
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

      // The loyaltyPoint history must be reparented from mergeProfile to keepProfile
      // (otherwise the historical points are silently orphaned and the cascade
      // delete on CustomerProfile would wipe them).
      expect(app.prisma.loyaltyPoint.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { profileId: "prof-2" },
          data: { profileId: "prof-1" },
        }),
      );
    });

    it("deletes the merged customer profile after migrating data", async () => {
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

      // The merged profile must be deleted to avoid leaving a zombie row that
      // still references the (now deactivated) merged user.
      expect(app.prisma.customerProfile.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "prof-2" } }),
      );
    });

    it("performs the entire merge in a single transaction", async () => {
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

      // The whole merge must be one $transaction call. The buggy version
      // split it into two boundaries (data transfer + loyalty merge), leaving
      // a window where a crash would corrupt state.
      expect(app.prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("reparents mergeProfile when keepUser has no profile (else branch)", async () => {
      // Coverage gap identified by Codex adversarial review 2026-04-10:
      // when keepUser has no CustomerProfile but mergeUser does, the fix
      // must reparent the existing profile to keepId instead of
      // delete+merge. Otherwise the loyalty history would be lost.
      (app.prisma.user.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: "user-1", role: "CLIENT" })
        .mockResolvedValueOnce({ id: "user-2", role: "CLIENT" });
      (app.prisma.customerProfile.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // keepProfile absent
        .mockResolvedValueOnce({ id: "prof-2", loyaltyPoints: 42, totalOrders: 1, totalSpent: 100 });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/customers/merge",
        payload: {
          keepId: "00000000-0000-0000-0000-000000000001",
          mergeId: "00000000-0000-0000-0000-000000000002",
        },
      });
      expect(res.statusCode).toBe(200);

      // The merge profile must be reparented to keepId (not deleted).
      expect(app.prisma.customerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prof-2" },
          data: { userId: "00000000-0000-0000-0000-000000000001" },
        }),
      );
      // The profile must NOT be deleted in this branch — there's no other
      // profile to absorb it into.
      expect(app.prisma.customerProfile.delete).not.toHaveBeenCalled();
      // Nor should loyaltyPoint be reparented — the profile itself moved.
      expect(app.prisma.loyaltyPoint.updateMany).not.toHaveBeenCalled();
    });

    it("no-op on the profile side when neither user has a profile", async () => {
      (app.prisma.user.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: "user-1", role: "CLIENT" })
        .mockResolvedValueOnce({ id: "user-2", role: "CLIENT" });
      (app.prisma.customerProfile.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/customers/merge",
        payload: {
          keepId: "00000000-0000-0000-0000-000000000001",
          mergeId: "00000000-0000-0000-0000-000000000002",
        },
      });
      expect(res.statusCode).toBe(200);

      expect(app.prisma.customerProfile.update).not.toHaveBeenCalled();
      expect(app.prisma.customerProfile.delete).not.toHaveBeenCalled();
      expect(app.prisma.loyaltyPoint.updateMany).not.toHaveBeenCalled();
      // But the rest of the merge still happens: user deactivation,
      // order transfer, interaction log, etc.
      expect(app.prisma.user.update).toHaveBeenCalled();
      expect(app.prisma.order.updateMany).toHaveBeenCalled();
    });
  });
});
