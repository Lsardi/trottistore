import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";


// --- Schemas ---

const salesQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "365d"]).default("30d"),
  group: z.enum(["day", "week", "month"]).default("day"),
});

const topProductsQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "365d"]).default("30d"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const PERIOD_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

const CACHE_TTL = 300; // 5 minutes

// --- Types for raw query results ---

interface SalesTimeSeriesRow {
  date: Date;
  revenue: number;
  orders: bigint | number;
  avg_order_value: number;
}

interface TopProductRow {
  product_id: string;
  name: string;
  slug: string;
  image: string | null;
  total_revenue: number;
  total_quantity: bigint | number;
  order_count: bigint | number;
}

export async function salesRoutes(app: FastifyInstance) {
  // GET /analytics/sales — time series of sales data
  app.get("/analytics/sales", async (request, reply) => {
    const { period, group } = salesQuerySchema.parse(request.query);
    const days = PERIOD_DAYS[period];

    const cacheKey = `analytics:sales:${period}:${group}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    // PostgreSQL date_trunc to group by day/week/month.
    //
    // `group` is interpolated via Prisma.raw because Postgres cannot
    // recognize that two parameterized `date_trunc($1, o.created_at)`
    // expressions in SELECT and GROUP BY are the same and errors with:
    //   ERROR: column "o.created_at" must appear in the GROUP BY clause
    //   or be used in an aggregate function (SQLSTATE 42803)
    // `group` is safe to inline because it is constrained by the Zod enum
    // ["day", "week", "month"] above — no SQL injection vector.
    const groupExpr = Prisma.raw(`'${group}'`);
    const rows = await app.prisma.$queryRaw<SalesTimeSeriesRow[]>`
      SELECT
        date_trunc(${groupExpr}, o.created_at) AS date,
        COALESCE(SUM(o.total_ttc), 0) AS revenue,
        COUNT(*)::bigint AS orders,
        CASE
          WHEN COUNT(*) > 0 THEN ROUND(SUM(o.total_ttc) / COUNT(*), 2)
          ELSE 0
        END AS avg_order_value
      FROM ecommerce.orders o
      WHERE o.status != 'CANCELLED'
        AND o.created_at >= ${periodStart}
      GROUP BY date_trunc(${groupExpr}, o.created_at)
      ORDER BY date ASC
    `;

    const data = rows.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue),
      orders: Number(row.orders),
      avgOrderValue: Number(row.avg_order_value),
    }));

    const result = {
      period,
      group,
      data,
      currency: "EUR",
      updatedAt: new Date().toISOString(),
    };

    await app.redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);

    return reply.send(result);
  });

  // GET /analytics/products/top — top products by revenue
  app.get("/analytics/products/top", async (request, reply) => {
    const { period, limit } = topProductsQuerySchema.parse(request.query);
    const days = PERIOD_DAYS[period];

    const cacheKey = `analytics:products:top:${period}:${limit}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    const rows = await app.prisma.$queryRaw<TopProductRow[]>`
      SELECT
        p.id AS product_id,
        p.name,
        p.slug,
        (
          SELECT pi.url FROM ecommerce.product_images pi
          WHERE pi.product_id = p.id AND pi.is_primary = true
          LIMIT 1
        ) AS image,
        SUM(oi.total_ht) AS total_revenue,
        SUM(oi.quantity)::bigint AS total_quantity,
        COUNT(DISTINCT oi.order_id)::bigint AS order_count
      FROM ecommerce.order_items oi
      JOIN ecommerce.products p ON p.id = oi.product_id
      JOIN ecommerce.orders o ON o.id = oi.order_id
      WHERE o.status != 'CANCELLED'
        AND o.created_at >= ${periodStart}
      GROUP BY p.id, p.name, p.slug
      ORDER BY total_revenue DESC
      LIMIT ${limit}
    `;

    const products = rows.map((row) => ({
      productId: row.product_id,
      name: row.name,
      slug: row.slug,
      image: row.image,
      totalRevenue: Number(row.total_revenue),
      totalQuantity: Number(row.total_quantity),
      orderCount: Number(row.order_count),
    }));

    const result = {
      period,
      products,
      currency: "EUR",
      updatedAt: new Date().toISOString(),
    };

    await app.redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);

    return reply.send(result);
  });
}
