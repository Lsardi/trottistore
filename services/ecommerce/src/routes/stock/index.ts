import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { notifyBackInStock } from "../../lib/back-in-stock.js";

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

const inventoryCountSchema = z.object({
  counts: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        counted: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(500),
  reason: z.string().max(500).optional(),
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
  // All stock routes require authentication
  app.addHook("onRequest", async (request, reply) => {
    await app.authenticate(request, reply);
  });

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

      // F2 fix: atomic stock update with WHERE guard (prevents race between read and write)
      if (isIncoming) {
        await tx.productVariant.update({
          where: { id: body.variantId },
          data: { stockQuantity: { increment: Math.abs(body.quantity) } },
        });
      } else {
        const result = await tx.productVariant.updateMany({
          where: { id: body.variantId, stockQuantity: { gte: Math.abs(body.quantity) } },
          data: { stockQuantity: { decrement: Math.abs(body.quantity) } },
        });
        if (result.count === 0) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }

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

    // T-37: notify customers waiting for this product when it comes back in stock.
    if (result.stockAfter > 0 && result.movement.quantity > 0) {
      notifyBackInStock(app, body.variantId);
    }

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

  // GET /stock/movements — List stock movements with filters (staff only)
  app.get("/stock/movements", async (request, reply) => {
    const user = getRequestUser(request);
    if (!user || user.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Acces reserve au staff" },
      });
    }
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

  // GET /stock/alerts — Products below low stock threshold (staff only)
  app.get("/stock/alerts", async (request, reply) => {
    const user = getRequestUser(request);
    if (!user || user.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Acces reserve au staff" },
      });
    }
    const query = alertsQuerySchema.parse(request.query);

    const alerts = await app.prisma.$queryRaw<
      Array<{
        id: string;
        sku: string;
        name: string;
        stock_quantity: number;
        low_stock_threshold: number;
        product_id: string;
        product_slug: string;
        product_name: string;
        primary_supplier_id: string | null;
        supplier_name: string | null;
      }>
    >`
      SELECT
        pv.id,
        pv.sku,
        pv.name,
        pv.stock_quantity,
        pv.low_stock_threshold,
        p.id as product_id,
        p.slug as product_slug,
        p.name as product_name,
        p.primary_supplier_id,
        s.name as supplier_name
      FROM ecommerce.product_variants pv
      JOIN ecommerce.products p ON p.id = pv.product_id
      LEFT JOIN ecommerce.suppliers s ON s.id = p.primary_supplier_id
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
        productId: a.product_id,
        productSlug: a.product_slug,
        productName: a.product_name,
        primarySupplierId: a.primary_supplier_id,
        primarySupplierName: a.supplier_name,
        stockQuantity: a.stock_quantity,
        lowStockThreshold: a.low_stock_threshold,
        severity: a.stock_quantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
      })),
      count: alerts.length,
    };
  });

  // GET /stock/movements/summary — Aggregated movement stats per variant (staff only)
  app.get("/stock/movements/summary", async (request, reply) => {
    const user = getRequestUser(request);
    if (!user || user.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Acces reserve au staff" },
      });
    }
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

  // POST /stock/inventory — comptage physique: aligne le stock sur le compté,
  // trace chaque écart comme IN_/OUT_ADJUSTMENT (référence INVENTORY).
  // Idempotent par nature : recompter la même valeur ne produit aucun mouvement.
  app.post("/stock/inventory", async (request, reply) => {
    const user = getRequestUser(request);
    if (!user || !["SUPERADMIN", "ADMIN", "MANAGER", "STAFF"].includes(user.role)) {
      return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Accès réservé au personnel" } });
    }
    const parsed = inventoryCountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid inventory payload", details: parsed.error.flatten().fieldErrors },
      });
    }
    const inventoryRef = `INV-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;

    const adjustments = await app.prisma.$transaction(async (tx) => {
      const out: Array<{ variantId: string; sku: string; before: number; counted: number; delta: number; belowReserved: boolean }> = [];
      for (const line of parsed.data.counts) {
        const variant = await tx.productVariant.findUnique({
          where: { id: line.variantId },
          select: { id: true, sku: true, stockQuantity: true, stockReserved: true },
        });
        if (!variant) {
          throw Object.assign(new Error(`Variante ${line.variantId} introuvable`), { statusCode: 404, code: "VARIANT_NOT_FOUND" });
        }
        const delta = line.counted - variant.stockQuantity;
        if (delta === 0) continue;
        // Conditional on the value we read: a concurrent sale between read and
        // write must not be silently overwritten by the count.
        const applied = await tx.productVariant.updateMany({
          where: { id: variant.id, stockQuantity: variant.stockQuantity },
          data: { stockQuantity: line.counted },
        });
        if (applied.count !== 1) {
          throw Object.assign(new Error(`Stock de ${variant.sku} modifié pendant le comptage, recomptez`), {
            statusCode: 409,
            code: "STOCK_CHANGED",
          });
        }
        await tx.stockMovement.create({
          data: {
            variantId: variant.id,
            type: delta > 0 ? "IN_ADJUSTMENT" : "OUT_ADJUSTMENT",
            quantity: delta,
            reason: parsed.data.reason ?? "Inventaire",
            referenceId: inventoryRef,
            referenceType: "INVENTORY",
            performedBy: user.userId,
            stockBefore: variant.stockQuantity,
            stockAfter: line.counted,
          },
        });
        out.push({
          variantId: variant.id,
          sku: variant.sku,
          before: variant.stockQuantity,
          counted: line.counted,
          delta,
          belowReserved: line.counted < variant.stockReserved,
        });
      }
      return out;
    }).catch((err: { statusCode?: number; code?: string; message?: string }) => {
      if (err.statusCode && err.statusCode < 500) {
        return reply.status(err.statusCode).send({ success: false, error: { code: err.code ?? "ERROR", message: err.message ?? "" } });
      }
      throw err;
    });
    if (!adjustments || !Array.isArray(adjustments)) return adjustments;

    app.log.info({ inventoryRef, counted: parsed.data.counts.length, adjusted: adjustments.length, userId: user.userId }, "Inventory count applied");
    for (const a of adjustments) if (a.before <= 0 && a.counted > 0) notifyBackInStock(app, a.variantId);

    return reply.status(201).send({
      success: true,
      data: {
        inventoryRef,
        counted: parsed.data.counts.length,
        adjusted: adjustments.length,
        adjustments,
        warnings: adjustments.filter((a) => a.belowReserved).map((a) => `${a.sku}: compté ${a.counted} < réservé`),
      },
    });
  });
}
