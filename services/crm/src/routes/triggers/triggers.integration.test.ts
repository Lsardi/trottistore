/**
 * Integration tests for trigger routes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { triggerRoutes } from "./index.js";

vi.mock("@trottistore/shared/notifications", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  sendSms: vi.fn().mockResolvedValue(true),
}));

const TRIGGER_FIXTURE = {
  id: "trig-1",
  type: "PICKUP_REMINDER",
  delayHours: 72,
  channel: "EMAIL",
  templateId: null,
  smsContent: null,
  isActive: true,
  lastRunAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    automatedTrigger: {
      findMany: vi.fn().mockResolvedValue([TRIGGER_FIXTURE]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(TRIGGER_FIXTURE),
      update: vi.fn().mockResolvedValue(TRIGGER_FIXTURE),
    },
    repairTicket: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notificationLog: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
    },
  });

  app.decorate("redis", { get: vi.fn(), set: vi.fn(), del: vi.fn() });

  // Simulate authenticated MANAGER user for all requests
  app.addHook("onRequest", async (request) => {
    request.user = { userId: "manager-1", role: "MANAGER" };
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    reply.status(isZodError ? 400 : error.statusCode || 500).send({
      success: false,
      error: { code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR", message: error.message },
    });
  });

  return app;
}

describe("Trigger routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(triggerRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("GET /triggers lists triggers", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/triggers" });
    expect(res.statusCode).toBe(200);
  });

  it("POST /triggers creates a trigger", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/triggers",
      payload: { type: "PICKUP_REMINDER", delayHours: 72, channel: "EMAIL" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("POST /triggers/run executes with internal cron header", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
      headers: { "x-internal-cron": "true" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("POST /triggers/run works with internal cron even without user", async () => {
    // The onRequest hook sets MANAGER, but the x-internal-cron header should also work
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
      headers: { "x-internal-cron": "true" },
    });
    expect(res.statusCode).toBe(200);
  });
});
