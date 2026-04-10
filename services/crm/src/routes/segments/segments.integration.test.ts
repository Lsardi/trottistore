/**
 * Integration tests for segment routes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { segmentRoutes } from "./index.js";

const SEG_FIXTURE = {
  id: "seg-1",
  name: "Gold VIP",
  description: "Clients Gold",
  criteria: { loyaltyTier: "GOLD" },
  count: 5,
  isAutomatic: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    customerSegment: {
      findMany: vi.fn().mockResolvedValue([SEG_FIXTURE]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(SEG_FIXTURE),
      update: vi.fn().mockResolvedValue(SEG_FIXTURE),
    },
    customerProfile: {
      count: vi.fn().mockResolvedValue(5),
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

describe("Segment routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(segmentRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("GET /segments lists segments", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/segments" });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("POST /segments creates a segment", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/segments",
      payload: { name: "Nouveaux clients", criteria: { minOrders: 1 } },
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST /segments/:id/evaluate counts matching profiles", async () => {
    (app.prisma.customerSegment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(SEG_FIXTURE);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/segments/seg-1/evaluate",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.count).toBe(5);
  });
});
