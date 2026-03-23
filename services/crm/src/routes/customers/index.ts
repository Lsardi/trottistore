import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  loyaltyTier: z.enum(["BRONZE", "SILVER", "GOLD"]).optional(),
  tags: z.string().optional(), // comma-separated
  minSpent: z.coerce.number().optional(),
  maxSpent: z.coerce.number().optional(),
  source: z.string().optional(),
  sort: z
    .enum(["newest", "name", "points_desc", "last_active", "total_spent"])
    .default("newest"),
});

const timelineQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  type: z
    .enum(["EMAIL", "CALL", "VISIT", "SMS", "NOTE", "ORDER", "SAV"])
    .optional(),
});

const addPointsSchema = z.object({
  points: z.number().int().positive(),
  reason: z.string().min(1).max(255),
  type: z.string().optional(),
  referenceId: z.string().optional(),
});

const createInteractionSchema = z.object({
  type: z.enum(["EMAIL", "CALL", "VISIT", "SMS", "NOTE", "ORDER", "SAV"]),
  channel: z.string().optional(),
  subject: z.string().max(300).optional(),
  content: z.string().optional(),
  referenceId: z.string().max(100).optional(),
});

/**
 * Determine loyalty tier from points total.
 */
function computeLoyaltyTier(points: number): string {
  if (points >= 2000) return "GOLD";
  if (points >= 500) return "SILVER";
  return "BRONZE";
}

export async function customerRoutes(app: FastifyInstance) {
  // ───────────────────────────────────────────────────────────
  // GET /customers — Paginated list with filters
  // ───────────────────────────────────────────────────────────
  app.get("/customers", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { page, limit, search, loyaltyTier, tags, minSpent, maxSpent, source, sort } = query;
    const skip = (page - 1) * limit;

    // Build CustomerProfile where clause
    const profileWhere: Prisma.CustomerProfileWhereInput = {};
    if (loyaltyTier) profileWhere.loyaltyTier = loyaltyTier;
    if (source) profileWhere.source = source;
    if (minSpent !== undefined || maxSpent !== undefined) {
      profileWhere.totalSpent = {};
      if (minSpent !== undefined) profileWhere.totalSpent.gte = minSpent;
      if (maxSpent !== undefined) profileWhere.totalSpent.lte = maxSpent;
    }
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        profileWhere.tags = { hasSome: tagList };
      }
    }

    // Build User where clause — search across name/email
    const userWhere: Prisma.UserWhereInput = {
      customerProfile: profileWhere,
    };

    if (search) {
      userWhere.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    // Build orderBy — some sorts are on the profile relation
    let orderBy: Prisma.UserOrderByWithRelationInput;
    switch (sort) {
      case "name":
        orderBy = { lastName: "asc" };
        break;
      case "points_desc":
        orderBy = { customerProfile: { loyaltyPoints: "desc" } };
        break;
      case "last_active":
        orderBy = { lastLoginAt: "desc" };
        break;
      case "total_spent":
        orderBy = { customerProfile: { totalSpent: "desc" } };
        break;
      default:
        orderBy = { createdAt: "desc" };
    }

    const [customers, total] = await Promise.all([
      app.prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          lastLoginAt: true,
          createdAt: true,
          customerProfile: {
            select: {
              loyaltyTier: true,
              loyaltyPoints: true,
              totalOrders: true,
              totalSpent: true,
              source: true,
              tags: true,
              healthScore: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      app.prisma.user.count({ where: userWhere }),
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

  // ───────────────────────────────────────────────────────────
  // GET /customers/:id — Full 360-degree profile
  // ───────────────────────────────────────────────────────────
  app.get("/customers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const customer = await app.prisma.user.findUnique({
      where: { id },
      include: {
        customerProfile: {
          include: {
            loyaltyLog: {
              take: 10,
              orderBy: { createdAt: "desc" },
            },
          },
        },
        addresses: {
          orderBy: { isDefault: "desc" },
        },
        orders: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalTtc: true,
            createdAt: true,
          },
        },
        interactions: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            channel: true,
            subject: true,
            content: true,
            referenceId: true,
            createdAt: true,
          },
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

  // ───────────────────────────────────────────────────────────
  // GET /customers/:id/timeline — Paginated interaction history
  // ───────────────────────────────────────────────────────────
  app.get("/customers/:id/timeline", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = timelineQuerySchema.parse(request.query);
    const { page, limit, type } = query;
    const skip = (page - 1) * limit;

    // Verify customer exists
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

    const where: Prisma.CustomerInteractionWhereInput = { customerId: id };
    if (type) where.type = type;

    const [interactions, total] = await Promise.all([
      app.prisma.customerInteraction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      app.prisma.customerInteraction.count({ where }),
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

  // ───────────────────────────────────────────────────────────
  // POST /customers/:id/loyalty/add — Add loyalty points
  // ───────────────────────────────────────────────────────────
  app.post("/customers/:id/loyalty/add", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = addPointsSchema.parse(request.body);

    // Ensure profile exists
    const profile = await app.prisma.customerProfile.findUnique({
      where: { userId: id },
      select: { id: true, loyaltyPoints: true, loyaltyTier: true },
    });

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Profil client '${id}' introuvable` },
      });
    }

    const newTotal = profile.loyaltyPoints + body.points;
    const newTier = computeLoyaltyTier(newTotal);

    const [updatedProfile, loyaltyRecord] = await app.prisma.$transaction([
      app.prisma.customerProfile.update({
        where: { userId: id },
        data: {
          loyaltyPoints: { increment: body.points },
          loyaltyTier: newTier,
        },
        select: {
          id: true,
          userId: true,
          loyaltyTier: true,
          loyaltyPoints: true,
          totalOrders: true,
          totalSpent: true,
        },
      }),
      app.prisma.loyaltyPoint.create({
        data: {
          profileId: profile.id,
          points: body.points,
          type: body.type ?? "ADJUSTMENT",
          referenceId: body.referenceId ?? null,
          description: body.reason,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        profile: updatedProfile,
        transaction: loyaltyRecord,
      },
    };
  });

  // ───────────────────────────────────────────────────────────
  // POST /customers/:id/interactions — Create interaction
  // ───────────────────────────────────────────────────────────
  app.post("/customers/:id/interactions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createInteractionSchema.parse(request.body);

    // Verify customer exists
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

    const interaction = await app.prisma.customerInteraction.create({
      data: {
        customerId: id,
        type: body.type,
        channel: body.channel ?? "MANUAL",
        subject: body.subject ?? null,
        content: body.content ?? null,
        referenceId: body.referenceId ?? null,
      },
    });

    return { success: true, data: interaction };
  });
}
