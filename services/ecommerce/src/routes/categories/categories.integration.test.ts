/**
 * Integration tests for category routes (public + admin CRUD).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { categoryRoutes } from "./index.js";
import { adminRoutes } from "../admin/index.js";

const CAT_FIXTURE = {
  id: "cat-1",
  name: "Trottinettes",
  slug: "trottinettes",
  description: "Trottinettes électriques",
  imageUrl: null,
  parentId: null,
  position: 0,
  isActive: true,
  metaTitle: null,
  metaDesc: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  parent: null,
  children: [],
  _count: { products: 5 },
};

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    category: {
      findMany: vi.fn().mockResolvedValue([CAT_FIXTURE]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(CAT_FIXTURE),
      update: vi.fn().mockResolvedValue(CAT_FIXTURE),
      delete: vi.fn().mockResolvedValue(CAT_FIXTURE),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(null),
    },
    productVariant: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
    productCategory: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    productImage: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(async (fn: any) => {
      if (typeof fn === "function") return fn(app.prisma);
      return Promise.all(fn);
    }),
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

async function signToken(app: FastifyInstance, role = "ADMIN"): Promise<string> {
  return app.jwt.sign({ sub: "admin-1", email: "admin@test.com", role });
}

describe("Category routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(categoryRoutes, { prefix: "/api/v1" });
    await app.register(adminRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  // Public
  describe("GET /categories (public)", () => {
    it("returns category tree", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/categories" });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  describe("GET /categories/:slug (public)", () => {
    it("returns 404 for unknown slug", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/categories/unknown" });
      expect(res.statusCode).toBe(404);
    });

    it("returns category with products", async () => {
      (app.prisma.category.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(CAT_FIXTURE);
      const res = await app.inject({ method: "GET", url: "/api/v1/categories/trottinettes" });
      expect(res.statusCode).toBe(200);
    });
  });

  // Admin CRUD
  describe("GET /admin/categories", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/admin/categories" });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for CLIENT", async () => {
      const token = await signToken(app, "CLIENT");
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/categories",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it("lists categories for ADMIN", async () => {
      const token = await signToken(app);
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/categories",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /admin/categories", () => {
    it("creates a category", async () => {
      const token = await signToken(app);
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/categories",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Pièces détachées" },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  describe("PUT /admin/categories/:id", () => {
    it("updates a category", async () => {
      const token = await signToken(app);
      (app.prisma.category.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(CAT_FIXTURE);

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/categories/cat-1",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Trottinettes électriques" },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /admin/categories/:id", () => {
    it("deletes empty category", async () => {
      const token = await signToken(app);
      (app.prisma.category.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...CAT_FIXTURE,
        _count: { products: 0 },
      });

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/categories/cat-1",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it("rejects delete on non-empty category", async () => {
      const token = await signToken(app);
      (app.prisma.category.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(CAT_FIXTURE); // _count.products = 5

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/categories/cat-1",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("CATEGORY_NOT_EMPTY");
    });
  });
});
