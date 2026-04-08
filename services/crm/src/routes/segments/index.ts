import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseIdParam } from "@trottistore/shared";

const segmentCriteriaSchema = z.object({
  loyaltyTier: z.enum(["BRONZE", "SILVER", "GOLD"]).optional(),
  minSpent: z.number().optional(),
  maxSpent: z.number().optional(),
  minOrders: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  lastOrderDaysAgo: z.number().int().optional(),
});

const createSegmentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  criteria: segmentCriteriaSchema,
});

/**
 * Build a Prisma where clause for CustomerProfile from segment criteria JSON.
 */
type SegmentCriteria = z.infer<typeof segmentCriteriaSchema>;

function buildProfileWhere(criteria: SegmentCriteria) {
  const where: {
    loyaltyTier?: "BRONZE" | "SILVER" | "GOLD";
    totalSpent?: { gte?: number; lte?: number };
    totalOrders?: { gte: number };
    tags?: { hasSome: string[] };
    lastOrderAt?: { gte: Date };
  } = {};

  if (criteria.loyaltyTier) {
    where.loyaltyTier = criteria.loyaltyTier;
  }

  if (criteria.minSpent !== undefined || criteria.maxSpent !== undefined) {
    where.totalSpent = {};
    if (criteria.minSpent !== undefined) where.totalSpent.gte = criteria.minSpent;
    if (criteria.maxSpent !== undefined) where.totalSpent.lte = criteria.maxSpent;
  }

  if (criteria.minOrders !== undefined) {
    where.totalOrders = { gte: criteria.minOrders };
  }

  if (Array.isArray(criteria.tags) && criteria.tags.length > 0) {
    where.tags = { hasSome: criteria.tags };
  }

  if (criteria.lastOrderDaysAgo !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - criteria.lastOrderDaysAgo);
    where.lastOrderAt = { gte: cutoff };
  }

  return where;
}

export async function segmentRoutes(app: FastifyInstance) {
  // ───────────────────────────────────────────────────────────
  // GET /segments — List all segments with count
  // ───────────────────────────────────────────────────────────
  app.get("/segments", async (_request, _reply) => {
    const segments = await app.prisma.customerSegment.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: segments };
  });

  // ───────────────────────────────────────────────────────────
  // POST /segments — Create a new segment
  // ───────────────────────────────────────────────────────────
  app.post("/segments", async (request, _reply) => {
    const body = createSegmentSchema.parse(request.body);

    // Initial count evaluation
    const where = buildProfileWhere(body.criteria);
    const count = await app.prisma.customerProfile.count({ where });

    const segment = await app.prisma.customerSegment.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        criteria: body.criteria,
        count,
        isAutomatic: true,
      },
    });

    return { success: true, data: segment };
  });

  // ───────────────────────────────────────────────────────────
  // POST /segments/:id/evaluate — Re-evaluate segment count
  // ───────────────────────────────────────────────────────────
  app.post("/segments/:id/evaluate", async (request, reply) => {
    const id = parseIdParam(request.params);

    const segment = await app.prisma.customerSegment.findUnique({
      where: { id },
    });

    if (!segment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Segment '${id}' introuvable` },
      });
    }

    const parsedCriteria = segmentCriteriaSchema.safeParse(segment.criteria);
    if (!parsedCriteria.success) {
      return reply.status(500).send({
        success: false,
        error: {
          code: "INVALID_SEGMENT_CRITERIA",
          message: "Le segment contient des critères invalides",
        },
      });
    }

    const criteria = parsedCriteria.data;
    const where = buildProfileWhere(criteria);
    const count = await app.prisma.customerProfile.count({ where });

    await app.prisma.customerSegment.update({
      where: { id },
      data: { count },
    });

    return { success: true, data: { count } };
  });
}
