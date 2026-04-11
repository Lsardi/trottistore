/**
 * TrottiStore — Crawler générique multi-fournisseurs.
 *
 * Conçu pour scraper des catalogues fournisseurs externes (Volt, Wattiz, etc.)
 * et merger leurs produits dans data/crawl/suppliers/<slug>/products.json.
 * Le crawler trottistore.fr historique reste dans crawl.ts (focalisé sur la
 * migration WooCommerce du site actuel).
 *
 * Usage:
 *   pnpm tsx scripts/crawl-suppliers.ts                 # crawl tous les suppliers configurés
 *   pnpm tsx scripts/crawl-suppliers.ts --supplier volt # un seul
 *
 * Pour ajouter un fournisseur : éditer le SUPPLIERS array ci-dessous avec
 * les sélecteurs CSS appropriés. Le crawler est volontairement simple
 * (pas de framework headless) car les sites e-commerce typiques exposent
 * leur catalogue en HTML server-rendered.
 */

import * as cheerio from "cheerio";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = join(__dirname, "..", "data", "crawl", "suppliers");
const USER_AGENT = "TrottiStore-Bot/1.0 (catalog-sync; contact@trottistore.fr)";
const REQUEST_DELAY_MS = 400; // politesse: 2.5 req/sec max

// ─── Types ─────────────────────────────────────────────────────────────────

interface SupplierProduct {
  url: string;
  name: string;
  reference: string | null;
  brand: string | null;
  priceText: string | null; // ex: "299,90 €" — parsing fait au seed-time
  priceCents: number | null; // si parsable
  description: string | null;
  imageUrl: string | null;
  inStock: boolean | null;
  attributes: Record<string, string>;
  scrapedAt: string;
  sourceSupplier: string;
}

/**
 * Configuration d'un fournisseur. Chaque champ select* est un sélecteur CSS
 * (cheerio) appliqué sur le HTML du produit. Si le sélecteur n'est pas trouvé
 * pour un produit donné, on garde null (mieux vaut un champ vide qu'un faux
 * positif).
 */
interface SupplierConfig {
  slug: string;
  name: string;
  baseUrl: string;
  /** Liste de pages catalogue à crawler en seed (toutes les catégories). */
  seedUrls: string[];
  /** Sélecteur CSS pour trouver les liens vers les fiches produit dans une page catalogue. */
  productLinkSelector: string;
  /** Sélecteur du nom sur la fiche produit. */
  selectName: string;
  /** Sélecteur du prix (texte brut, parser au seed). */
  selectPrice: string;
  /** Sélecteur de la référence/SKU si dispo. */
  selectRef: string | null;
  /** Sélecteur de la marque si dispo. */
  selectBrand: string | null;
  /** Sélecteur de la description longue. */
  selectDescription: string;
  /** Sélecteur de l'image principale (attribut src de la balise img). */
  selectImage: string;
  /** Sélecteur du badge in-stock (présent = en stock). */
  selectInStock: string | null;
  /** Sélecteur des attributes (paires clé:valeur dans une dl ou table). */
  selectAttributesContainer: string | null;
  /** Limit safety per supplier */
  maxProducts: number;
}

// ─── Suppliers ─────────────────────────────────────────────────────────────
//
// IMPORTANT: les selectors sont à valider sur le HTML réel de chaque site.
// Tester avec `curl -A "$USER_AGENT" <URL> | grep <selector>` avant d'activer.

const SUPPLIERS: SupplierConfig[] = [
  {
    slug: "volt",
    name: "Volt",
    baseUrl: "https://www.volt-trottinette.com",
    seedUrls: [
      // À compléter avec les vraies URLs de catégorie. Exemples placeholder:
      // "https://www.volt-trottinette.com/categorie-produit/trottinettes/",
      // "https://www.volt-trottinette.com/categorie-produit/pieces/",
    ],
    productLinkSelector: "a.woocommerce-LoopProduct-link, a.product-loop",
    selectName: "h1.product_title, h1.entry-title",
    selectPrice: "p.price .woocommerce-Price-amount, .price .amount",
    selectRef: ".sku, .product_meta .sku",
    selectBrand: ".product_meta .posted_in a, .pa_marque",
    selectDescription: "#tab-description, .woocommerce-product-details__short-description",
    selectImage: ".woocommerce-product-gallery__image img, .product-gallery img",
    selectInStock: ".stock.in-stock",
    selectAttributesContainer: "table.shop_attributes, .product-attributes",
    maxProducts: 1000,
  },
  {
    slug: "wattiz",
    name: "Wattiz",
    baseUrl: "https://www.wattiz.fr",
    seedUrls: [
      // À compléter avec les vraies URLs de catégorie.
      // "https://www.wattiz.fr/categorie/trottinettes/",
      // "https://www.wattiz.fr/categorie/pieces/",
    ],
    productLinkSelector: "a.product-card, a.product-link, .product a[href*='/produit/']",
    selectName: "h1.product-name, h1.product__title",
    selectPrice: ".product-price, .price",
    selectRef: ".product-sku, .sku",
    selectBrand: ".product-brand, .pa_marque",
    selectDescription: ".product-description, .product__description",
    selectImage: ".product-image img, .product__image img",
    selectInStock: ".in-stock, .available",
    selectAttributesContainer: ".product-attributes, .product__details",
    maxProducts: 1000,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      console.warn(`  [${res.status}] ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`  [error] ${url}: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Parse a French-formatted price string ("1 299,90 €", "299€90") into cents.
 * Returns null on failure (caller keeps the raw priceText for the seed step).
 */
function parsePriceToCents(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text
    .replace(/\u00A0/g, " ")
    .replace(/[^\d,.\s€]/g, "")
    .trim();
  const match = cleaned.match(/(\d[\d\s]*[,.]?\d*)/);
  if (!match) return null;
  const numericStr = match[1].replace(/\s/g, "").replace(",", ".");
  const value = parseFloat(numericStr);
  if (isNaN(value)) return null;
  return Math.round(value * 100);
}

function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractAttributes($: cheerio.CheerioAPI, containerSelector: string | null): Record<string, string> {
  if (!containerSelector) return {};
  const attrs: Record<string, string> = {};
  // Try table format first
  $(`${containerSelector} tr`).each((_, row) => {
    const $row = $(row);
    const key = $row.find("th, td").first().text().trim();
    const value = $row.find("td").last().text().trim();
    if (key && value && key !== value) attrs[key] = value;
  });
  // Try dl format
  $(`${containerSelector} dt`).each((_, dt) => {
    const key = $(dt).text().trim();
    const value = $(dt).next("dd").text().trim();
    if (key && value) attrs[key] = value;
  });
  return attrs;
}

// ─── Crawler core ──────────────────────────────────────────────────────────

async function crawlProductPage(
  url: string,
  config: SupplierConfig,
): Promise<SupplierProduct | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const $ = cheerio.load(html);
  const name = $(config.selectName).first().text().trim();
  if (!name) {
    console.warn(`  [skip] no name for ${url}`);
    return null;
  }

  const priceText = $(config.selectPrice).first().text().trim() || null;
  const priceCents = parsePriceToCents(priceText);
  const reference = config.selectRef ? $(config.selectRef).first().text().trim() || null : null;
  const brand = config.selectBrand ? $(config.selectBrand).first().text().trim() || null : null;
  const description = $(config.selectDescription).first().text().trim() || null;
  const imageUrl = $(config.selectImage).first().attr("src") || null;
  const absoluteImageUrl = imageUrl ? absoluteUrl(imageUrl, config.baseUrl) : null;
  const inStock = config.selectInStock ? $(config.selectInStock).length > 0 : null;
  const attributes = extractAttributes($, config.selectAttributesContainer);

  return {
    url,
    name,
    reference,
    brand,
    priceText,
    priceCents,
    description,
    imageUrl: absoluteImageUrl,
    inStock,
    attributes,
    scrapedAt: new Date().toISOString(),
    sourceSupplier: config.slug,
  };
}

async function crawlSeedPage(url: string, config: SupplierConfig): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const links: string[] = [];
  $(config.productLinkSelector).each((_, el) => {
    const href = $(el).attr("href");
    if (href) links.push(absoluteUrl(href, config.baseUrl));
  });
  return Array.from(new Set(links));
}

async function crawlSupplier(config: SupplierConfig): Promise<SupplierProduct[]> {
  console.log(`\n── ${config.name} (${config.slug}) ──`);
  if (config.seedUrls.length === 0) {
    console.log(`  ⚠ No seed URLs configured. Edit SUPPLIERS in scripts/crawl-suppliers.ts to add them.`);
    return [];
  }

  // 1. Discover product URLs from seed pages
  const productUrls = new Set<string>();
  for (const seedUrl of config.seedUrls) {
    console.log(`  seed: ${seedUrl}`);
    const links = await crawlSeedPage(seedUrl, config);
    for (const link of links) productUrls.add(link);
    await sleep(REQUEST_DELAY_MS);
    if (productUrls.size >= config.maxProducts) break;
  }
  console.log(`  found ${productUrls.size} product URLs`);

  // 2. Crawl each product page
  const products: SupplierProduct[] = [];
  let i = 0;
  for (const url of productUrls) {
    if (products.length >= config.maxProducts) break;
    i++;
    if (i % 25 === 0) console.log(`  progress: ${i}/${productUrls.size}`);
    const product = await crawlProductPage(url, config);
    if (product) products.push(product);
    await sleep(REQUEST_DELAY_MS);
  }
  console.log(`  scraped ${products.length} products`);
  return products;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const supplierFlag = args.indexOf("--supplier");
  const onlySupplier = supplierFlag >= 0 ? args[supplierFlag + 1] : null;

  const targets = onlySupplier
    ? SUPPLIERS.filter((s) => s.slug === onlySupplier)
    : SUPPLIERS;

  if (targets.length === 0) {
    console.error(`Unknown supplier: ${onlySupplier}`);
    console.error(`Available: ${SUPPLIERS.map((s) => s.slug).join(", ")}`);
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const config of targets) {
    const products = await crawlSupplier(config);
    const outFile = join(OUTPUT_DIR, `${config.slug}.json`);
    await writeFile(outFile, JSON.stringify({ supplier: config.slug, count: products.length, scrapedAt: new Date().toISOString(), products }, null, 2));
    console.log(`  wrote ${outFile}`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
