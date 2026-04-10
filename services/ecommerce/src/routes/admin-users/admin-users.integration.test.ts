/**
 * Integration tests for admin user/staff management routes.
 *
 * Covers: list staff, create with invitation, update role/status,
 * detail with activity, RBAC, duplicate email, self-suspend prevention.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { adminUserRoutes } from "./index.js";

const mockSendEmail = vi.fn().mockResolvedValue(true);
vi.mock("@trottistore/shared/notifications", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const STAFF_FIXTURE = {
  id: "staff-1",
  email: "bob@trottistore.fr",
  firstName: "Bob",
  lastName: "Technicien",
  role: "TECHNICIAN",
  status: "ACTIVE",
  phone: "0612345678",
  lastLoginAt: new Date(),
  loginCount: 12,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    user: {
      findMany: vi.fn().mockResolvedValue([STAFF_FIXTURE]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(STAFF_FIXTURE),
      update: vi.fn().mockResolvedValue(STAFF_FIXTURE),
    },
    passwordResetToken: {
      create: vi.fn().mockResolvedValue(null),
    },
    orderStatusHistory: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    repairTicket: {
      findMany: vi.fn().mockResolvedValue([]),
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

async function signToken(app: FastifyInstance, role = "ADMIN", userId = "admin-1"): Promise<string> {
  return app.jwt.sign({ sub: userId, email: "admin@trottistore.fr", role });
}

describe("Admin user routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(adminUserRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  // RBAC
  it("returns 401 without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/users" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for CLIENT role", async () => {
    const token = await signToken(app, "CLIENT");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 for TECHNICIAN role", async () => {
    const token = await signToken(app, "TECHNICIAN");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  // List
  it("GET /admin/users lists staff members", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });

  // Create
  it("POST /admin/users creates staff + sends invitation email", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        email: "new.tech@trottistore.fr",
        firstName: "Alice",
        lastName: "Nouvelle",
        role: "TECHNICIAN",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.invitationSent).toBe(true);
    expect(app.prisma.user.create).toHaveBeenCalledOnce();
    expect(app.prisma.passwordResetToken.create).toHaveBeenCalledOnce();

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const [to, subject] = mockSendEmail.mock.calls[0];
    expect(to).toBe("bob@trottistore.fr"); // mock returns STAFF_FIXTURE
    expect(subject).toContain("Invitation");
  });

  it("POST /admin/users rejects duplicate email", async () => {
    const token = await signToken(app);
    (app.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "existing" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        email: "existing@trottistore.fr",
        firstName: "Bob",
        lastName: "Existe",
        role: "STAFF",
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it("POST /admin/users rejects CLIENT role", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        email: "client@test.com",
        firstName: "Client",
        lastName: "Test",
        role: "CLIENT",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  // Update
  it("PUT /admin/users/:id updates role", async () => {
    const token = await signToken(app);
    (app.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(STAFF_FIXTURE);

    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/users/staff-1",
      headers: { authorization: `Bearer ${token}` },
      payload: { role: "MANAGER" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("PUT /admin/users/:id prevents self-suspend", async () => {
    const token = await signToken(app, "ADMIN", "admin-1");
    (app.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...STAFF_FIXTURE,
      id: "admin-1",
    });

    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/users/admin-1",
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "SUSPENDED" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("SELF_SUSPEND");
  });

  // Detail with activity
  it("GET /admin/users/:id returns user with activity", async () => {
    const token = await signToken(app);
    (app.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(STAFF_FIXTURE);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users/staff-1",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.activity).toBeDefined();
    expect(res.json().data.activity.processedOrders).toBeDefined();
    expect(res.json().data.activity.handledTickets).toBeDefined();
  });
});
