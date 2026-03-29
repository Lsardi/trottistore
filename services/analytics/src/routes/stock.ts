import type { FastifyInstance } from "fastify";


const CACHE_KEY = "analytics:stock:overview";
const CACHE_TTL = 300; // 5 minutes

interface StockOverviewRow {
  total_value: number;
  in_stock: bigint;
  out_of_stock: bigint;
  low_stock: bigint;
}

interface LowStockItemRow {
  variant_id: string;
  variant_name: string;
  product_name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
}

export async function stockRoutes(app: FastifyInstance) {
  // GET /analytics/stock/overview
  app.get("/analytics/stock/overview", async (_request, reply) => {
    const cached = await app.redis.get(CACHE_KEY);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const [overviewResult, lowStockItems] = await Promise.all([
      // Aggregate stock overview in a single query
      app.prisma.$queryRaw<StockOverviewRow[]>`
        SELECT
          COALESCE(SUM(
            pv.stock_quantity *
            COALESCE(pv.price_override_ht, p.price_ht)
          ), 0) AS total_value,
          COUNT(*) FILTER (WHERE pv.stock_quantity > 0)::bigint AS in_stock,
          COUNT(*) FILTER (WHERE pv.stock_quantity = 0)::bigint AS out_of_stock,
          COUNT(*) FILTER (
            WHERE pv.stock_quantity > 0
              AND pv.stock_quantity <= pv.low_stock_threshold
          )::bigint AS low_stock
        FROM ecommerce.product_variants pv
        JOIN ecommerce.products p ON p.id = pv.product_id
        WHERE pv.is_active = true
          AND p.status = 'ACTIVE'
      `,

      // Low stock product details
      app.prisma.$queryRaw<LowStockItemRow[]>`
        SELECT
          pv.id AS variant_id,
          pv.name AS variant_name,
          p.name AS product_name,
          pv.sku,
          pv.stock_quantity,
          pv.low_stock_threshold
        FROM ecommerce.product_variants pv
        JOIN ecommerce.products p ON p.id = pv.product_id
        WHERE pv.is_active = true
          AND p.status = 'ACTIVE'
          AND pv.stock_quantity > 0
          AND pv.stock_quantity <= pv.low_stock_threshold
        ORDER BY pv.stock_quantity ASC
        LIMIT 50
      `,
    ]);

    const overview = overviewResult[0];

    const result = {
      totalStockValue: Number(overview?.total_value ?? 0),
      inStockCount: Number(overview?.in_stock ?? 0),
      outOfStockCount: Number(overview?.out_of_stock ?? 0),
      lowStockCount: Number(overview?.low_stock ?? 0),
      lowStockItems: lowStockItems.map((item) => ({
        variantId: item.variant_id,
        variantName: item.variant_name,
        productName: item.product_name,
        sku: item.sku,
        currentStock: item.stock_quantity,
        threshold: item.low_stock_threshold,
      })),
      currency: "EUR",
      updatedAt: new Date().toISOString(),
    };

    await app.redis.set(CACHE_KEY, JSON.stringify(result), "EX", CACHE_TTL);

    return reply.send(result);
  });
}
