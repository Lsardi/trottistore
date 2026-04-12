import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { financeRoutes } from "./index.js";

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  const queryRaw = vi.fn()
    .mockResolvedValueOnce([
      { orderId: "order-1", orderNumber: 101, orderTotalCents: 10000, netPaidCents: 9500 },
    ])
    .mockResolvedValueOnce([
      { paymentId: "pay-1", provider: "stripe", providerRef: "pi_1", amountCents: 10000 },
    ])
    .mockResolvedValueOnce([
      { paymentId: "pay-2", orderId: "order-2", ageHours: 48 },
    ]);

  app.decorate("prisma", {
    $queryRaw: queryRaw,
  });

  app.decorate("redis", {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    reply.status(isZodError ? 400 : error.statusCode || 500).send({
      success: false,
      error: {
        code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR",
        message: error.message,
      },
    });
  });

  return app;
}

async function signToken(app: FastifyInstance, role = "ADMIN"): Promise<string> {
  return app.jwt.sign({ sub: "admin-1", email: "admin@test.com", role });
}

describe("Finance reconciliation routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(financeRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (app.prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        { orderId: "order-1", orderNumber: 101, orderTotalCents: 10000, netPaidCents: 9500 },
      ])
      .mockResolvedValueOnce([
        { paymentId: "pay-1", provider: "stripe", providerRef: "pi_1", amountCents: 10000 },
      ])
      .mockResolvedValueOnce([
        { paymentId: "pay-2", orderId: "order-2", ageHours: 48 },
      ]);
  });

  it("GET /admin/finance/reconciliation returns reconciliation report for ADMIN", async () => {
    const token = await signToken(app, "ADMIN");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/finance/reconciliation",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.discrepanciesCount).toBe(1);
    expect(json.data.orphanPaymentsCount).toBe(1);
    expect(json.data.stalePendingPaymentsCount).toBe(1);
  });

  it("POST /admin/finance/reconciliation/run returns 403 for CLIENT role", async () => {
    const token = await signToken(app, "CLIENT");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/finance/reconciliation/run",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(403);
  });
});
