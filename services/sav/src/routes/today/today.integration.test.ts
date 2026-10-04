import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { todayRoutes } from "./index.js";

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorate("prisma", {
    repairAppointment: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    repairTicket: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  });
  app.addHook("onRequest", async (request) => {
    const raw = request.headers["x-test-user"];
    if (typeof raw === "string") (request as { user?: unknown }).user = JSON.parse(raw);
  });
  return app;
}

describe("GET /today (SAV)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildApp();
    await app.register(todayRoutes, { prefix: "/api/v1" });
    await app.ready();
  });
  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("rejects clients and anonymous callers", async () => {
    expect((await app.inject({ method: "GET", url: "/api/v1/today" })).statusCode).toBe(403);
    const asClient = await app.inject({ method: "GET", url: "/api/v1/today", headers: { "x-test-user": JSON.stringify({ userId: "c1", role: "CLIENT" }) } });
    expect(asClient.statusCode).toBe(403);
  });

  it("managers see the whole shop; technicians only their own queue", async () => {
    const count = app.prisma.repairTicket.count as ReturnType<typeof vi.fn>;
    const mgr = await app.inject({ method: "GET", url: "/api/v1/today", headers: { "x-test-user": JSON.stringify({ userId: "m1", role: "MANAGER" }) } });
    expect(mgr.statusCode).toBe(200);
    expect(mgr.json().data.scope).toBe("all");
    expect(count.mock.calls.every((c) => !("assignedTo" in c[0].where))).toBe(true);

    vi.clearAllMocks();
    const tech = await app.inject({ method: "GET", url: "/api/v1/today", headers: { "x-test-user": JSON.stringify({ userId: "t1", role: "TECHNICIAN" }) } });
    expect(tech.json().data.scope).toBe("mine");
    expect(count.mock.calls.every((c) => c[0].where.assignedTo === "t1")).toBe(true);
  });

  it("flags quotes without an answer for more than 48h", async () => {
    const findMany = app.prisma.repairTicket.findMany as ReturnType<typeof vi.fn>;
    await app.inject({ method: "GET", url: "/api/v1/today", headers: { "x-test-user": JSON.stringify({ userId: "m1", role: "MANAGER" }) } });
    const quoteQuery = findMany.mock.calls.find((c) => c[0].where.status === "DEVIS_ENVOYE")?.[0];
    expect(quoteQuery).toBeDefined();
    const cutoff = quoteQuery.where.updatedAt.lt as Date;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThan(47 * 3600_000);
    expect(Date.now() - cutoff.getTime()).toBeLessThan(49 * 3600_000);
  });
});
