/**
 * Integration tests for SAV stats routes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { statsRoutes } from "./index.js";

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    repairTicket: {
      groupBy: vi.fn().mockResolvedValue([
        { status: "RECU", _count: { id: 3 } },
        { status: "PRET", _count: { id: 2 } },
      ]),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(5),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ total: 1250 }]),
  });

  app.decorate("redis", { get: vi.fn(), set: vi.fn(), del: vi.fn() });

  return app;
}

describe("SAV stats routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(statsRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("GET /repairs/stats returns aggregated stats", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/repairs/stats" });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.byStatus).toBeDefined();
    expect(json.data.openTickets).toBeDefined();
  });

  it("GET /repairs/diagnostic-stats returns category breakdowns", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/repairs/diagnostic-stats" });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.categories).toBeDefined();
    expect(json.data.totalRepairs).toBeDefined();
    // Should include the "other" category
    const otherCat = json.data.categories.find((c: any) => c.category === "other");
    expect(otherCat).toBeDefined();
  });
});
