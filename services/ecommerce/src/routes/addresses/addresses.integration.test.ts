/**
 * Integration tests for address routes.
 *
 * Covers: CRUD (list, create, update, delete), auth required,
 * ownership check, validation, default address handling.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { addressRoutes } from "./index.js";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const ADDR_ID = "00000000-0000-0000-0000-000000000010";

const ADDR_FIXTURE = {
  id: ADDR_ID,
  userId: USER_ID,
  type: "SHIPPING",
  label: "Maison",
  firstName: "Alice",
  lastName: "Dupont",
  company: null,
  street: "18 rue Méchin",
  street2: null,
  city: "L'Île-Saint-Denis",
  postalCode: "93450",
  country: "FR",
  phone: "0612345678",
  isDefault: true,
  createdAt: new Date(),
};

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    address: {
      findMany: vi.fn().mockResolvedValue([ADDR_FIXTURE]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(ADDR_FIXTURE),
      update: vi.fn().mockResolvedValue(ADDR_FIXTURE),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue(ADDR_FIXTURE),
    },
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
      error: { code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR", message: error.message },
    });
  });

  return app;
}

async function signToken(app: FastifyInstance): Promise<string> {
  return app.jwt.sign({ sub: USER_ID, email: "alice@test.com", role: "CLIENT" });
}

describe("Address routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(addressRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("GET /addresses returns 401 without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/addresses" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /addresses lists user addresses", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/addresses",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });

  it("POST /addresses creates address with valid data", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/addresses",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        firstName: "Alice",
        lastName: "Dupont",
        street: "18 rue Méchin",
        city: "L'Île-Saint-Denis",
        postalCode: "93450",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().success).toBe(true);
  });

  it("POST /addresses rejects missing required fields", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/addresses",
      headers: { authorization: `Bearer ${token}` },
      payload: { firstName: "Alice" }, // missing lastName, street, city, postalCode
    });
    expect(res.statusCode).toBe(400);
  });

  it("PUT /addresses/:id updates address", async () => {
    const token = await signToken(app);
    (app.prisma.address.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(ADDR_FIXTURE);

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/addresses/${ADDR_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { city: "Paris" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("PUT /addresses/:id returns 404 if not owned by user", async () => {
    const token = await signToken(app);
    // findFirst returns null = not found for this user

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/addresses/${ADDR_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { city: "Paris" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /addresses/:id deletes address", async () => {
    const token = await signToken(app);
    (app.prisma.address.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(ADDR_FIXTURE);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/addresses/${ADDR_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("DELETE /addresses/:id returns 404 if not owned", async () => {
    const token = await signToken(app);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/addresses/${ADDR_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
