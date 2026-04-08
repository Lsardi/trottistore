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

type LegacyKpiResults = {
  totalRevenue: number;
  ordersCount: number;
  newCustomersCount: number;
  returningCustomers: number;
};

async function runLegacyKpiQueries(
  app: FastifyInstance,
  periodStart: Date,
): Promise<LegacyKpiResults> {
  const [
    revenueResult,
    ordersCount,
    newCustomersCount,
    returningCustomersResult,
  ] = await Promise.all([
    app.prisma.order.aggregate({
      _sum: { totalTtc: true },
      where: {
        status: { not: "CANCELLED" },
        createdAt: { gte: periodStart },
      },
    }),
    app.prisma.order.count({
      where: {
        status: { not: "CANCELLED" },
        createdAt: { gte: periodStart },
      },
    }),
    app.prisma.user.count({
      where: {
        role: "CLIENT",
        createdAt: { gte: periodStart },
      },
    }),
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

  return {
    totalRevenue: Number(revenueResult._sum.totalTtc ?? 0),
    ordersCount,
    newCustomersCount,
    returningCustomers: Number(returningCustomersResult[0]?.count ?? 0),
  };
}

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

    const projections = await app.prisma.dailySales.findMany({
      where: { date: { gte: periodStart } },
      orderBy: { date: "asc" },
    });

    let totalRevenue = 0;
    let ordersCount = 0;
    let newCustomersCount = 0;
    let returningCustomers = 0;

    if (projections.length > 0) {
      totalRevenue = projections.reduce((sum, row) => sum + Number(row.revenue), 0);
      ordersCount = projections.reduce((sum, row) => sum + row.orderCount, 0);
      newCustomersCount = projections.reduce((sum, row) => sum + row.newCustomers, 0);

      const returningCustomersResult = await app.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT customer_id
          FROM ecommerce.orders
          WHERE status != 'CANCELLED'
            AND created_at >= ${periodStart}
          GROUP BY customer_id
          HAVING COUNT(*) > 1
        ) as returning_customers
      `;
      returningCustomers = Number(returningCustomersResult[0]?.count ?? 0);
    } else {
      // Legacy fallback until projections are populated by analytics:refresh.
      const legacy = await runLegacyKpiQueries(app, periodStart);
      totalRevenue = legacy.totalRevenue;
      ordersCount = legacy.ordersCount;
      newCustomersCount = legacy.newCustomersCount;
      returningCustomers = legacy.returningCustomers;
    }

    const avgOrderValue = ordersCount > 0 ? totalRevenue / ordersCount : 0;

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
