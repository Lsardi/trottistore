import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types for crawl data
// ---------------------------------------------------------------------------
interface CrawlImage {
  url: string;
  alt: string;
  localPath?: string;
  isPrimary: boolean;
}

interface CrawlProduct {
  url: string;
  slug: string;
  name: string;
  sku: string;
  price: string; // "15,90 €"
  priceRegular: string;
  priceSale: string;
  currency: string;
  description: string;
  shortDescription: string;
  categories: string[];
  tags: string[];
  images: CrawlImage[];
  attributes: Record<string, unknown>;
  inStock: boolean;
  metaTitle: string;
  metaDescription: string;
  jsonLd?: {
    offers?: Array<{
      priceSpecification?: Array<{
        price?: string;
        valueAddedTaxIncluded?: boolean;
      }>;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Parse a TTC price from the crawl data.
 * Tries the "price" field first ("15,90 €"), falls back to jsonLd offers.
 * Returns the HT price (TTC / 1.20) rounded to 2 decimals.
 */
function parsePrice(product: CrawlProduct): number {
  let ttc: number | null = null;

  // Try the "price" field — format "15,90 €"
  if (product.price) {
    const cleaned = product.price.replace(/[^\d,.-]/g, "").replace(",", ".");
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > 0) {
      ttc = parsed;
    }
  }

  // Fallback: jsonLd offers
  if (ttc === null && product.jsonLd?.offers) {
    for (const offer of product.jsonLd.offers) {
      if (offer.priceSpecification) {
        for (const spec of offer.priceSpecification) {
          if (spec.price) {
            const parsed = parseFloat(spec.price);
            if (!isNaN(parsed) && parsed > 0) {
              ttc = parsed;
              break;
            }
          }
        }
      }
      if (ttc !== null) break;
    }
  }

  // Default fallback
  if (ttc === null) ttc = 0;

  // Prices from the source are TTC (valueAddedTaxIncluded: true). Convert to HT.
  const ht = ttc / 1.2;
  return Math.round(ht * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main() {
  const prisma = new PrismaClient({
    log: ["warn", "error"],
  });

  try {
    // ------------------------------------------------------------------
    // 1. Create schemas
    // ------------------------------------------------------------------
    console.log("Creating schemas...");
    for (const schema of ["shared", "ecommerce", "crm", "sav"]) {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      console.log(`  ✓ Schema "${schema}" ready`);
    }

    // ------------------------------------------------------------------
    // 2. Load crawl data
    // ------------------------------------------------------------------
    console.log("\nLoading crawl data...");
    const productsPath = resolve(__dirname, "../data/crawl/products.json");
    const rawProducts: CrawlProduct[] = JSON.parse(
      readFileSync(productsPath, "utf-8")
    );
    console.log(`  Loaded ${rawProducts.length} products from crawl data`);

    // ------------------------------------------------------------------
    // 3. Seed users
    // ------------------------------------------------------------------
    console.log("\nSeeding users...");
    const passwordHash = await hash("password123", {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });
    console.log("  Password hashed with argon2");

    const usersData = [
      {
        email: "admin@trottistore.fr",
        firstName: "Admin",
        lastName: "TrottiStore",
        role: "SUPERADMIN",
        passwordHash,
        emailVerified: true,
      },
      {
        email: "technicien@trottistore.fr",
        firstName: "Pierre",
        lastName: "Martin",
        role: "TECHNICIEN",
        passwordHash,
        emailVerified: true,
      },
      {
        email: "client@trottistore.fr",
        firstName: "Jean",
        lastName: "Dupont",
        role: "CLIENT",
        passwordHash,
        emailVerified: true,
      },
    ];

    const users: Array<{ id: string; email: string; role: string }> = [];
    for (const u of usersData) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: u,
      });
      users.push({ id: user.id, email: user.email, role: user.role });
      console.log(`  ✓ User ${user.email} (${user.role})`);
    }

    const adminUser = users.find((u) => u.role === "SUPERADMIN")!;
    const techUser = users.find((u) => u.role === "TECHNICIEN")!;
    const clientUser = users.find((u) => u.role === "CLIENT")!;

    // ------------------------------------------------------------------
    // 4. Seed categories
    // ------------------------------------------------------------------
    console.log("\nSeeding categories...");
    const categorySet = new Set<string>();
    for (const p of rawProducts) {
      for (const cat of p.categories) {
        if (cat && cat.trim()) categorySet.add(cat.trim());
      }
    }
    const uniqueCategories = Array.from(categorySet).sort();
    console.log(`  Found ${uniqueCategories.length} unique categories`);

    const categoryRecords = uniqueCategories.map((name, idx) => ({
      name,
      slug: slugify(name),
      position: idx,
      isActive: true,
    }));

    await prisma.category.createMany({
      data: categoryRecords,
      skipDuplicates: true,
    });

    // Build a slug -> id map for category associations
    const allCategories = await prisma.category.findMany({
      select: { id: true, slug: true, name: true },
    });
    const categoryByName = new Map<string, string>();
    for (const c of allCategories) {
      categoryByName.set(c.name, c.id);
      // Also map by slug for safety
      categoryByName.set(c.slug, c.id);
    }
    console.log(`  ✓ ${uniqueCategories.length} categories seeded`);

    // ------------------------------------------------------------------
    // 5. Seed products (in batches)
    // ------------------------------------------------------------------
    console.log("\nSeeding products...");

    // Deduplicate products by SKU (keep first occurrence)
    const seenSkus = new Set<string>();
    const deduped: CrawlProduct[] = [];
    for (const p of rawProducts) {
      const sku = p.sku || p.slug;
      if (!seenSkus.has(sku)) {
        seenSkus.add(sku);
        deduped.push(p);
      }
    }
    console.log(`  ${deduped.length} unique products (by SKU)`);

    // Deduplicate slugs as well
    const seenSlugs = new Set<string>();
    const products: CrawlProduct[] = [];
    for (const p of deduped) {
      let slug = p.slug || slugify(p.name);
      if (seenSlugs.has(slug)) {
        slug = `${slug}-${Math.random().toString(36).slice(2, 8)}`;
      }
      seenSlugs.add(slug);
      // Mutate for later use
      p.slug = slug;
      products.push(p);
    }

    const BATCH_SIZE = 100;
    let productCount = 0;
    let variantCount = 0;
    let imageCount = 0;
    let assocCount = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      // Prepare product data
      const productData = batch.map((p) => ({
        sku: p.sku || p.slug,
        name: p.name,
        slug: p.slug,
        description: p.description || null,
        shortDescription: p.shortDescription || null,
        priceHt: parsePrice(p),
        tvaRate: 20.0,
        status: p.inStock ? "ACTIVE" : "DRAFT",
        isFeatured: false,
        metaTitle: p.metaTitle || null,
        metaDesc: p.metaDescription || null,
      }));

      await prisma.product.createMany({
        data: productData,
        skipDuplicates: true,
      });

      // Fetch created products to get their IDs
      const createdProducts = await prisma.product.findMany({
        where: {
          sku: { in: batch.map((p) => p.sku || p.slug) },
        },
        select: { id: true, sku: true },
      });

      const productBySku = new Map<string, string>();
      for (const cp of createdProducts) {
        productBySku.set(cp.sku, cp.id);
      }

      // Seed images
      const imageData: Array<{
        productId: string;
        url: string;
        alt: string | null;
        position: number;
        isPrimary: boolean;
      }> = [];

      for (const p of batch) {
        const productId = productBySku.get(p.sku || p.slug);
        if (!productId) continue;

        for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
          const img = p.images[imgIdx];
          imageData.push({
            productId,
            url: img.url,
            alt: img.alt || null,
            position: imgIdx,
            isPrimary: img.isPrimary ?? imgIdx === 0,
          });
        }
      }

      if (imageData.length > 0) {
        await prisma.productImage.createMany({
          data: imageData,
          skipDuplicates: true,
        });
        imageCount += imageData.length;
      }

      // Seed variants (one default variant per product)
      const variantData: Array<{
        productId: string;
        sku: string;
        name: string;
        stockQuantity: number;
        lowStockThreshold: number;
        isActive: boolean;
      }> = [];

      for (const p of batch) {
        const productId = productBySku.get(p.sku || p.slug);
        if (!productId) continue;

        variantData.push({
          productId,
          sku: `${p.sku || p.slug}-default`,
          name: "Défaut",
          stockQuantity: Math.floor(Math.random() * 51), // 0-50
          lowStockThreshold: 5,
          isActive: true,
        });
      }

      if (variantData.length > 0) {
        await prisma.productVariant.createMany({
          data: variantData,
          skipDuplicates: true,
        });
        variantCount += variantData.length;
      }

      // Seed product-category associations
      const assocData: Array<{
        productId: string;
        categoryId: string;
      }> = [];

      for (const p of batch) {
        const productId = productBySku.get(p.sku || p.slug);
        if (!productId) continue;

        for (const catName of p.categories) {
          const categoryId = categoryByName.get(catName.trim());
          if (categoryId) {
            assocData.push({ productId, categoryId });
          }
        }
      }

      if (assocData.length > 0) {
        await prisma.productCategory.createMany({
          data: assocData,
          skipDuplicates: true,
        });
        assocCount += assocData.length;
      }

      productCount += batch.length;
      console.log(
        `  ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${productCount}/${products.length} products`
      );
    }

    console.log(`  ✓ ${productCount} products seeded`);
    console.log(`  ✓ ${variantCount} variants seeded`);
    console.log(`  ✓ ${imageCount} images seeded`);
    console.log(`  ✓ ${assocCount} product-category associations seeded`);

    // ------------------------------------------------------------------
    // 6. Seed CustomerProfile for client user
    // ------------------------------------------------------------------
    console.log("\nSeeding customer profile...");
    await prisma.customerProfile.upsert({
      where: { userId: clientUser.id },
      update: {},
      create: {
        userId: clientUser.id,
        source: "WEBSITE",
        loyaltyTier: "BRONZE",
        loyaltyPoints: 0,
        totalOrders: 0,
        totalSpent: 0,
        tags: [],
        scooterModels: [],
      },
    });
    console.log(`  ✓ CustomerProfile for ${clientUser.email}`);

    // ------------------------------------------------------------------
    // 7. Seed Technician for technicien user
    // ------------------------------------------------------------------
    console.log("\nSeeding technician...");
    await prisma.technician.upsert({
      where: { userId: techUser.id },
      update: {},
      create: {
        userId: techUser.id,
        specialities: ["Trottinettes électriques", "Batteries", "Moteurs"],
        isAvailable: true,
        maxConcurrent: 5,
      },
    });
    console.log(`  ✓ Technician for ${techUser.email}`);

    // ------------------------------------------------------------------
    // Done
    // ------------------------------------------------------------------
    console.log("\n══════════════════════════════════════════");
    console.log("  Seed completed successfully!");
    console.log("══════════════════════════════════════════");
    console.log(`  Users:                3`);
    console.log(`  Categories:           ${uniqueCategories.length}`);
    console.log(`  Products:             ${productCount}`);
    console.log(`  Product variants:     ${variantCount}`);
    console.log(`  Product images:       ${imageCount}`);
    console.log(`  Category assocs:      ${assocCount}`);
    console.log(`  Customer profiles:    1`);
    console.log(`  Technicians:          1`);
    console.log("══════════════════════════════════════════\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
