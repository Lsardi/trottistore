import { config } from "dotenv";
import { resolve } from "path";
import { prisma, PrismaClient } from "@trottistore/database";

config({ path: resolve(process.cwd(), ".env") });

type DailySalesRow = {
  day: Date;
  revenue: number;
  order_count: number;
};

type DailyCustomersRow = {
  day: Date;
  new_customers: number;
};

type ProductRankingRow = {
  product_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  total_revenue: number;
  total_quantity: number;
  order_count: number;
};

type LoyaltyTierRow = {
  tier: string;
  customer_count: number;
  avg_spent: number;
};

function toDayStart(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function toDateKey(value: Date): string {
  return toDayStart(value).toISOString().slice(0, 10);
}

function buildDateRange(start: Date, endInclusive: Date): Date[] {
  const result: Date[] = [];
  let cursor = toDayStart(start);
  const end = toDayStart(endInclusive);

  while (cursor <= end) {
    result.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }

  return result;
}

export async function refreshDailySales(client: PrismaClient, date?: Date) {
  const endDate = date ? toDayStart(date) : toDayStart(new Date());
  const startDate = date ? toDayStart(date) : addDays(endDate, -365);
  const nextDay = addDays(endDate, 1);

  const [salesRows, customerRows] = await Promise.all([
    client.$queryRaw<DailySalesRow[]>`
      SELECT
        DATE(o.created_at) AS day,
        COALESCE(SUM(o.total_ttc), 0)::float8 AS revenue,
        COUNT(*)::int AS order_count
      FROM ecommerce.orders o
      WHERE o.status != 'CANCELLED'
        AND o.created_at >= ${startDate}
        AND o.created_at < ${nextDay}
      GROUP BY DATE(o.created_at)
    `,
    client.$queryRaw<DailyCustomersRow[]>`
      SELECT
        DATE(u.created_at) AS day,
        COUNT(*)::int AS new_customers
      FROM shared.users u
      WHERE u.role = 'CLIENT'
        AND u.created_at >= ${startDate}
        AND u.created_at < ${nextDay}
      GROUP BY DATE(u.created_at)
    `,
  ]);

  const salesByDay = new Map(
    salesRows.map((row) => [
      toDateKey(row.day),
      { revenue: Number(row.revenue), orderCount: Number(row.order_count) },
    ]),
  );

  const customersByDay = new Map(
    customerRows.map((row) => [toDateKey(row.day), Number(row.new_customers)]),
  );

  const dates = buildDateRange(startDate, endDate);

  await client.$transaction(
    dates.map((currentDate) => {
      const key = toDateKey(currentDate);
      const sales = salesByDay.get(key);
      const orderCount = sales?.orderCount ?? 0;
      const revenue = sales?.revenue ?? 0;
      const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
      const newCustomers = customersByDay.get(key) ?? 0;

      return client.dailySales.upsert({
        where: { date: currentDate },
        create: {
          date: currentDate,
          revenue,
          orderCount,
          avgOrderValue,
          newCustomers,
        },
        update: {
          revenue,
          orderCount,
          avgOrderValue,
          newCustomers,
        },
      });
    }),
  );

  return { refreshedDays: dates.length };
}

export async function refreshProductRanking(client: PrismaClient, date?: Date) {
  const rankingDate = date ? toDayStart(date) : toDayStart(new Date());
  const nextDay = addDays(rankingDate, 1);

  const rows = await client.$queryRaw<ProductRankingRow[]>`
    SELECT
      p.id AS product_id,
      p.name,
      p.slug,
      (
        SELECT pi.url FROM ecommerce.product_images pi
        WHERE pi.product_id = p.id AND pi.is_primary = true
        LIMIT 1
      ) AS image_url,
      COALESCE(SUM(oi.total_ht), 0)::float8 AS total_revenue,
      COALESCE(SUM(oi.quantity), 0)::int AS total_quantity,
      COUNT(DISTINCT oi.order_id)::int AS order_count
    FROM ecommerce.order_items oi
    JOIN ecommerce.products p ON p.id = oi.product_id
    JOIN ecommerce.orders o ON o.id = oi.order_id
    WHERE o.status != 'CANCELLED'
      AND o.created_at >= ${rankingDate}
      AND o.created_at < ${nextDay}
    GROUP BY p.id, p.name, p.slug
    ORDER BY total_revenue DESC
  `;

  await client.$transaction(async (tx) => {
    await tx.productRanking.deleteMany({ where: { rankingDate } });

    if (rows.length === 0) {
      return;
    }

    await tx.productRanking.createMany({
      data: rows.map((row) => ({
        productId: row.product_id,
        name: row.name,
        slug: row.slug,
        imageUrl: row.image_url,
        totalRevenue: Number(row.total_revenue),
        totalQuantity: Number(row.total_quantity),
        orderCount: Number(row.order_count),
        rankingDate,
      })),
    });
  });

  return { rankingDate: rankingDate.toISOString(), products: rows.length };
}

export async function refreshLoyaltyTierSummary(client: PrismaClient) {
  const rows = await client.$queryRaw<LoyaltyTierRow[]>`
    SELECT
      cp.loyalty_tier AS tier,
      COUNT(*)::int AS customer_count,
      COALESCE(AVG(cp.total_spent), 0)::float8 AS avg_spent
    FROM crm.customer_profiles cp
    GROUP BY cp.loyalty_tier
  `;

  await client.$transaction(
    rows.map((row) =>
      client.loyaltyTierSummary.upsert({
        where: { tier: row.tier },
        create: {
          tier: row.tier,
          customerCount: Number(row.customer_count),
          avgSpent: Number(row.avg_spent),
        },
        update: {
          customerCount: Number(row.customer_count),
          avgSpent: Number(row.avg_spent),
        },
      }),
    ),
  );

  return { tiers: rows.length };
}

export async function refreshAll(client: PrismaClient) {
  const [dailySales, productRanking, loyaltyTierSummary] = await Promise.all([
    refreshDailySales(client),
    refreshProductRanking(client),
    refreshLoyaltyTierSummary(client),
  ]);

  return { dailySales, productRanking, loyaltyTierSummary };
}

async function main() {
  try {
    const result = await refreshAll(prisma);
    console.log(JSON.stringify({ success: true, ...result }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

const isMain = import.meta.url === new URL(process.argv[1], "file:").href;

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
