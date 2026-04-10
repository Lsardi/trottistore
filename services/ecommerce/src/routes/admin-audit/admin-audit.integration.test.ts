/**
 * Integration tests for audit log route + logAudit helper.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { auditRoutes, logAudit } from "./index.js";

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    auditLog: {
      findMany: vi.fn().mockResolvedValue([
        { id: "log-1", action: "CREATE", resource: "product", createdAt: new Date() },
      ]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(null),
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

async function signToken(app: FastifyInstance, role = "ADMIN"): Promise<string> {
  return app.jwt.sign({ sub: "admin-1", email: "admin@test.com", role });
}

describe("Audit routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(auditRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("GET /admin/audit-log returns paginated entries", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit-log",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().pagination).toBeDefined();
  });

  it("GET /admin/audit-log returns 403 for CLIENT", async () => {
    const token = await signToken(app, "CLIENT");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit-log",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("logAudit helper creates an entry", async () => {
    const mockPrisma = { auditLog: { create: vi.fn().mockResolvedValue(null) } };
    await logAudit(mockPrisma, {
      userId: "user-1",
      action: "CREATE",
      resource: "product",
      resourceId: "prod-1",
      details: "Created product Xiaomi Pro 2",
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
  });
});
