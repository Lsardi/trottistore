import type { FastifyInstance } from "fastify";
import { z } from "zod";

const periodQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "365d"]).default("30d"),
});

const PERIOD_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

const CACHE_PREFIX = "analytics:kpis";
const CACHE_TTL = 300; // 5 minutes

export async function kpisRoutes(app: FastifyInstance) {
  app.get("/analytics/kpis", async (request, reply) => {
    const { period } = periodQuerySchema.parse(request.query);
    const days = PERIOD_DAYS[period];

    // Check cache
    const cacheKey = `${CACHE_PREFIX}:${period}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    // Run queries in parallel
    const [
      revenueResult,
      ordersCount,
      newCustomersCount,
      returningCustomersResult,
    ] = await Promise.all([
      // Total revenue (sum totalTtc, exclude cancelled)
      app.prisma.order.aggregate({
        _sum: { totalTtc: true },
        where: {
          status: { not: "CANCELLED" },
          createdAt: { gte: periodStart },
        },
      }),

      // Total orders count
      app.prisma.order.count({
        where: {
          status: { not: "CANCELLED" },
          createdAt: { gte: periodStart },
        },
      }),

      // New customers: users created in period with role CLIENT
      app.prisma.user.count({
        where: {
          role: "CLIENT",
          createdAt: { gte: periodStart },
        },
      }),

      // Returning customers: customers with > 1 order in period
      app.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT customer_id
          FROM ecommerce.orders
          WHERE status != 'CANCELLED'
            AND created_at >= ${periodStart}
          GROUP BY customer_id
          HAVING COUNT(*) > 1
        ) as returning_customers
      `,
    ]);

    const totalRevenue = Number(revenueResult._sum.totalTtc ?? 0);
    const avgOrderValue = ordersCount > 0 ? totalRevenue / ordersCount : 0;
    const returningCustomers = Number(returningCustomersResult[0]?.count ?? 0);

    // Conversion rate placeholder: orders / estimated visits (orders * 25 as mock visitors)
    const estimatedVisitors = ordersCount * 25 || 1;
    const conversionRate = (ordersCount / estimatedVisitors) * 100;

    const result = {
      period,
      days,
      revenue: Math.round(totalRevenue * 100) / 100,
      orders: ordersCount,
      averageOrderValue: Math.round(avgOrderValue * 100) / 100,
      newCustomers: newCustomersCount,
      returningCustomers,
      conversionRate: Math.round(conversionRate * 100) / 100,
      estimatedVisitors,
      currency: "EUR",
      periodStart: periodStart.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Cache
    await app.redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);

    return reply.send(result);
  });
}
