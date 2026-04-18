/**
 * Import Wattiz spare parts catalogue — ~2800 pieces détachées
 *
 * Usage: railway run npx tsx scripts/import-wattiz.ts
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const API_BASE =
  process.env.API_BASE_URL ||
  "https://trottistoreweb-production.up.railway.app";

// ─── JWT helper ─────────────────────────────────────────────

function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn: number,
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: now, exp: now + expiresIn }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

let accessToken = "";

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const url = `${API_BASE}/api/v1${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok && res.status !== 409) {
    throw new Error(
      `${method} ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }
  return data;
}

// ─── Parse CSV ──────────────────────────────────────────────

interface WattizRow {
  SKU: string;
  EAN: string;
  TYPE: string;
  NAME: string;
  CATEGORIES: string;
  PRICE_HT: string;
  PUBLIC_PRICE_TTC: string;
  WEIGHT_KG: string;
  FEATURES: string;
  IMAGES: string;
  MARQUE: string;
}

function parseCsv(filepath: string): WattizRow[] {
  const raw = readFileSync(filepath, "utf-8");
  const lines = raw.split("\n");
  const headers = lines[0].split(";");

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const cols = line.split(";");
      const row: any = {};
      headers.forEach((h, i) => (row[h.trim()] = cols[i]?.trim() || ""));
      return row as WattizRow;
    });
}

function parsePrice(s: string): number {
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100;
}

function parseWeight(s: string): number | null {
  const n = parseFloat(s.replace(",", "."));
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 1000); // kg → grams
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extract compatible scooter models from product name */
function extractCompatibleModels(name: string): string[] {
  const models: string[] = [];

  // Known model patterns in product names
  const patterns: Record<string, RegExp> = {
    "Dualtron Thunder 3": /dualtron\s+thunder\s*3/i,
    "Dualtron Thunder 2": /dualtron\s+thunder\s*2/i,
    "Dualtron Thunder": /dualtron\s+thunder(?!\s*[23])/i,
    "Dualtron Victor": /dualtron\s+victor/i,
    "Dualtron Victor Luxury": /dualtron\s+victor\s+luxury/i,
    "Dualtron Storm": /dualtron\s+storm/i,
    "Dualtron Storm LTD": /dualtron\s+storm\s+ltd/i,
    "Dualtron Achilleus": /dualtron\s+achilleus/i,
    "Dualtron City": /dualtron\s+city/i,
    "Dualtron X": /dualtron\s+x(?:\s|$)/i,
    "Dualtron Spider": /dualtron\s+spider/i,
    "Dualtron Eagle": /dualtron\s+eagle/i,
    "Dualtron Forever": /dualtron\s+forever/i,
    "Dualtron Togo": /dualtron\s+togo/i,
    "Dualtron Sonic": /dualtron\s+sonic/i,
    "Dualtron Aminia": /dualtron\s+aminia/i,
    "Xiaomi M365": /xiaomi\s+m365/i,
    "Xiaomi M365 Pro": /xiaomi\s+m365\s+pro/i,
    "Xiaomi Pro 2": /xiaomi\s+(pro\s*2|essential)/i,
    "Xiaomi Mi 4": /xiaomi\s+mi\s*4/i,
    "Ninebot G30 Max": /ninebot\s+g30\s*max/i,
    "Ninebot G2": /ninebot\s+g2/i,
    "Ninebot ES2": /ninebot\s+es2/i,
    "Ninebot F2": /ninebot\s+f2/i,
    "Vsett 10+": /vsett\s+10\+?/i,
    "Vsett 11+": /vsett\s+11\+?/i,
    "Vsett 9+": /vsett\s+9\+?/i,
    "Teverun Fighter": /teverun\s+fighter/i,
    "Etwow Booster": /etwow\s+booster/i,
    "Kukirin G2 Max": /kukirin\s+g2\s*max/i,
    "Kukirin G2 Pro": /kukirin\s+g2\s*pro/i,
    "Kukirin M4 Max": /kukirin\s+m4\s*max/i,
    "Kukirin S1 Max": /kukirin\s+s1\s*max/i,
    "Kukirin T3": /kukirin\s+t3/i,
    "Kukirin A1": /kukirin\s+a1/i,
    "Kugoo G2 Pro": /kugoo\s+g2\s*pro/i,
  };

  // Match most specific first (longer names)
  const sorted = Object.entries(patterns).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [model, regex] of sorted) {
    if (regex.test(name)) {
      // Don't add a sub-model if a more specific one was already found
      const isSubOf = models.some(
        (m) => m.startsWith(model) || model.startsWith(m),
      );
      if (!isSubOf) models.push(model);
    }
  }

  return models;
}

/** Build description for a spare part */
function buildDescription(row: WattizRow): string {
  const parts: string[] = [];
  parts.push(`${row.NAME}.`);

  if (row.FEATURES) {
    const feats = row.FEATURES.split(" - ")
      .map((f) => f.trim())
      .filter(Boolean);
    if (feats.length > 0) {
      parts.push(feats.join(". ") + ".");
    }
  }

  const models = extractCompatibleModels(row.NAME);
  if (models.length > 0) {
    parts.push(`Compatible : ${models.join(", ")}.`);
  }

  parts.push(
    "Pièce détachée disponible chez TrottiStore — atelier de réparation à L'Île-Saint-Denis.",
  );

  return parts.join(" ");
}

/** Get the deepest category name from the hierarchy */
function getLeafCategory(categories: string): string {
  if (!categories) return "Pièces détachées";
  const parts = categories.split(" / ").map((s) => s.trim());
  return parts[parts.length - 1] || "Pièces détachées";
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log(`\n🔧 Import Wattiz spare parts → ${API_BASE}\n`);

  // Auth
  const jwtSecret = process.env.JWT_ACCESS_SECRET;
  if (!jwtSecret) throw new Error("JWT_ACCESS_SECRET required");
  accessToken = signJwt(
    {
      sub: "00000000-0000-0000-0000-000000000000",
      email: "admin@trottistore.fr",
      role: "SUPERADMIN",
    },
    jwtSecret,
    7200,
  );
  console.log("✓ Auth OK\n");

  // Parse CSV
  const rows = parseCsv("/Users/lyes/Downloads/wattiz.csv");
  console.log(`Parsed ${rows.length} rows from CSV\n`);

  // 1. Create brands
  console.log("── Brands ──");
  const brandNames = [
    ...new Set(rows.map((r) => r.MARQUE).filter(Boolean)),
  ];
  const brandIds: Record<string, string> = {};

  for (const name of brandNames) {
    try {
      const res = await api("POST", "/admin/brands", { name });
      brandIds[name] = res.data.id;
      console.log(`  ✓ ${name} → ${res.data.id.slice(0, 8)}`);
    } catch (err: any) {
      console.log(`  ✗ ${name}: ${err.message?.slice(0, 80)}`);
    }
  }

  // 2. Create categories from CSV hierarchy
  console.log("\n── Categories ──");
  const catMap: Record<string, string> = {}; // slug → id
  const leafCats = new Set<string>();

  for (const row of rows) {
    if (!row.CATEGORIES) continue;
    const parts = row.CATEGORIES.split(" / ").map((s) => s.trim());
    // We want the deepest (leaf) category
    const leaf = parts[parts.length - 1];
    leafCats.add(leaf);
  }

  // Also add a generic one
  leafCats.add("Pièces détachées");

  for (const catName of leafCats) {
    const slug = slugify(catName);
    if (catMap[slug]) continue;
    try {
      const res = await api("POST", "/admin/categories", {
        name: catName,
        isActive: true,
      });
      catMap[slug] = res.data.id;
    } catch {
      // May already exist — try to find it
    }
  }
  console.log(`  Created/found ${Object.keys(catMap).length} categories`);

  // Fetch all categories to fill catMap
  try {
    const catRes = await api("GET", "/admin/categories");
    for (const c of catRes.data || []) {
      catMap[c.slug] = c.id;
    }
  } catch {}
  console.log(`  Total categories in DB: ${Object.keys(catMap).length}`);

  // 3. Import products in batches
  console.log(`\n── Products (${rows.length}) ──`);
  let created = 0;
  let skipped = 0;
  let errors = 0;
  const batchSize = 1; // Sequential to avoid rate limits

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row.SKU || !row.NAME) {
      skipped++;
      continue;
    }

    const priceHt = parsePrice(row.PRICE_HT);
    const weightGrams = parseWeight(row.WEIGHT_KG);
    const brandId = row.MARQUE ? brandIds[row.MARQUE] : undefined;
    const leafCat = getLeafCategory(row.CATEGORIES);
    const catSlug = slugify(leafCat);
    const categoryId = catMap[catSlug];
    const compatibleModels = extractCompatibleModels(row.NAME);

    // Parse images (separated by " - ")
    const imageUrls = row.IMAGES
      ? row.IMAGES.split(" - ")
          .map((u) => u.trim())
          .filter((u) => u.startsWith("http"))
      : [];

    const images = imageUrls.map((url, idx) => ({
      url,
      alt: row.NAME,
      isPrimary: idx === 0,
    }));

    const body: Record<string, unknown> = {
      name: row.NAME,
      sku: row.SKU,
      description: buildDescription(row),
      shortDescription: row.NAME,
      priceHt,
      tvaRate: 20,
      status: "ACTIVE",
      isFeatured: false,
      metaTitle: `${row.NAME} | TrottiStore`,
      metaDesc: `${row.NAME} — pièce détachée trottinette électrique. Disponible chez TrottiStore, atelier de réparation à L'Île-Saint-Denis.`,
      ...(weightGrams ? { weightGrams } : {}),
      ...(brandId ? { brandId } : {}),
      ...(categoryId ? { categories: [categoryId] } : {}),
      ...(images.length > 0 ? { images } : {}),
      ...(compatibleModels.length > 0 ? { compatibleModels } : {}),
    };

    try {
      await api("POST", "/admin/products", body);
      created++;
      if (created % 100 === 0) {
        console.log(
          `  ... ${created} created (${i + 1}/${rows.length})`,
        );
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("409") || msg.includes("DUPLICATE")) {
        skipped++;
      } else {
        errors++;
        if (errors <= 10) {
          console.log(
            `  ✗ ${row.SKU}: ${msg.slice(0, 120)}`,
          );
        }
      }
    }
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`  Created:  ${created}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Total:    ${rows.length}`);
  console.log(`═══════════════════════════════════\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
