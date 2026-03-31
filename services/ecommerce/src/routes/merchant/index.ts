import type { FastifyInstance } from "fastify";

/**
 * Google Merchant Center feed endpoint.
 * Returns products in a format compatible with Google Merchant Center.
 *
 * Spec: https://support.google.com/merchants/answer/7052112
 *
 * Features:
 * - All active products with stock > 0
 * - Price TTC (including TVA)
 * - Local inventory availability (in_store / out_of_stock)
 * - Store code for Pickup Today
 * - Primary image URL
 * - Brand, category, condition
 */

const STORE_CODE = process.env.MERCHANT_STORE_CODE || "trottistore-ile-saint-denis";
const BASE_URL = process.env.BASE_URL || "https://trottistore.fr";

interface MerchantProduct {
  id: string;
  offerId: string;
  title: string;
  description: string;
  link: string;
  imageLink: string | null;
  price: { value: string; currency: string };
  availability: "in_stock" | "out_of_stock" | "limited_availability";
  brand: string | null;
  condition: "new";
  gtin: string | null;
  mpn: string;
  productType: string | null;
  // Local inventory
  storeCode: string;
  localAvailability: "in_store" | "out_of_stock";
  localQuantity: number;
  pickupMethod: "buy" | "not supported";
  pickupSla: "same day" | null;
}

export async function merchantRoutes(app: FastifyInstance) {
  // GET /merchant/feed — Full product feed for Google Merchant Center
  app.get("/merchant/feed", async (request, reply) => {
    const products = await app.prisma.product.findMany({
      where: {
        status: "ACTIVE",
      },
      include: {
        brand: { select: { name: true } },
        images: {
          where: { isPrimary: true },
          select: { url: true, alt: true },
          take: 1,
        },
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            sku: true,
            name: true,
            priceOverride: true,
            stockQuantity: true,
            stockReserved: true,
          },
        },
        categories: {
          include: {
            category: { select: { name: true } },
          },
          take: 1,
        },
      },
    });

    const feed: MerchantProduct[] = [];

    for (const product of products) {
      for (const variant of product.variants) {
        const availableStock = variant.stockQuantity - variant.stockReserved;
        const priceHt = variant.priceOverride ? Number(variant.priceOverride) : Number(product.priceHt);
        const tvaRate = Number(product.tvaRate) / 100;
        const priceTtc = priceHt * (1 + tvaRate);

        const availability = availableStock > 5
          ? "in_stock"
          : availableStock > 0
            ? "limited_availability"
            : "out_of_stock";

        const localAvailability = availableStock > 0 ? "in_store" : "out_of_stock";

        feed.push({
          id: variant.id,
          offerId: variant.sku,
          title: variant.name !== product.name
            ? `${product.name} — ${variant.name}`
            : product.name,
          description: product.shortDescription || product.description || product.name,
          link: `${BASE_URL}/produits/${product.slug}`,
          imageLink: product.images[0]?.url || null,
          price: {
            value: priceTtc.toFixed(2),
            currency: "EUR",
          },
          availability,
          brand: product.brand?.name || null,
          condition: "new",
          gtin: null,
          mpn: variant.sku,
          productType: product.categories[0]?.category?.name || null,
          // Local inventory
          storeCode: STORE_CODE,
          localAvailability,
          localQuantity: Math.max(0, availableStock),
          pickupMethod: availableStock > 0 ? "buy" : "not supported",
          pickupSla: availableStock > 0 ? "same day" : null,
        });
      }
    }

    // Set cache headers (refresh every hour)
    reply.header("Cache-Control", "public, max-age=3600");
    reply.header("Content-Type", "application/json");

    return {
      channel: "online",
      contentLanguage: "fr",
      targetCountry: "FR",
      feedLabel: "trottistore-products",
      generatedAt: new Date().toISOString(),
      itemCount: feed.length,
      items: feed,
    };
  });

  // GET /merchant/local-inventory — Local inventory feed for Pickup Today
  // NOTE: Intentionally public — Google Merchant requires unauthenticated access.
  // Returns only SKU-level availability (no pricing, no customer data).
  // Protected by rate limiting (global 100 req/min) + aggressive caching.
  app.get("/merchant/local-inventory", async (request, reply) => {
    const variants = await app.prisma.productVariant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        stockReserved: true,
      },
    });

    const inventory = variants.map((v) => {
      const available = v.stockQuantity - v.stockReserved;
      return {
        storeCode: STORE_CODE,
        itemId: v.sku,
        // Google Merchant requires "quantity" but we expose a capped value to avoid leaking exact stock
        quantity: available > 5 ? 5 : Math.max(0, available),
        availability: available > 0 ? "in_store" : "out_of_stock",
        pickupMethod: available > 0 ? "buy" : "not supported",
        pickupSla: available > 0 ? "same day" : null,
      };
    });

    reply.header("Cache-Control", "public, max-age=1800");
    reply.header("Content-Type", "application/json");

    return {
      storeCode: STORE_CODE,
      generatedAt: new Date().toISOString(),
      itemCount: inventory.length,
      items: inventory,
    };
  });
}
