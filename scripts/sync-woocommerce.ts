import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types for WooCommerce Store API v1 response
// ---------------------------------------------------------------------------
interface WcImage {
  id: number;
  src: string;
  thumbnail: string;
  srcset: string;
  sizes: string;
  name: string;
  alt: string;
}

interface WcCategory {
  id: number;
  name: string;
  slug: string;
  link?: string;
}

interface WcPrice {
  price: string;           // price in minor units (cents), e.g. "15990"
  regular_price: string;
  sale_price: string;
  price_range: null | { min_amount: string; max_amount: string };
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
  currency_decimal_separator: string;
  currency_thousand_separator: string;
  currency_prefix: string;
  currency_suffix: string;
}

interface WcProduct {
  id: number;
  name: string;
  slug: string;
  type: string;
  permalink: string;
  sku: string;
  short_description: string;
  description: string;
  prices: WcPrice;
  images: WcImage[];
  categories: WcCategory[];
  is_in_stock: boolean;
  is_purchasable: boolean;
  on_sale: boolean;
  average_rating: string;
  review_count: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = "https://www.trottistore.fr/wp-json/wc/store/v1/products";
const PER_PAGE = 100;
const DELAY_MS = 300;
const TVA_RATE = 1.20;
const FEATURED_THRESHOLD_TTC_CENTS = 50000; // 500 EUR in cents

// Known brand patterns (case-insensitive match against product name)
const BRAND_PATTERNS: string[] = [
  "Dualtron",
  "Teverun",
  "Xiaomi",
  "Ninebot",
  "Kaabo",
  "Vsett",
  "Segway",
  "Kuickwheel",
  "Inokim",
  "Minimotors",
  "Zero",
  "E-Twow",
  "Speedway",
  "Weped",
  "Kugoo",
  "Aovo",
  "Weebot",
  "SmartGyro",
  "Nanrobot",
  "Joyor",
  "Urbanglide",
  "Micro",
  "SXT",
  "Onemile",
  "Beeper",
  "Kingsong",
  "Inmotion",
  "Gotway",
  "Begode",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Convert price string (minor units / cents) to EUR HT decimal (string). */
function centsToEurosHt(centsStr: string): string {
  const cents = parseInt(centsStr, 10);
  if (isNaN(cents) || cents <= 0) return "0.00";
  const eurTtc = cents / 100;
  const eurHt = eurTtc / TVA_RATE;
  return eurHt.toFixed(2);
}

/** Try to extract a brand name from the product name. */
function extractBrand(productName: string): string | null {
  const nameLower = productName.toLowerCase();
  for (const brand of BRAND_PATTERNS) {
    if (nameLower.includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return null;
}

/** Strip HTML tags for plain text fallback. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

// ---------------------------------------------------------------------------
// Fetch all products from WooCommerce Store API
// ---------------------------------------------------------------------------

async function fetchAllProducts(): Promise<WcProduct[]> {
  const allProducts: WcProduct[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${BASE_URL}?per_page=${PER_PAGE}&page=${page}`;
    console.log(`Fetching page ${page}/${totalPages}...`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "TrottiStore-Sync/1.0",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} on page ${page}: ${response.statusText}`
      );
    }

    // Read total pages from header on first request
    const wpTotalPages = response.headers.get("X-WP-TotalPages");
    if (wpTotalPages) {
      totalPages = parseInt(wpTotalPages, 10);
    }

    const products: WcProduct[] = await response.json();
    allProducts.push(...products);

    console.log(
      `  -> got ${products.length} products (total so far: ${allProducts.length})`
    );

    page++;
    if (page <= totalPages) {
      await sleep(DELAY_MS);
    }
  }

  return allProducts;
}

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== TrottiStore WooCommerce Sync ===\n");

  const prisma = new PrismaClient();

  try {
    // 1. Fetch all products from WooCommerce
    console.log("[1/5] Fetching products from WooCommerce Store API...\n");
    const wcProducts = await fetchAllProducts();
    console.log(`\nTotal products fetched: ${wcProducts.length}\n`);

    // 2. Sync categories
    console.log("[2/5] Syncing categories...");
    const categoryMap = new Map<string, string>(); // slug -> db id
    const uniqueCategories = new Map<string, WcCategory>();

    for (const p of wcProducts) {
      for (const cat of p.categories) {
        if (!uniqueCategories.has(cat.slug)) {
          uniqueCategories.set(cat.slug, cat);
        }
      }
    }

    for (const [slug, cat] of uniqueCategories) {
      const dbCat = await prisma.category.upsert({
        where: { slug },
        update: { name: cat.name },
        create: {
          name: cat.name,
          slug,
          isActive: true,
          position: 0,
        },
      });
      categoryMap.set(slug, dbCat.id);
    }
    console.log(`  -> ${uniqueCategories.size} categories synced\n`);

    // 3. Sync brands
    console.log("[3/5] Syncing brands...");
    const brandMap = new Map<string, string>(); // brandName (lowercase) -> db id
    const detectedBrands = new Set<string>();

    for (const p of wcProducts) {
      const brand = extractBrand(p.name);
      if (brand) detectedBrands.add(brand);
    }

    for (const brandName of detectedBrands) {
      const slug = slugify(brandName);
      const dbBrand = await prisma.brand.upsert({
        where: { slug },
        update: { name: brandName },
        create: {
          name: brandName,
          slug,
          isActive: true,
        },
      });
      brandMap.set(brandName.toLowerCase(), dbBrand.id);
    }
    console.log(`  -> ${detectedBrands.size} brands synced\n`);

    // 4. Sync products
    console.log("[4/5] Syncing products...");
    let syncedCount = 0;
    let imageCount = 0;
    let errorCount = 0;

    for (const wc of wcProducts) {
      try {
        // Determine SKU — fallback to wc-{id} if missing
        const sku = wc.sku && wc.sku.trim() !== "" ? wc.sku.trim() : `wc-${wc.id}`;
        const slug = wc.slug || slugify(wc.name);

        // Price conversion: cents TTC -> euros HT
        const priceHt = centsToEurosHt(wc.prices.price);
        const priceTtcCents = parseInt(wc.prices.price, 10) || 0;
        const isFeatured = priceTtcCents > FEATURED_THRESHOLD_TTC_CENTS;

        // Brand detection
        const brandName = extractBrand(wc.name);
        const brandId = brandName ? brandMap.get(brandName.toLowerCase()) ?? null : null;

        // Status based on purchasability
        const status = wc.is_purchasable ? "ACTIVE" : "DRAFT";

        // Short description: strip HTML for storage, keep original in description
        const shortDescription = wc.short_description
          ? stripHtml(wc.short_description).slice(0, 5000)
          : null;

        // Upsert product — try by slug first, then by sku
        // Prisma upsert requires a unique field, we use slug as primary match
        const product = await prisma.product.upsert({
          where: { slug },
          update: {
            name: wc.name,
            sku,
            description: wc.description || null,
            shortDescription,
            brandId,
            priceHt,
            tvaRate: 20.0,
            status,
            isFeatured,
          },
          create: {
            name: wc.name,
            sku,
            slug,
            description: wc.description || null,
            shortDescription,
            brandId,
            priceHt,
            tvaRate: 20.0,
            status,
            isFeatured,
          },
        });

        // Upsert default variant
        const variantSku = `${sku}-default`;
        await prisma.productVariant.upsert({
          where: { sku: variantSku },
          update: {
            name: wc.name,
            stockQuantity: wc.is_in_stock ? 1 : 0,
            isActive: wc.is_in_stock,
          },
          create: {
            productId: product.id,
            sku: variantSku,
            name: wc.name,
            stockQuantity: wc.is_in_stock ? 1 : 0,
            isActive: wc.is_in_stock,
          },
        });

        // Sync images — delete existing then re-create to avoid stale data
        await prisma.productImage.deleteMany({
          where: { productId: product.id },
        });

        if (wc.images.length > 0) {
          const imageData = wc.images.map((img, idx) => ({
            productId: product.id,
            url: img.src,
            alt: img.alt || wc.name,
            position: idx,
            isPrimary: idx === 0,
          }));

          await prisma.productImage.createMany({ data: imageData });
          imageCount += imageData.length;
        }

        // Sync category associations — delete existing then re-create
        await prisma.productCategory.deleteMany({
          where: { productId: product.id },
        });

        const categoryLinks = wc.categories
          .map((cat) => categoryMap.get(cat.slug))
          .filter((id): id is string => id !== undefined);

        if (categoryLinks.length > 0) {
          await prisma.productCategory.createMany({
            data: categoryLinks.map((catId) => ({
              productId: product.id,
              categoryId: catId,
            })),
          });
        }

        syncedCount++;

        // Progress log every 100 products
        if (syncedCount % 100 === 0) {
          console.log(`  -> ${syncedCount} products synced...`);
        }
      } catch (err) {
        errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        // Log duplicate key errors quietly (can happen with duplicate slugs/skus across products)
        if (msg.includes("Unique constraint")) {
          console.warn(`  [SKIP] Duplicate for "${wc.name}" (slug: ${wc.slug}, sku: ${wc.sku})`);
        } else {
          console.error(`  [ERROR] Product "${wc.name}" (id=${wc.id}): ${msg}`);
        }
      }
    }

    console.log(`  -> ${syncedCount} products synced (${errorCount} errors)\n`);

    // 5. Summary
    console.log("=== SYNC SUMMARY ===");
    console.log(`  Products fetched:  ${wcProducts.length}`);
    console.log(`  Products synced:   ${syncedCount}`);
    console.log(`  Categories:        ${uniqueCategories.size}`);
    console.log(`  Brands:            ${detectedBrands.size}`);
    console.log(`  Images:            ${imageCount}`);
    if (errorCount > 0) {
      console.log(`  Errors:            ${errorCount}`);
    }
    console.log("\nDone!");
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
