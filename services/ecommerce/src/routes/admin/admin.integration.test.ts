/**
 * Integration tests for admin routes.
 *
 * Covers: RBAC enforcement, product CRUD (create, read, update, delete,
 * duplicate), stock update, bulk operations, and validation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { adminRoutes } from "./index.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRODUCT_FIXTURE = {
  id: "prod-1",
  sku: "TROTT-001",
  name: "Xiaomi Pro 2",
  slug: "xiaomi-pro-2",
  description: "Trottinette électrique haut de gamme",
  shortDescription: null,
  brandId: null,
  priceHt: 399.0,
  tvaRate: 20,
  status: "ACTIVE",
  isFeatured: false,
  metaTitle: null,
  metaDesc: null,
  brand: null,
  categories: [],
  images: [],
  variants: [
    {
      id: "var-1",
      sku: "TROTT-001-DEFAULT",
      name: "Default",
      stockQuantity: 10,
      stockReserved: 0,
      lowStockThreshold: 5,
      isActive: true,
      createdAt: new Date(),
    },
  ],
};

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    product: {
      findMany: vi.fn().mockResolvedValue([PRODUCT_FIXTURE]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(PRODUCT_FIXTURE),
      update: vi.fn().mockResolvedValue(PRODUCT_FIXTURE),
      count: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(PRODUCT_FIXTURE),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    productVariant: {
      findFirst: vi.fn().mockResolvedValue(PRODUCT_FIXTURE.variants[0]),
      update: vi.fn().mockResolvedValue(PRODUCT_FIXTURE.variants[0]),
    },
    productCategory: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    productImage: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
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
    const statusCode = isZodError ? 400 : error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR",
        message: error.message,
      },
    });
  });

  return app;
}

async function signToken(
  app: FastifyInstance,
  role: string,
  userId = "admin-1",
): Promise<string> {
  return app.jwt.sign({ sub: userId, email: "admin@trottistore.fr", role });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Admin routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(adminRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // RBAC enforcement (use GET /admin/products/:id as probe)
  // -----------------------------------------------------------------------

  describe("RBAC enforcement", () => {
    it("returns 401 without authentication", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/products/prod-1",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for CLIENT role", async () => {
      const token = await signToken(app, "CLIENT");
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/products/prod-1",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it("allows ADMIN role", async () => {
      const token = await signToken(app, "ADMIN");
      (app.prisma.product.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        PRODUCT_FIXTURE,
      );

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/products/prod-1",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("allows MANAGER role", async () => {
      const token = await signToken(app, "MANAGER");
      (app.prisma.product.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        PRODUCT_FIXTURE,
      );

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/products/prod-1",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Product CRUD
  // -----------------------------------------------------------------------

  describe("POST /admin/products — Create", () => {
    it("creates a product with valid data", async () => {
      const token = await signToken(app, "ADMIN");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/products",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: "Ninebot Max G2",
          sku: "NB-MAX-G2",
          priceHt: 599.99,
          status: "DRAFT",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });

    it("rejects duplicate SKU", async () => {
      const token = await signToken(app, "ADMIN");
      (app.prisma.product.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // slug check → no conflict
        .mockResolvedValueOnce(PRODUCT_FIXTURE); // SKU check → conflict

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/products",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Duplicate", sku: "TROTT-001", priceHt: 199.99 },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("DUPLICATE_SKU");
    });

    it("rejects missing required fields", async () => {
      const token = await signToken(app, "ADMIN");

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/products",
        headers: { authorization: `Bearer ${token}` },
        payload: { sku: "TEST", priceHt: 100 }, // missing name
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("PUT /admin/products/:id — Update", () => {
    it("updates an existing product", async () => {
      const token = await signToken(app, "ADMIN");
      (app.prisma.product.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        PRODUCT_FIXTURE,
      );

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/products/prod-1",
        headers: { authorization: `Bearer ${token}` },
        payload: { priceHt: 449.99 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("returns 404 for non-existent product", async () => {
      const token = await signToken(app, "ADMIN");

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/products/non-existent",
        headers: { authorization: `Bearer ${token}` },
        payload: { priceHt: 100 },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /admin/products/:id — Archive", () => {
    it("archives a product", async () => {
      const token = await signToken(app, "ADMIN");
      (app.prisma.product.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        PRODUCT_FIXTURE,
      );

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/products/prod-1",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Stock management
  // -----------------------------------------------------------------------

  describe("PATCH /admin/products/:id/stock", () => {
    it("updates default variant stock", async () => {
      const token = await signToken(app, "ADMIN");

      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/products/prod-1/stock",
        headers: { authorization: `Bearer ${token}` },
        payload: { quantity: 25 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("returns 404 when no active variant exists", async () => {
      const token = await signToken(app, "ADMIN");
      (app.prisma.productVariant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/products/prod-1/stock",
        headers: { authorization: `Bearer ${token}` },
        payload: { quantity: 10 },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("NO_VARIANT");
    });
  });

  // -----------------------------------------------------------------------
  // Bulk operations
  // -----------------------------------------------------------------------

  describe("PATCH /admin/products/bulk-status", () => {
    it("updates status for multiple products", async () => {
      const token = await signToken(app, "ADMIN");

      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/products/bulk-status",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          productIds: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"],
          status: "ARCHIVED",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });
});
