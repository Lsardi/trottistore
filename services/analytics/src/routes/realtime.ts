import type { FastifyInstance } from "fastify";

const CACHE_KEY = "analytics:realtime";
const CACHE_TTL = 60; // 1 minute for realtime data

interface RealtimeKpis {
  revenueToday: number;
  ordersToday: number;
  revenueYesterday: number;
  activeCarts: number;
  openSavTickets: number;
  lowStockAlerts: number;
  currency: string;
  updatedAt: string;
}

export async function realtimeRoutes(app: FastifyInstance) {
  app.get("/analytics/realtime", async (_request, reply) => {
    // Check Redis cache
    const cached = await app.redis.get(CACHE_KEY);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // Run all queries in parallel
    const [
      revenueTodayResult,
      ordersTodayCount,
      revenueYesterdayResult,
      activeCarts,
      openSavTickets,
      lowStockAlerts,
    ] = await Promise.all([
      // Revenue today: sum of totalTtc where status != CANCELLED and createdAt >= todayStart
      app.prisma.order.aggregate({
        _sum: { totalTtc: true },
        where: {
          status: { not: "CANCELLED" },
          createdAt: { gte: todayStart },
        },
      }),

      // Orders today count
      app.prisma.order.count({
        where: {
          createdAt: { gte: todayStart },
          status: { not: "CANCELLED" },
        },
      }),

      // Revenue yesterday for comparison
      app.prisma.order.aggregate({
        _sum: { totalTtc: true },
        where: {
          status: { not: "CANCELLED" },
          createdAt: {
            gte: yesterdayStart,
            lt: todayStart,
          },
        },
      }),

      // Active carts from Redis
      app.redis.keys("cart:*").then((keys) => keys.length).catch(() => 0),

      // Open SAV tickets: status NOT IN terminal states
      app.prisma.repairTicket.count({
        where: {
          status: {
            notIn: ["TERMINE", "LIVRE", "REFUS_CLIENT", "IRREPARABLE"],
          },
        },
      }),

      // Low stock alerts: stockQuantity > 0 AND stockQuantity <= lowStockThreshold
      app.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM ecommerce.product_variants
        WHERE is_active = true
          AND stock_quantity > 0
          AND stock_quantity <= low_stock_threshold
      `,
    ]);

    const result: RealtimeKpis = {
      revenueToday: Number(revenueTodayResult._sum.totalTtc ?? 0),
      ordersToday: ordersTodayCount,
      revenueYesterday: Number(revenueYesterdayResult._sum.totalTtc ?? 0),
      activeCarts,
      openSavTickets,
      lowStockAlerts: Number(lowStockAlerts[0]?.count ?? 0),
      currency: "EUR",
      updatedAt: now.toISOString(),
    };

    // Cache result
    await app.redis.set(CACHE_KEY, JSON.stringify(result), "EX", CACHE_TTL);

    return reply.send(result);
  });
}
