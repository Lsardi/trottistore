/**
 * Caisse (point of sale) — counter sales for the shop.
 *
 * A counter sale is an Order with `channel = STORE`, paid on the spot (CASH or
 * CARD_TERMINAL), delivered immediately, attached to the open register
 * session. Stock is decremented in the same transaction as the web checkout so
 * the shop and the site always share one stock figure.
 *
 * Walk-in customers without an account are attached to a single technical
 * "comptoir" user so the Order.customerId constraint holds; a real customer can
 * be attached by id (loyalty, history) when known.
 */
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { requireRole } from "../../plugins/auth.js";

const WALK_IN_EMAIL = "comptoir@trottistore.local";
const STAFF_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER", "STAFF"] as const;

const openSessionSchema = z.object({
  openingCashCents: z.number().int().min(0),
  note: z.string().max(500).optional(),
});

const closeSessionSchema = z.object({
  closingCashCents: z.number().int().min(0),
  note: z.string().max(500).optional(),
});

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive().max(999),
        // Optional manual price override (negotiated discount), HT in euros.
        unitPriceHt: z.number().nonnegative().optional(),
        serialNumbers: z.array(z.string().min(1).max(100)).optional(),
      }),
    )
    .min(1)
    .max(100),
  paymentMethod: z.enum(["CASH", "CARD_TERMINAL", "CHECK"]),
  customerId: z.string().uuid().optional(),
  // Whole-ticket discount in euros HT, applied after line prices.
  discountHt: z.number().nonnegative().optional(),
  // Cash handed over, to compute change for the cashier.
  cashReceivedCents: z.number().int().min(0).optional(),
  note: z.string().max(500).optional(),
});

const lookupSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

type RequestUser = { userId: string; role: string };

function getRequestUser(request: { user?: unknown }): RequestUser | undefined {
  const user = request.user as Partial<RequestUser> | undefined;
  if (!user || typeof user.userId !== "string" || typeof user.role !== "string") return undefined;
  return { userId: user.userId, role: user.role };
}

/** Mapped by the app-level error handler: statusCode + code → { success: false, error }. */
class PosError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PosError";
  }
}

async function getOpenSession(tx: Prisma.TransactionClient) {
  return tx.posSession.findFirst({ where: { status: "OPEN" } });
}

async function ensureWalkInCustomer(tx: Prisma.TransactionClient): Promise<string> {
  const existing = await tx.user.findUnique({ where: { email: WALK_IN_EMAIL }, select: { id: true } });
  if (existing) return existing.id;
  const created = await tx.user.create({
    data: {
      email: WALK_IN_EMAIL,
      // Random, unusable hash: this account can never log in.
      passwordHash: `!walk-in-${Date.now()}`,
      role: "CLIENT",
      status: "ACTIVE",
      emailVerified: false,
      firstName: "Client",
      lastName: "Comptoir",
    },
    select: { id: true },
  });
  return created.id;
}

/** Expected cash at close = opening + cash sales − cash refunds for the session. */
async function computeExpectedCashCents(tx: Prisma.TransactionClient, sessionId: string, openingCashCents: number) {
  const payments = await tx.payment.findMany({
    where: { order: { posSessionId: sessionId }, provider: "pos", status: "CONFIRMED" },
    select: { amount: true, method: true },
  });
  let cents = openingCashCents;
  for (const p of payments) {
    const amountCents = new Decimal(p.amount).mul(100).round().toNumber();
    if (p.method === "CASH") cents += amountCents;
    else if (p.method === "REFUND_CASH") cents -= amountCents;
  }
  return cents;
}

export async function posRoutes(app: FastifyInstance) {
  const staffOnly = { preHandler: [app.authenticate, requireRole(...STAFF_ROLES)] };

  // GET /admin/pos/session — current open register, or null
  app.get("/admin/pos/session", staffOnly, async () => {
    const session = await app.prisma.posSession.findFirst({
      where: { status: "OPEN" },
      include: { _count: { select: { sales: true } } },
    });
    if (!session) return { success: true, data: null };
    const totals = await app.prisma.payment.groupBy({
      by: ["method"],
      where: { order: { posSessionId: session.id }, provider: "pos", status: "CONFIRMED" },
      _sum: { amount: true },
    });
    return {
      success: true,
      data: {
        ...session,
        salesCount: session._count.sales,
        totalsByMethod: Object.fromEntries(totals.map((t) => [t.method, Number(t._sum.amount ?? 0)])),
      },
    };
  });

  // POST /admin/pos/session/open — fond de caisse
  app.post("/admin/pos/session/open", staffOnly, async (request, reply) => {
    const user = getRequestUser(request)!;
    const body = openSessionSchema.parse(request.body);
    try {
      const session = await app.prisma.posSession.create({
        data: { openedBy: user.userId, openingCashCents: body.openingCashCents, note: body.note },
      });
      return reply.status(201).send({ success: true, data: session });
    } catch (err) {
      // Partial unique index: only one OPEN session at a time.
      if ((err as { code?: string }).code === "P2002") {
        return reply.status(409).send({
          success: false,
          error: { code: "SESSION_ALREADY_OPEN", message: "Une caisse est déjà ouverte" },
        });
      }
      throw err;
    }
  });

  // POST /admin/pos/session/close — clôture (Z)
  app.post("/admin/pos/session/close", staffOnly, async (request, reply) => {
    const user = getRequestUser(request)!;
    const body = closeSessionSchema.parse(request.body);
    const result = await app.prisma.$transaction(async (tx) => {
      const session = await getOpenSession(tx);
      if (!session) throw new PosError(409, "NO_OPEN_SESSION", "Aucune caisse ouverte");
      const expectedCashCents = await computeExpectedCashCents(tx, session.id, session.openingCashCents);
      // Conditional close: a concurrent close loses.
      const closed = await tx.posSession.updateMany({
        where: { id: session.id, status: "OPEN" },
        data: {
          status: "CLOSED",
          closedBy: user.userId,
          closedAt: new Date(),
          closingCashCents: body.closingCashCents,
          expectedCashCents,
          note: body.note ?? session.note,
        },
      });
      if (closed.count !== 1) throw new PosError(409, "SESSION_ALREADY_CLOSED", "Caisse déjà clôturée");
      const fresh = await tx.posSession.findUniqueOrThrow({ where: { id: session.id } });
      return { ...fresh, differenceCents: body.closingCashCents - expectedCashCents };
    });
    return { success: true, data: result };
  });

  // GET /admin/pos/lookup?q= — scan or search: barcode, SKU, product name
  app.get("/admin/pos/lookup", staffOnly, async (request) => {
    const { q, limit } = lookupSchema.parse(request.query);
    const exact = await app.prisma.productVariant.findFirst({
      where: { OR: [{ barcode: q }, { sku: q }], isActive: true, product: { status: "ACTIVE" } },
      include: { product: { select: { id: true, name: true, priceHt: true, tvaRate: true, slug: true } } },
    });
    const variants = exact
      ? [exact]
      : await app.prisma.productVariant.findMany({
          where: {
            isActive: true,
            product: { status: "ACTIVE" },
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q } },
              { name: { contains: q, mode: "insensitive" } },
              { product: { name: { contains: q, mode: "insensitive" } } },
            ],
          },
          include: { product: { select: { id: true, name: true, priceHt: true, tvaRate: true, slug: true } } },
          take: limit,
          orderBy: { product: { name: "asc" } },
        });
    return {
      success: true,
      data: variants.map((v) => ({
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        variantName: v.name,
        sku: v.sku,
        barcode: v.barcode,
        unitPriceHt: Number(v.priceOverride ?? v.product.priceHt),
        tvaRate: Number(v.product.tvaRate),
        available: v.stockQuantity - v.stockReserved,
        exactMatch: Boolean(exact),
      })),
    };
  });

  // POST /admin/pos/sales — encaisser une vente comptoir
  app.post("/admin/pos/sales", staffOnly, async (request, reply) => {
    const user = getRequestUser(request)!;
    const body = saleSchema.parse(request.body);

    const result = await app.prisma.$transaction(async (tx) => {
      const session = await getOpenSession(tx);
      if (!session) throw new PosError(409, "NO_OPEN_SESSION", "Ouvrez la caisse avant d'encaisser");

      const variantIds = [...new Set(body.items.map((i) => i.variantId))];
      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds }, isActive: true },
        include: { product: { select: { id: true, name: true, priceHt: true, tvaRate: true, status: true } } },
      });
      const byId = new Map(variants.map((v) => [v.id, v]));
      // Stock after each decrement, for the movement ledger (stockBefore/After are required).
      const stockAfterByVariant = new Map<string, { before: number; after: number }>();

      let subtotalHt = new Decimal(0);
      let tvaAmount = new Decimal(0);
      const lines: Prisma.OrderItemCreateWithoutOrderInput[] = [];
      for (const item of body.items) {
        const variant = byId.get(item.variantId);
        if (!variant || variant.product.status !== "ACTIVE") {
          throw new PosError(404, "VARIANT_NOT_FOUND", `Article introuvable ou inactif : ${item.variantId}`);
        }
        if (item.serialNumbers && item.serialNumbers.length !== item.quantity) {
          throw new PosError(400, "SERIAL_COUNT_MISMATCH", "Le nombre de numéros de série doit égaler la quantité");
        }
        const unitPriceHt = new Decimal(item.unitPriceHt ?? Number(variant.priceOverride ?? variant.product.priceHt));
        const lineHt = unitPriceHt.mul(item.quantity);
        const tvaRate = new Decimal(variant.product.tvaRate);
        subtotalHt = subtotalHt.add(lineHt);
        tvaAmount = tvaAmount.add(lineHt.mul(tvaRate).div(100));

        // Same atomic guard as the web checkout: never oversell reserved units.
        const decremented = await tx.productVariant.updateMany({
          where: { id: variant.id, stockQuantity: { gte: item.quantity + variant.stockReserved }, stockReserved: variant.stockReserved },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (decremented.count !== 1) {
          throw new PosError(409, "INSUFFICIENT_STOCK", `Stock insuffisant pour ${variant.product.name} (${variant.sku})`);
        }
        const prev = stockAfterByVariant.get(variant.id)?.after ?? variant.stockQuantity;
        stockAfterByVariant.set(variant.id, { before: prev, after: prev - item.quantity });

        lines.push({
          product: { connect: { id: variant.product.id } },
          variant: { connect: { id: variant.id } },
          quantity: item.quantity,
          unitPriceHt,
          tvaRate,
          totalHt: lineHt.toDecimalPlaces(2),
          serialNumbers: item.serialNumbers ?? [],
        });
      }

      const discountHt = Decimal.min(subtotalHt, new Decimal(body.discountHt ?? 0)).toDecimalPlaces(2);
      const discountedSubtotalHt = subtotalHt.sub(discountHt).toDecimalPlaces(2);
      const discountedTva = subtotalHt.isZero()
        ? new Decimal(0)
        : tvaAmount.mul(discountedSubtotalHt).div(subtotalHt).toDecimalPlaces(2);
      const totalTtc = discountedSubtotalHt.add(discountedTva).toDecimalPlaces(2);
      const totalCents = totalTtc.mul(100).round().toNumber();

      if (body.paymentMethod === "CASH" && body.cashReceivedCents !== undefined && body.cashReceivedCents < totalCents) {
        throw new PosError(400, "CASH_INSUFFICIENT", "Espèces reçues inférieures au total");
      }

      const customerId = body.customerId
        ? (await tx.user.findUnique({ where: { id: body.customerId }, select: { id: true } }))?.id
        : undefined;
      if (body.customerId && !customerId) throw new PosError(404, "CUSTOMER_NOT_FOUND", "Client introuvable");

      const storeAddress = { type: "STORE", label: "Vente comptoir" };
      const now = new Date();
      const order = await tx.order.create({
        data: {
          customerId: customerId ?? (await ensureWalkInCustomer(tx)),
          status: "DELIVERED",
          paymentMethod: body.paymentMethod,
          paymentStatus: "PAID",
          shippingMethod: "STORE_PICKUP",
          shippingAddress: storeAddress,
          billingAddress: storeAddress,
          subtotalHt: discountedSubtotalHt,
          tvaAmount: discountedTva,
          shippingCost: 0,
          totalTtc,
          notes: body.note,
          channel: "STORE",
          posSessionId: session.id,
          deliveredAt: now,
          items: { create: lines },
          statusHistory: {
            create: { fromStatus: "PENDING", toStatus: "DELIVERED", note: "Vente comptoir", changedBy: user.userId },
          },
        },
        include: { items: { include: { product: { select: { name: true } }, variant: { select: { sku: true, name: true } } } } },
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "pos",
          providerRef: `pos:${session.id}:${order.id}`,
          amount: totalTtc,
          method: body.paymentMethod,
          status: "CONFIRMED",
          receivedAt: now,
        },
      });

      await tx.financialLedger.create({
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          operation: "CHARGE",
          amountCents: totalCents,
          currency: "EUR",
          provider: "pos",
          providerRef: `pos:${session.id}:${order.id}`,
          reason: `Vente comptoir ${body.paymentMethod}`,
          performedBy: user.userId,
          metadata: { posSessionId: session.id, discountHt: discountHt.toNumber() },
        },
      });

      for (const [variantId, stock] of stockAfterByVariant) {
        await tx.stockMovement.create({
          data: {
            variantId,
            type: "OUT_SALE",
            quantity: stock.after - stock.before,
            reason: "Vente comptoir",
            referenceId: order.id,
            referenceType: "ORDER",
            performedBy: user.userId,
            stockBefore: stock.before,
            stockAfter: stock.after,
          },
        });
      }

      return {
        order,
        receipt: {
          orderNumber: order.orderNumber,
          totalTtc: totalTtc.toNumber(),
          subtotalHt: discountedSubtotalHt.toNumber(),
          tvaAmount: discountedTva.toNumber(),
          discountHt: discountHt.toNumber(),
          paymentMethod: body.paymentMethod,
          changeCents:
            body.paymentMethod === "CASH" && body.cashReceivedCents !== undefined
              ? body.cashReceivedCents - totalCents
              : null,
        },
      };
    });

    app.log.info(
      { orderId: result.order.id, total: result.receipt.totalTtc, method: body.paymentMethod, userId: user.userId },
      "POS sale recorded",
    );
    return reply.status(201).send({ success: true, data: result });
  });

  // GET /admin/pos/sales?sessionId= — sales of a session (default: open one)
  app.get("/admin/pos/sales", staffOnly, async (request, reply) => {
    const query = z.object({ sessionId: z.string().uuid().optional() }).parse(request.query);
    const sessionId = query.sessionId ?? (await app.prisma.posSession.findFirst({ where: { status: "OPEN" }, select: { id: true } }))?.id;
    if (!sessionId) return reply.send({ success: true, data: [] });
    const sales = await app.prisma.order.findMany({
      where: { posSessionId: sessionId },
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { product: { select: { name: true } }, variant: { select: { sku: true } } } },
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    return { success: true, data: sales };
  });
}
