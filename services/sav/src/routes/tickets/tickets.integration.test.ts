import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { repairRoutes } from "./index.js";

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function buildTestApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  // Error handler matching the real SAV service
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message: statusCode >= 500 ? "Une erreur interne est survenue" : error.message,
      },
    });
  });

  // Mock prisma
  app.decorate("prisma", {
    repairTicket: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({
        id: "ticket-1",
        status: "RECU",
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
    repairActivityLog: {
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

  // Test helper: inject a synthetic authenticated user via the
  // `x-test-user` header (JSON-encoded). In production this user comes
  // from app.authenticate (global onRequest hook in services/sav/src/index.ts).
  // Doing it via header keeps the test matrix flat — each `it` declares
  // its own caller.
  app.addHook("onRequest", async (request) => {
    const raw = request.headers["x-test-user"];
    if (typeof raw === "string" && raw.length > 0) {
      try {
        (request as { user?: unknown }).user = JSON.parse(raw);
      } catch {
        // ignore — leaves request.user undefined
      }
    }
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

  // Reset mock call history between each test. Without this, assertions
  // like `expect(update).not.toHaveBeenCalled()` pick up calls made by
  // earlier tests in the file and produce false-fails that depend on
  // test order.
  beforeEach(() => {
    vi.clearAllMocks();
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
      url: "/api/v1/repairs?status=RECU&priority=HIGH&sort=priority",
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

  // ── PUT /api/v1/repairs/:id/quote/accept ─────────────────────
  //
  // Security regression tests for AUDIT_ATOMIC.md#P1-2: TECHNICIAN must
  // only accept quotes on tickets they are assigned to. The route
  // already follows this pattern for status transitions, quote send,
  // parts add (lines 552, 591, 708, 980, 1059) — but the quote/accept
  // path at line 838 was missing the check.

  describe("PUT /api/v1/repairs/:id/quote/accept — assignedTo guard", () => {
    const TICKET_ID = "ticket-quote-1";
    const ASSIGNED_TECH = "00000000-0000-0000-0000-00000000A001";
    const OTHER_TECH = "00000000-0000-0000-0000-00000000A002";
    const TICKET_ON_DEVIS = {
      id: TICKET_ID,
      status: "DEVIS_ENVOYE",
      assignedTo: ASSIGNED_TECH,
      customerId: "cust-1",
    };

    it("TECHNICIAN assigned to the ticket can accept the quote (200)", async () => {
      (app.prisma.repairTicket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(TICKET_ON_DEVIS);
      (app.prisma.repairTicket.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...TICKET_ON_DEVIS,
        status: "DEVIS_ACCEPTE",
      });

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/repairs/${TICKET_ID}/quote/accept`,
        headers: {
          "x-test-user": JSON.stringify({ userId: ASSIGNED_TECH, role: "TECHNICIAN" }),
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("TECHNICIAN NOT assigned is rejected (403)", async () => {
      (app.prisma.repairTicket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(TICKET_ON_DEVIS);

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/repairs/${TICKET_ID}/quote/accept`,
        headers: {
          "x-test-user": JSON.stringify({ userId: OTHER_TECH, role: "TECHNICIAN" }),
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
      // The ticket must NOT have been updated
      expect(app.prisma.repairTicket.update).not.toHaveBeenCalled();
    });

    it("MANAGER can accept any quote regardless of assignedTo (200)", async () => {
      (app.prisma.repairTicket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(TICKET_ON_DEVIS);
      (app.prisma.repairTicket.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...TICKET_ON_DEVIS,
        status: "DEVIS_ACCEPTE",
      });

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/repairs/${TICKET_ID}/quote/accept`,
        headers: {
          "x-test-user": JSON.stringify({ userId: "manager-1", role: "MANAGER" }),
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it("STAFF can accept any quote (200, matches existing pattern)", async () => {
      (app.prisma.repairTicket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(TICKET_ON_DEVIS);
      (app.prisma.repairTicket.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...TICKET_ON_DEVIS,
        status: "DEVIS_ACCEPTE",
      });

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/repairs/${TICKET_ID}/quote/accept`,
        headers: {
          "x-test-user": JSON.stringify({ userId: "staff-1", role: "STAFF" }),
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it("CLIENT is rejected (403) — existing guard, regression coverage", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/repairs/${TICKET_ID}/quote/accept`,
        headers: {
          "x-test-user": JSON.stringify({ userId: "client-1", role: "CLIENT" }),
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it("unauthenticated (no request.user) is rejected (403)", async () => {
      // Defense in depth: the global SAV onRequest hook enforces auth
      // on this path in production, but the route itself must also
      // reject a missing user rather than fall through.
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/repairs/${TICKET_ID}/quote/accept`,
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
