import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const periodQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "365d"]).default("30d"),
});

const PERIOD_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

const CACHE_TTL = 300; // 5 minutes

// --- Types for raw query results ---

interface TierCountRow {
  loyalty_tier: string;
  count: bigint;
}

interface TopCustomerRow {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  total_spent: Prisma.Decimal | number;
  total_orders: number;
  loyalty_tier: string;
}

interface CohortRow {
  cohort_month: Date;
  acquired: bigint;
  ordered_m1: bigint;
  ordered_m2: bigint;
  ordered_m3: bigint;
}

export async function customersRoutes(app: FastifyInstance) {
  // GET /analytics/customers/overview
  app.get("/analytics/customers/overview", async (request, reply) => {
    const { period } = periodQuerySchema.parse(request.query);
    const days = PERIOD_DAYS[period];

    const cacheKey = `analytics:customers:overview:${period}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    const [
      newCustomersCount,
      returningResult,
      avgLoyaltyResult,
      tierCounts,
      topCustomers,
    ] = await Promise.all([
      // New customers in period
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
        ) rc
      `,

      // Average loyalty points
      app.prisma.customerProfile.aggregate({
        _avg: { loyaltyPoints: true },
      }),

      // Customers by tier
      app.prisma.$queryRaw<TierCountRow[]>`
        SELECT loyalty_tier, COUNT(*)::bigint as count
        FROM crm.customer_profiles
        GROUP BY loyalty_tier
        ORDER BY
          CASE loyalty_tier
            WHEN 'BRONZE' THEN 1
            WHEN 'SILVER' THEN 2
            WHEN 'GOLD' THEN 3
            ELSE 4
          END
      `,

      // Top 5 customers by totalSpent
      app.prisma.$queryRaw<TopCustomerRow[]>`
        SELECT
          cp.user_id,
          u.first_name,
          u.last_name,
          u.email,
          cp.total_spent,
          cp.total_orders,
          cp.loyalty_tier
        FROM crm.customer_profiles cp
        JOIN shared.users u ON u.id = cp.user_id
        ORDER BY cp.total_spent DESC
        LIMIT 5
      `,
    ]);

    const returningCustomers = Number(returningResult[0]?.count ?? 0);

    const tiers: Record<string, number> = {};
    for (const row of tierCounts) {
      tiers[row.loyalty_tier] = Number(row.count);
    }

    const result = {
      period,
      newCustomers: newCustomersCount,
      returningCustomers,
      avgLoyaltyPoints: Math.round(avgLoyaltyResult._avg.loyaltyPoints ?? 0),
      customersByTier: tiers,
      topCustomers: topCustomers.map((c) => ({
        userId: c.user_id,
        firstName: c.first_name,
        lastName: c.last_name,
        email: c.email,
        totalSpent: Number(c.total_spent),
        totalOrders: c.total_orders,
        loyaltyTier: c.loyalty_tier,
      })),
      updatedAt: new Date().toISOString(),
    };

    await app.redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);

    return reply.send(result);
  });

  // GET /analytics/customers/cohorts — monthly acquisition cohorts
  app.get("/analytics/customers/cohorts", async (_request, reply) => {
    const cacheKey = "analytics:customers:cohorts";
    const cached = await app.redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    // Monthly cohorts for the last 12 months
    // For each month: count of users created, count who ordered in month+1, month+2, month+3
    const cohorts = await app.prisma.$queryRaw<CohortRow[]>`
      WITH monthly_cohorts AS (
        SELECT
          date_trunc('month', u.created_at) AS cohort_month,
          u.id AS user_id
        FROM shared.users u
        WHERE u.role = 'CLIENT'
          AND u.created_at >= date_trunc('month', NOW()) - INTERVAL '12 months'
      ),
      cohort_orders AS (
        SELECT
          mc.cohort_month,
          mc.user_id,
          date_trunc('month', o.created_at) AS order_month
        FROM monthly_cohorts mc
        JOIN ecommerce.orders o ON o.customer_id = mc.user_id
        WHERE o.status != 'CANCELLED'
      )
      SELECT
        mc.cohort_month,
        COUNT(DISTINCT mc.user_id)::bigint AS acquired,
        COUNT(DISTINCT CASE
          WHEN co.order_month = mc.cohort_month + INTERVAL '1 month'
          THEN co.user_id
        END)::bigint AS ordered_m1,
        COUNT(DISTINCT CASE
          WHEN co.order_month = mc.cohort_month + INTERVAL '2 months'
          THEN co.user_id
        END)::bigint AS ordered_m2,
        COUNT(DISTINCT CASE
          WHEN co.order_month = mc.cohort_month + INTERVAL '3 months'
          THEN co.user_id
        END)::bigint AS ordered_m3
      FROM monthly_cohorts mc
      LEFT JOIN cohort_orders co ON co.cohort_month = mc.cohort_month AND co.user_id = mc.user_id
      GROUP BY mc.cohort_month
      ORDER BY mc.cohort_month ASC
    `;

    const data = cohorts.map((row) => ({
      cohortMonth: row.cohort_month,
      acquired: Number(row.acquired),
      retentionMonth1: Number(row.ordered_m1),
      retentionMonth2: Number(row.ordered_m2),
      retentionMonth3: Number(row.ordered_m3),
      retentionRateMonth1:
        Number(row.acquired) > 0
          ? Math.round((Number(row.ordered_m1) / Number(row.acquired)) * 10000) / 100
          : 0,
      retentionRateMonth2:
        Number(row.acquired) > 0
          ? Math.round((Number(row.ordered_m2) / Number(row.acquired)) * 10000) / 100
          : 0,
      retentionRateMonth3:
        Number(row.acquired) > 0
          ? Math.round((Number(row.ordered_m3) / Number(row.acquired)) * 10000) / 100
          : 0,
    }));

    const result = {
      cohorts: data,
      updatedAt: new Date().toISOString(),
    };

    await app.redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);

    return reply.send(result);
  });
}
