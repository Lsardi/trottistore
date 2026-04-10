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

const TEST_CRON_SECRET = "deadbeef".repeat(8); // 64 chars, deterministic for tests

function buildApp(role: string = "MANAGER", cronSecret: string | undefined = TEST_CRON_SECRET): FastifyInstance {
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
  app.decorate("cronSecret", cronSecret);

  // Simulate authenticated user with the requested role for all requests
  app.addHook("onRequest", async (request) => {
    request.user = { userId: `${role.toLowerCase()}-1`, role };
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

  it("POST /triggers/run executes with valid x-internal-cron secret", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
      headers: { "x-internal-cron": TEST_CRON_SECRET },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("POST /triggers/run executes for MANAGER role without cron header", async () => {
    // Manual trigger run by an authenticated MANAGER must still work without
    // any x-internal-cron header at all.
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
    });
    expect(res.statusCode).toBe(200);
  });
});

/**
 * Security regression tests for CVE-equivalent: x-internal-cron auth bypass.
 *
 * Bug: the route at services/crm/src/routes/triggers/index.ts:88 originally
 * compared `request.headers["x-internal-cron"]` to the literal string "true".
 * Any authenticated non-MANAGER user (TECHNICIAN, STAFF, …) could send that
 * header and bypass the role check, executing all automated triggers (mass
 * email/SMS dispatch).
 *
 * After fix: the comparison must be against `app.cronSecret`, a 32-byte
 * random nonce generated at boot and never exposed to clients.
 */
describe("Trigger routes — security: cron header cannot be spoofed", () => {
  let staffApp: FastifyInstance;
  let technicianApp: FastifyInstance;

  beforeAll(async () => {
    staffApp = buildApp("STAFF");
    await staffApp.register(triggerRoutes, { prefix: "/api/v1" });
    await staffApp.ready();

    technicianApp = buildApp("TECHNICIAN");
    await technicianApp.register(triggerRoutes, { prefix: "/api/v1" });
    await technicianApp.ready();
  });

  afterAll(async () => {
    await staffApp.close();
    await technicianApp.close();
  });

  it("STAFF role with literal x-internal-cron:true is rejected (403)", async () => {
    const res = await staffApp.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
      headers: { "x-internal-cron": "true" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().success).toBe(false);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("TECHNICIAN role with literal x-internal-cron:true is rejected (403)", async () => {
    const res = await technicianApp.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
      headers: { "x-internal-cron": "true" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("STAFF role with random spoofed secret is rejected (403)", async () => {
    const res = await staffApp.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
      headers: { "x-internal-cron": "guess-the-secret-lol" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("STAFF role with VALID cron secret is accepted (200)", async () => {
    // The internal cron path bypasses the role check, so STAFF + valid
    // secret must succeed. This proves the secret comparison works at all.
    const res = await staffApp.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
      headers: { "x-internal-cron": TEST_CRON_SECRET },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("Empty cronSecret on the app fails closed even with empty header", async () => {
    // Defensive: if the boot somehow forgot to decorate cronSecret, the
    // header check must fail rather than allow ALL requests through.
    const brokenApp = buildApp("STAFF", undefined);
    await brokenApp.register(triggerRoutes, { prefix: "/api/v1" });
    await brokenApp.ready();
    try {
      const res = await brokenApp.inject({
        method: "POST",
        url: "/api/v1/triggers/run",
        headers: { "x-internal-cron": "" },
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await brokenApp.close();
    }
  });
});
