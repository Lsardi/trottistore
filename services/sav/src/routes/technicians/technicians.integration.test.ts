/**
 * Integration tests for technician routes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { technicianRoutes } from "./index.js";

const TECH_FIXTURE = {
  id: "tech-1",
  userId: "user-tech",
  specialities: ["batterie", "moteur"],
  isAvailable: true,
  maxConcurrent: 5,
  createdAt: new Date(),
  user: { id: "user-tech", firstName: "Bob", lastName: "Technicien", email: "bob@test.com" },
  _count: { assignedTickets: 2 },
};

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    technician: {
      findMany: vi.fn().mockResolvedValue([TECH_FIXTURE]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(TECH_FIXTURE),
    },
    repairTicket: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(2),
    },
  });

  app.decorate("redis", { get: vi.fn(), set: vi.fn(), del: vi.fn() });

  return app;
}

describe("Technician routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(technicianRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("GET /technicians lists technicians", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/technicians" });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data).toHaveLength(1);
  });

  it("GET /technicians/:id/schedule returns 404 for unknown tech", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/technicians/tech-unknown/schedule" });
    expect(res.statusCode).toBe(404);
  });
});
