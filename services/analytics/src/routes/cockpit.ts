import type { FastifyInstance } from "fastify";

const CACHE_KEY = "analytics:cockpit:v1";
const CACHE_TTL = 60;

export async function cockpitRoutes(app: FastifyInstance) {
  app.get("/analytics/cockpit", async (_request, reply) => {
    const cached = await app.redis.get(CACHE_KEY);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const yesterdayStart = new Date(dayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const lastWeekDayStart = new Date(dayStart);
    lastWeekDayStart.setDate(lastWeekDayStart.getDate() - 7);
    const lastWeekDayEnd = new Date(dayEnd);
    lastWeekDayEnd.setDate(lastWeekDayEnd.getDate() - 7);

    const [
      revenueToday,
      revenueYesterday,
      revenueSameDayLastWeek,
      ordersToPrepare,
      appointmentsToday,
      savWaiting,
      lowStock,
      crmInteractions,
    ] = await Promise.all([
      app.prisma.order.aggregate({
        _sum: { totalTtc: true },
        where: {
          status: { not: "CANCELLED" },
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      }),
      app.prisma.order.aggregate({
        _sum: { totalTtc: true },
        where: {
          status: { not: "CANCELLED" },
          createdAt: { gte: yesterdayStart, lt: dayStart },
        },
      }),
      app.prisma.order.aggregate({
        _sum: { totalTtc: true },
        where: {
          status: { not: "CANCELLED" },
          createdAt: { gte: lastWeekDayStart, lt: lastWeekDayEnd },
        },
      }),
      app.prisma.order.findMany({
        where: { status: "CONFIRMED" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalTtc: true,
          createdAt: true,
        },
      }),
      app.prisma.repairAppointment.findMany({
        where: {
          startsAt: { gte: dayStart, lt: dayEnd },
          status: { not: "CANCELLED" },
        },
        orderBy: { startsAt: "asc" },
        take: 20,
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          customerName: true,
          serviceType: true,
          isExpress: true,
          status: true,
        },
      }),
      app.prisma.repairTicket.findMany({
        where: {
          status: { in: ["RECU", "EN_ATTENTE_PIECE"] },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 20,
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          priority: true,
          productModel: true,
          customerName: true,
          createdAt: true,
        },
      }),
      app.prisma.productVariant.findMany({
        where: {
          isActive: true,
          stockQuantity: { gt: 0 },
        },
        orderBy: { stockQuantity: "asc" },
        take: 20,
        select: {
          id: true,
          sku: true,
          name: true,
          stockQuantity: true,
          lowStockThreshold: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      app.prisma.customerInteraction.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          channel: true,
          subject: true,
          referenceId: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const lowStockCritical = lowStock.filter(
      (variant) => variant.stockQuantity <= variant.lowStockThreshold,
    );

    const payload = {
      revenue: {
        today: Number(revenueToday._sum.totalTtc ?? 0),
        yesterday: Number(revenueYesterday._sum.totalTtc ?? 0),
        sameDayLastWeek: Number(revenueSameDayLastWeek._sum.totalTtc ?? 0),
      },
      ordersToPrepare,
      appointmentsToday,
      savWaiting,
      lowStock: lowStockCritical,
      crmInteractions,
      updatedAt: now.toISOString(),
    };

    await app.redis.set(CACHE_KEY, JSON.stringify(payload), "EX", CACHE_TTL);

    return reply.send(payload);
  });
}
