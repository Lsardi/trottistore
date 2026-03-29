import type { FastifyInstance } from "fastify";
import { z } from "zod";

// --- Zod Schemas ---

const movementTypeEnum = z.enum([
  "IN_PURCHASE",
  "IN_RETURN",
  "IN_ADJUSTMENT",
  "OUT_SALE",
  "OUT_REPAIR",
  "OUT_ADJUSTMENT",
  "OUT_LOSS",
]);

const createMovementSchema = z.object({
  variantId: z.string().uuid(),
  type: movementTypeEnum,
  quantity: z.number().int().refine((n) => n !== 0, "Quantity cannot be zero"),
  reason: z.string().max(500).optional(),
  referenceId: z.string().max(100).optional(),
  referenceType: z.enum(["ORDER", "REPAIR_TICKET", "MANUAL"]).optional(),
});

const listMovementsSchema = z.object({
  variantId: z.string().uuid().optional(),
  type: movementTypeEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const alertsQuerySchema = z.object({
  threshold: z.coerce.number().int().optional(),
});

type RequestUser = { userId: string; role: string };

function getRequestUser(request: { user?: unknown }): RequestUser | undefined {
  const user = request.user as Partial<RequestUser> | undefined;
  if (!user) return undefined;
  if (typeof user.userId !== "string" || typeof user.role !== "string") return undefined;
  return { userId: user.userId, role: user.role };
}

// --- Routes ---

export async function stockRoutes(app: FastifyInstance) {
  // POST /stock/movements — Record a stock movement (atomic)
  app.post("/stock/movements", async (request, reply) => {
    const user = getRequestUser(request);
    if (!user || user.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Acces reserve au staff" },
      });
    }

    const body = createMovementSchema.parse(request.body);

    // Determine signed quantity: IN types are positive, OUT types are negative
    const isIncoming = body.type.startsWith("IN_");
    const signedQty = isIncoming ? Math.abs(body.quantity) : -Math.abs(body.quantity);

    const result = await app.prisma.$transaction(async (tx) => {
      // Lock the variant row for update
      const variant = await tx.productVariant.findUnique({
        where: { id: body.variantId },
        select: { id: true, stockQuantity: true, lowStockThreshold: true, sku: true, name: true },
      });

      if (!variant) {
        throw new Error("VARIANT_NOT_FOUND");
      }

      const stockBefore = variant.stockQuantity;
      const stockAfter = stockBefore + signedQty;

      // Prevent negative stock on outgoing movements
      if (stockAfter < 0) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // Update stock
      await tx.productVariant.update({
        where: { id: body.variantId },
        data: { stockQuantity: stockAfter },
      });

      // Record movement
      const movement = await tx.stockMovement.create({
        data: {
          variantId: body.variantId,
          type: body.type,
          quantity: signedQty,
          reason: body.reason ?? null,
          referenceId: body.referenceId ?? null,
          referenceType: body.referenceType ?? null,
          performedBy: user.userId,
          stockBefore,
          stockAfter,
        },
      });

      return { movement, variant, stockAfter, isAlert: stockAfter <= variant.lowStockThreshold && stockAfter > 0 };
    }).catch((err: Error) => {
      if (err.message === "VARIANT_NOT_FOUND") {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Variante produit introuvable" },
        });
      }
      if (err.message === "INSUFFICIENT_STOCK") {
        return reply.status(400).send({
          success: false,
          error: { code: "INSUFFICIENT_STOCK", message: "Stock insuffisant pour cette sortie" },
        });
      }
      throw err;
    });

    if (!result || "statusCode" in result) return result;

    return reply.status(201).send({
      success: true,
      data: {
        movement: result.movement,
        stockAfter: result.stockAfter,
        alert: result.isAlert ? {
          type: "LOW_STOCK",
          message: `${result.variant.name} (${result.variant.sku}): stock a ${result.stockAfter} unites`,
        } : null,
      },
    });
  });

  // GET /stock/movements — List stock movements with filters
  app.get("/stock/movements", async (request) => {
    const user = getRequestUser(request);
    const query = listMovementsSchema.parse(request.query);

    const where: Record<string, unknown> = {};
    if (query.variantId) where.variantId = query.variantId;
    if (query.type) where.type = query.type;

    const [movements, total] = await Promise.all([
      app.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          variant: {
            select: { id: true, sku: true, name: true, stockQuantity: true },
          },
        },
      }),
      app.prisma.stockMovement.count({ where }),
    ]);

    return {
      success: true,
      data: movements,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  });

  // GET /stock/alerts — Products below low stock threshold
  app.get("/stock/alerts", async (request) => {
    const query = alertsQuerySchema.parse(request.query);

    const alerts = await app.prisma.$queryRaw<
      Array<{
        id: string;
        sku: string;
        name: string;
        stock_quantity: number;
        low_stock_threshold: number;
        product_name: string;
      }>
    >`
      SELECT
        pv.id,
        pv.sku,
        pv.name,
        pv.stock_quantity,
        pv.low_stock_threshold,
        p.name as product_name
      FROM ecommerce.product_variants pv
      JOIN ecommerce.products p ON p.id = pv.product_id
      WHERE pv.is_active = true
        AND pv.stock_quantity <= ${query.threshold ?? 0} + pv.low_stock_threshold
      ORDER BY pv.stock_quantity ASC
    `;

    return {
      success: true,
      data: alerts.map((a) => ({
        variantId: a.id,
        sku: a.sku,
        variantName: a.name,
        productName: a.product_name,
        stockQuantity: a.stock_quantity,
        lowStockThreshold: a.low_stock_threshold,
        severity: a.stock_quantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
      })),
      count: alerts.length,
    };
  });

  // GET /stock/movements/summary — Aggregated movement stats per variant
  app.get("/stock/movements/summary", async (request) => {
    const summary = await app.prisma.$queryRaw<
      Array<{
        variant_id: string;
        sku: string;
        name: string;
        total_in: bigint;
        total_out: bigint;
        movement_count: bigint;
        stock_quantity: number;
      }>
    >`
      SELECT
        pv.id as variant_id,
        pv.sku,
        pv.name,
        COALESCE(SUM(CASE WHEN sm.quantity > 0 THEN sm.quantity ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN sm.quantity < 0 THEN ABS(sm.quantity) ELSE 0 END), 0) as total_out,
        COUNT(sm.id) as movement_count,
        pv.stock_quantity
      FROM ecommerce.product_variants pv
      LEFT JOIN ecommerce.stock_movements sm ON sm.variant_id = pv.id
      WHERE pv.is_active = true
      GROUP BY pv.id, pv.sku, pv.name, pv.stock_quantity
      HAVING COUNT(sm.id) > 0
      ORDER BY COUNT(sm.id) DESC
      LIMIT 50
    `;

    return {
      success: true,
      data: summary.map((s) => ({
        variantId: s.variant_id,
        sku: s.sku,
        name: s.name,
        totalIn: Number(s.total_in),
        totalOut: Number(s.total_out),
        movementCount: Number(s.movement_count),
        currentStock: s.stock_quantity,
      })),
    };
  });
}
