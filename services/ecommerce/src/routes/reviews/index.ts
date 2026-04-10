/**
 * Review routes — customer reviews for products and services.
 *
 * Public: GET /reviews, GET /products/:slug/reviews
 * Auth required: POST /reviews
 * Admin: PUT /admin/reviews/:id (moderation)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseIdParam } from "@trottistore/shared";
import { requireRole } from "../../plugins/auth.js";

// ─── Validation schemas ──────────────────────────────────

const createReviewSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  content: z.string().min(10, "L'avis doit contenir au moins 10 caractères").max(2000),
  serviceTag: z.enum(["Achat", "Réparation", "Pièces", "SAV"]).optional(),
});

const moderateReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminNote: z.string().max(500).optional(),
});

// ─── Routes ──────────────────────────────────────────────

export async function reviewRoutes(app: FastifyInstance) {
  // GET /reviews — Public list of approved reviews
  app.get("/reviews", async (request) => {
    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      app.prisma.review.findMany({
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          serviceTag: true,
          verifiedPurchase: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
          product: { select: { name: true, slug: true } },
        },
      }),
      app.prisma.review.count({ where: { status: "APPROVED" } }),
    ]);

    return {
      success: true,
      data: reviews,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // GET /reviews/stats — Aggregate rating stats
  app.get("/reviews/stats", async () => {
    const stats = await app.prisma.review.aggregate({
      where: { status: "APPROVED" },
      _avg: { rating: true },
      _count: { id: true },
    });

    return {
      success: true,
      data: {
        averageRating: Math.round((stats._avg.rating || 0) * 10) / 10,
        totalReviews: stats._count.id,
      },
    };
  });

  // GET /products/:slug/reviews — Reviews for a specific product
  app.get("/products/:slug/reviews", async (request) => {
    const { slug } = request.params as { slug: string };

    const product = await app.prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!product) {
      return { success: true, data: [], stats: { averageRating: 0, totalReviews: 0 } };
    }

    const [reviews, stats] = await Promise.all([
      app.prisma.review.findMany({
        where: { productId: product.id, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          verifiedPurchase: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      app.prisma.review.aggregate({
        where: { productId: product.id, status: "APPROVED" },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    return {
      success: true,
      data: reviews,
      stats: {
        averageRating: Math.round((stats._avg.rating || 0) * 10) / 10,
        totalReviews: stats._count.id,
      },
    };
  });

  // POST /reviews — Submit a review (auth required)
  app.post(
    "/reviews",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const parsed = createReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Données invalides",
            details: parsed.error.flatten().fieldErrors,
          },
        });
      }

      // Check for duplicate review
      if (parsed.data.productId) {
        // 1 review per product per user
        const existing = await app.prisma.review.findUnique({
          where: {
            userId_productId: {
              userId,
              productId: parsed.data.productId,
            },
          },
        });

        if (existing) {
          return reply.status(409).send({
            success: false,
            error: {
              code: "DUPLICATE_REVIEW",
              message: "Vous avez déjà laissé un avis pour ce produit",
            },
          });
        }
      } else {
        // General review (no product): limit to 1 per serviceTag per user
        const tag = parsed.data.serviceTag ?? "general";
        const existingGeneral = await app.prisma.review.findFirst({
          where: {
            userId,
            productId: null,
            serviceTag: tag === "general" ? null : tag,
          },
        });

        if (existingGeneral) {
          return reply.status(409).send({
            success: false,
            error: {
              code: "DUPLICATE_REVIEW",
              message: "Vous avez déjà laissé un avis général pour ce service",
            },
          });
        }
      }

      // Check if user has purchased this product (verified purchase)
      let verifiedPurchase = false;
      if (parsed.data.productId) {
        const order = await app.prisma.order.findFirst({
          where: {
            customerId: userId,
            status: { in: ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"] },
            items: { some: { productId: parsed.data.productId } },
          },
          select: { id: true },
        });
        verifiedPurchase = !!order;
      }

      const review = await app.prisma.review.create({
        data: {
          userId,
          productId: parsed.data.productId ?? null,
          rating: parsed.data.rating,
          title: parsed.data.title ?? null,
          content: parsed.data.content,
          serviceTag: parsed.data.serviceTag ?? null,
          verifiedPurchase,
          status: "PENDING", // Requires moderation
        },
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          serviceTag: true,
          verifiedPurchase: true,
          status: true,
          createdAt: true,
        },
      });

      return reply.status(201).send({ success: true, data: review });
    },
  );

  // PUT /admin/reviews/:id — Moderate a review (approve/reject)
  app.put(
    "/admin/reviews/:id",
    { preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN", "MANAGER")] },
    async (request, reply) => {
      const id = parseIdParam(request.params);

      const parsed = moderateReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Données invalides" },
        });
      }

      const existing = await app.prisma.review.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Avis introuvable" },
        });
      }

      const review = await app.prisma.review.update({
        where: { id },
        data: {
          status: parsed.data.status,
          adminNote: parsed.data.adminNote ?? null,
        },
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          status: true,
          adminNote: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      });

      // Award loyalty points on approval
      if (parsed.data.status === "APPROVED" && existing.status !== "APPROVED") {
        try {
          const profile = await app.prisma.customerProfile.findUnique({
            where: { userId: existing.userId },
          });
          if (profile) {
            await app.prisma.loyaltyPoint.create({
              data: {
                profileId: profile.id,
                points: 10,
                type: "REVIEW",
                referenceId: id,
                description: "Avis approuvé — merci pour votre retour !",
              },
            });
            await app.prisma.customerProfile.update({
              where: { id: profile.id },
              data: { loyaltyPoints: { increment: 10 } },
            });
          }
        } catch (err) {
          app.log.error({ err, reviewId: id }, "Failed to award review loyalty points");
        }
      }

      return { success: true, data: review };
    },
  );

  // GET /admin/reviews — List all reviews for moderation
  app.get(
    "/admin/reviews",
    { preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN", "MANAGER")] },
    async (request) => {
      const query = request.query as { status?: string; page?: string; limit?: string };
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const where = query.status ? { status: query.status } : {};

      const [reviews, total] = await Promise.all([
        app.prisma.review.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            rating: true,
            title: true,
            content: true,
            status: true,
            serviceTag: true,
            verifiedPurchase: true,
            adminNote: true,
            createdAt: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            product: { select: { name: true, slug: true } },
          },
        }),
        app.prisma.review.count({ where }),
      ]);

      return {
        success: true,
        data: reviews,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    },
  );
}
