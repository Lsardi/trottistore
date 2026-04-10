/**
 * Integration tests for review routes.
 *
 * Covers: public listing, stats, product reviews, submission (auth, duplicate,
 * verified purchase), admin moderation, and loyalty points on approval.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { reviewRoutes } from "./index.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REVIEW_FIXTURE = {
  id: "review-1",
  rating: 5,
  title: "Excellent produit",
  content: "Très satisfait de ma trottinette, fonctionne parfaitement.",
  serviceTag: "Achat",
  verifiedPurchase: true,
  status: "APPROVED",
  createdAt: new Date(),
  user: { firstName: "Alice", lastName: "D." },
  product: { name: "Xiaomi Pro 2", slug: "xiaomi-pro-2" },
};

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    review: {
      findMany: vi.fn().mockResolvedValue([REVIEW_FIXTURE]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(REVIEW_FIXTURE),
      update: vi.fn().mockResolvedValue(REVIEW_FIXTURE),
      aggregate: vi.fn().mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { id: 12 },
      }),
    },
    product: {
      findUnique: vi.fn().mockResolvedValue({ id: "prod-1" }),
    },
    order: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    customerProfile: {
      findUnique: vi.fn().mockResolvedValue({ id: "profile-1", loyaltyPoints: 100 }),
      update: vi.fn().mockResolvedValue(null),
    },
    loyaltyPoint: {
      create: vi.fn().mockResolvedValue(null),
    },
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

async function signToken(app: FastifyInstance, role = "CLIENT", userId = "user-1"): Promise<string> {
  return app.jwt.sign({ sub: userId, email: "test@test.com", role });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Review routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(reviewRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Public endpoints
  // -----------------------------------------------------------------------

  describe("GET /reviews", () => {
    it("returns approved reviews with pagination", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/reviews" });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.pagination).toBeDefined();
    });
  });

  describe("GET /reviews/stats", () => {
    it("returns aggregate rating stats", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/reviews/stats" });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.averageRating).toBe(4.5);
      expect(json.data.totalReviews).toBe(12);
    });
  });

  describe("GET /products/:slug/reviews", () => {
    it("returns reviews for a product", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/products/xiaomi-pro-2/reviews",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().stats).toBeDefined();
    });

    it("returns empty when product not found", async () => {
      (app.prisma.product.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/products/unknown/reviews",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Submission
  // -----------------------------------------------------------------------

  describe("POST /reviews", () => {
    it("returns 401 without authentication", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: { rating: 5, content: "Super produit, je recommande !" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("creates a review with auth", async () => {
      const token = await signToken(app);
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          rating: 5,
          content: "Super produit, je recommande !",
          serviceTag: "Achat",
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });

    it("rejects duplicate review for same product", async () => {
      const token = await signToken(app);
      (app.prisma.review.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(REVIEW_FIXTURE);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          productId: "00000000-0000-0000-0000-000000000001",
          rating: 4,
          content: "Deuxième avis sur le même produit.",
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("DUPLICATE_REVIEW");
    });

    it("rejects too-short content", async () => {
      const token = await signToken(app);
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        headers: { authorization: `Bearer ${token}` },
        payload: { rating: 3, content: "Bof" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Admin moderation
  // -----------------------------------------------------------------------

  describe("PUT /admin/reviews/:id", () => {
    it("returns 403 for CLIENT role", async () => {
      const token = await signToken(app, "CLIENT");
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/reviews/review-1",
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "APPROVED" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("approves a review as ADMIN", async () => {
      const token = await signToken(app, "ADMIN");
      (app.prisma.review.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...REVIEW_FIXTURE,
        status: "PENDING",
        userId: "user-1",
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/reviews/review-1",
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "APPROVED" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      // Should award loyalty points
      expect(app.prisma.loyaltyPoint.create).toHaveBeenCalledOnce();
    });

    it("returns 404 for non-existent review", async () => {
      const token = await signToken(app, "ADMIN");
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/reviews/non-existent",
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "REJECTED" },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
