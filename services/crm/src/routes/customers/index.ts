import type { FastifyInstance } from "fastify";
import { z } from "zod";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  loyaltyTier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).optional(),
  sort: z.enum(["newest", "name", "points_desc", "last_active"]).default("newest"),
});

const addPointsSchema = z.object({
  points: z.number().int().positive(),
  reason: z.string().min(1).max(255),
  orderId: z.string().uuid().optional(),
});

export async function customerRoutes(app: FastifyInstance) {
  // GET /api/v1/customers — Liste paginée avec recherche et filtre fidélité
  app.get("/customers", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { page, limit, search, loyaltyTier, sort } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (loyaltyTier) where.loyaltyTier = loyaltyTier;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, string> = {};
    switch (sort) {
      case "name": orderBy.lastName = "asc"; break;
      case "points_desc": orderBy.loyaltyPoints = "desc"; break;
      case "last_active": orderBy.lastLoginAt = "desc"; break;
      default: orderBy.createdAt = "desc";
    }

    const [customers, total] = await Promise.all([
      app.prisma.user.findMany({
        where: where as any,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          loyaltyTier: true,
          loyaltyPoints: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: orderBy as any,
        skip,
        take: limit,
      }),
      app.prisma.user.count({ where: where as any }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  });

  // GET /api/v1/customers/:id — Profil 360° (user + profile + interactions + loyalty)
  app.get("/customers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const customer = await app.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        addresses: { where: { isActive: true }, orderBy: { isDefault: "desc" } },
        orders: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalTtc: true,
            createdAt: true,
          },
        },
        interactions: {
          take: 20,
          orderBy: { createdAt: "desc" },
        },
        loyaltyTransactions: {
          take: 20,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!customer) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Client '${id}' introuvable` },
      });
    }

    return { success: true, data: customer };
  });

  // GET /api/v1/customers/:id/timeline — Historique des interactions
  app.get("/customers/:id/timeline", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    }).parse(request.query);

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const userExists = await app.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!userExists) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Client '${id}' introuvable` },
      });
    }

    const [interactions, total] = await Promise.all([
      app.prisma.interaction.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      app.prisma.interaction.count({ where: { userId: id } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: interactions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  });

  // POST /api/v1/customers/:id/loyalty/add — Ajouter des points de fidélité
  app.post("/customers/:id/loyalty/add", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = addPointsSchema.parse(request.body);

    const customer = await app.prisma.user.findUnique({
      where: { id },
      select: { id: true, loyaltyPoints: true },
    });

    if (!customer) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Client '${id}' introuvable` },
      });
    }

    const [updatedUser, transaction] = await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id },
        data: { loyaltyPoints: { increment: body.points } },
        select: { id: true, loyaltyPoints: true, loyaltyTier: true },
      }),
      app.prisma.loyaltyTransaction.create({
        data: {
          userId: id,
          points: body.points,
          type: "EARN",
          reason: body.reason,
          orderId: body.orderId ?? null,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        customer: updatedUser,
        transaction,
      },
    };
  });
}
