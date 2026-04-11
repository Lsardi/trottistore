/**
 * Integration tests for trigger routes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { triggerRoutes } from "./index.js";
import { isInternalCronCall } from "../../lib/cron-auth.js";

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

/**
 * Full-service integration — reproduces the PRODUCTION onRequest hook
 * from services/crm/src/index.ts. Tests that the in-process cron can
 * actually reach POST /triggers/run through the global auth hook,
 * without any JWT, using only app.cronSecret.
 *
 * Without this test, C was broken operationally: the global auth hook
 * would reject the cron call with 401 before it reached the route,
 * even though the route's own secret check was correct.
 *
 * Identified by Codex during adversarial review of C on 2026-04-10.
 */
function buildFullApp(cronSecret: string | undefined = TEST_CRON_SECRET): FastifyInstance {
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

  // Mirror services/crm/src/index.ts onRequest hook exactly. This is the
  // contract the production server implements. The cron bypass is
  // path-scoped to POST /api/v1/triggers/run.
  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (
      path === "/health" ||
      path === "/metrics" ||
      path === "/ready" ||
      path.startsWith("/api/v1/health") ||
      path.startsWith("/api/v1/metrics") ||
      path.startsWith("/api/v1/ready")
    ) {
      return;
    }

    const isCronRunEndpoint =
      request.method === "POST" &&
      (path === "/api/v1/triggers/run" || path === "/triggers/run");
    if (
      isCronRunEndpoint &&
      isInternalCronCall(request.headers["x-internal-cron"], app.cronSecret)
    ) {
      (request as { user?: unknown }).user = {
        id: "system-cron",
        userId: "system-cron",
        email: "cron@trottistore.local",
        role: "SYSTEM",
      };
      return;
    }

    // No JWT, no cron secret (or wrong endpoint) → fail auth the way production would.
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing token" },
    });
  });

  // Register a stub route on a sibling path to prove the cron bypass is
  // strictly scoped to /triggers/run. If a leaked secret somehow reached
  // the service, it MUST NOT authorize /customers, /segments, /campaigns,
  // or any other CRM surface. The stub below lets the test assert 401
  // even when the header is the correct secret.
  app.get("/api/v1/customers/fake-scope-probe", async () => ({ success: true }));
  app.post("/api/v1/triggers/run-fake", async () => ({ success: true }));

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    reply.status(isZodError ? 400 : error.statusCode || 500).send({
      success: false,
      error: { code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR", message: error.message },
    });
  });

  return app;
}

describe("Trigger routes — full-service integration (onRequest hook + route)", () => {
  let fullApp: FastifyInstance;

  beforeAll(async () => {
    fullApp = buildFullApp();
    await fullApp.register(triggerRoutes, { prefix: "/api/v1" });
    await fullApp.ready();
  });

  afterAll(() => fullApp.close());

  it("cron with valid secret traverses the global auth hook without JWT (200)", async () => {
    // No Authorization header. The only credential is the cron secret.
    const res = await fullApp.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
      headers: { "x-internal-cron": TEST_CRON_SECRET },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("cron with wrong secret is rejected at the hook (401)", async () => {
    const res = await fullApp.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
      headers: { "x-internal-cron": "wrong-secret" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("request without any credentials is rejected at the hook (401)", async () => {
    const res = await fullApp.inject({
      method: "POST",
      url: "/api/v1/triggers/run",
    });
    expect(res.statusCode).toBe(401);
  });

  it("undefined cronSecret fails closed — any header value still 401", async () => {
    const brokenApp = buildFullApp(undefined);
    await brokenApp.register(triggerRoutes, { prefix: "/api/v1" });
    await brokenApp.ready();
    try {
      const res = await brokenApp.inject({
        method: "POST",
        url: "/api/v1/triggers/run",
        headers: { "x-internal-cron": "anything" },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await brokenApp.close();
    }
  });

  // ──────────────────────────────────────────────────────────────
  // Cron bypass scope — identified by Codex adversarial review 2026-04-10
  //
  // The bypass MUST be strictly scoped to POST /api/v1/triggers/run.
  // A leaked secret must NOT grant access to any other CRM route.
  // ──────────────────────────────────────────────────────────────

  it("valid cron secret on /customers/* is rejected (scope = triggers/run only)", async () => {
    // The stub route app.get("/api/v1/customers/fake-scope-probe") would
    // return 200 if the hook let the request through. It must not.
    const res = await fullApp.inject({
      method: "GET",
      url: "/api/v1/customers/fake-scope-probe",
      headers: { "x-internal-cron": TEST_CRON_SECRET },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
  });

  it("valid cron secret on a lookalike path /triggers/run-fake is rejected", async () => {
    // Exact path match — no prefix trick. "/triggers/run-fake" ≠ "/triggers/run".
    const res = await fullApp.inject({
      method: "POST",
      url: "/api/v1/triggers/run-fake",
      headers: { "x-internal-cron": TEST_CRON_SECRET },
    });
    expect(res.statusCode).toBe(401);
  });

  it("valid cron secret on GET /triggers (wrong method) is rejected", async () => {
    // Method match — only POST to /triggers/run is exempt. GET /triggers
    // is a list endpoint and must stay behind JWT auth.
    const res = await fullApp.inject({
      method: "GET",
      url: "/api/v1/triggers",
      headers: { "x-internal-cron": TEST_CRON_SECRET },
    });
    expect(res.statusCode).toBe(401);
  });
});
