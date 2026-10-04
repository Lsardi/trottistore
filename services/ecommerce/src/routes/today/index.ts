/**
 * "Aujourd'hui" — what the shop has to do when it opens.
 *
 * One cheap aggregate per service; the back-office composes them (SAV has
 * its own /today for appointments and tickets). Everything here is an action
 * list, not a KPI: counts plus the first items to act on.
 */
import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";

const STAFF_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER", "STAFF", "TECHNICIAN"] as const;
const PREVIEW = 10;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function todayRoutes(app: FastifyInstance) {
  app.get(
    "/admin/today",
    { preHandler: [app.authenticate, requireRole(...STAFF_ROLES)] },
    async () => {
      const since = startOfToday();
      const orderPreview = {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        shippingMethod: true,
        totalTtc: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true, email: true } },
        _count: { select: { items: true } },
      } as const;

      const [
        toPrepare,
        toPrepareCount,
        readyForPickup,
        readyForPickupCount,
        toShip,
        toShipCount,
        awaitingPayment,
        awaitingPaymentCount,
        lowStock,
        lowStockCount,
        openSession,
        todayStoreSales,
        todayWebOrders,
      ] = await Promise.all([
        // Paid web orders nobody has started preparing
        app.prisma.order.findMany({
          where: { channel: "WEB", status: "CONFIRMED", paymentStatus: "PAID" },
          orderBy: { createdAt: "asc" },
          take: PREVIEW,
          select: orderPreview,
        }),
        app.prisma.order.count({ where: { channel: "WEB", status: "CONFIRMED", paymentStatus: "PAID" } }),
        // Click-and-collect prepared, waiting for the customer
        app.prisma.order.findMany({
          where: { shippingMethod: "STORE_PICKUP", status: { in: ["PREPARING", "READY_FOR_PICKUP"] } },
          orderBy: { createdAt: "asc" },
          take: PREVIEW,
          select: orderPreview,
        }),
        app.prisma.order.count({
          where: { shippingMethod: "STORE_PICKUP", status: { in: ["PREPARING", "READY_FOR_PICKUP"] } },
        }),
        // Deliveries prepared, not yet handed to the carrier
        app.prisma.order.findMany({
          where: { shippingMethod: "DELIVERY", status: "PREPARING" },
          orderBy: { createdAt: "asc" },
          take: PREVIEW,
          select: orderPreview,
        }),
        app.prisma.order.count({ where: { shippingMethod: "DELIVERY", status: "PREPARING" } }),
        // Bank transfers / cheques promised but not received
        app.prisma.order.findMany({
          where: { status: { in: ["PENDING", "CONFIRMED"] }, paymentStatus: "PENDING", paymentMethod: { in: ["BANK_TRANSFER", "CHECK"] } },
          orderBy: { createdAt: "asc" },
          take: PREVIEW,
          select: orderPreview,
        }),
        app.prisma.order.count({
          where: { status: { in: ["PENDING", "CONFIRMED"] }, paymentStatus: "PENDING", paymentMethod: { in: ["BANK_TRANSFER", "CHECK"] } },
        }),
        // Variants at or under their threshold (what to reorder)
        app.prisma.$queryRaw<Array<{ id: string; sku: string; name: string | null; productName: string; stockQuantity: number; lowStockThreshold: number }>>`
          SELECT v.id, v.sku, v.name, p.name AS "productName", v.stock_quantity AS "stockQuantity", v.low_stock_threshold AS "lowStockThreshold"
          FROM ecommerce.product_variants v
          JOIN ecommerce.products p ON p.id = v.product_id
          WHERE v.is_active AND p.status = 'ACTIVE' AND v.stock_quantity <= v.low_stock_threshold
          ORDER BY (v.stock_quantity - v.low_stock_threshold) ASC, p.name ASC
          LIMIT ${PREVIEW}`,
        app.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM ecommerce.product_variants v
          JOIN ecommerce.products p ON p.id = v.product_id
          WHERE v.is_active AND p.status = 'ACTIVE' AND v.stock_quantity <= v.low_stock_threshold`,
        app.prisma.posSession.findFirst({ where: { status: "OPEN" }, select: { id: true, openedAt: true, openedBy: true } }),
        app.prisma.order.aggregate({
          where: { channel: "STORE", createdAt: { gte: since }, status: { not: "CANCELLED" } },
          _count: { _all: true },
          _sum: { totalTtc: true },
        }),
        app.prisma.order.aggregate({
          where: { channel: "WEB", createdAt: { gte: since }, paymentStatus: "PAID" },
          _count: { _all: true },
          _sum: { totalTtc: true },
        }),
      ]);

      return {
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          register: openSession ? { open: true, ...openSession } : { open: false },
          actions: {
            toPrepare: { count: toPrepareCount, items: toPrepare },
            readyForPickup: { count: readyForPickupCount, items: readyForPickup },
            toShip: { count: toShipCount, items: toShip },
            awaitingPayment: { count: awaitingPaymentCount, items: awaitingPayment },
            lowStock: { count: Number(lowStockCount[0]?.count ?? 0), items: lowStock },
          },
          today: {
            store: { count: todayStoreSales._count._all, totalTtc: Number(todayStoreSales._sum.totalTtc ?? 0) },
            web: { count: todayWebOrders._count._all, totalTtc: Number(todayWebOrders._sum.totalTtc ?? 0) },
          },
        },
      };
    },
  );
}
