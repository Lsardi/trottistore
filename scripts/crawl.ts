/**
 * TrottiStore — Crawler complet et profond du site actuel (trottistore.fr)
 *
 * Parcourt récursivement TOUTES les pages du site WooCommerce,
 * extrait les données structurées, télécharge les images,
 * et exporte le tout en JSON dans data/crawl/.
 *
 * Usage : cd scripts && pnpm crawl
 */

import * as cheerio from "cheerio";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

// ─── CONFIG ────────────────────────────────────────────────────────────────

const BASE_URL = "https://www.trottistore.fr";
const CRAWL_DELAY_MS = 200; // Politesse : 200ms entre chaque requête
const MAX_PAGES = 5000; // Sécurité : limite max de pages
const MAX_CONCURRENT_IMAGES = 5; // Téléchargements images en parallèle
const OUTPUT_DIR = join(dirname(import.meta.url.replace("file://", "")), "..", "data", "crawl");
const USER_AGENT = "TrottiStore-Crawler/1.0 (migration interne)";

// ─── TYPES ─────────────────────────────────────────────────────────────────

interface CrawledPage {
  url: string;
  type: PageType;
  status: number;
  title: string;
  metaDescription: string;
  metaTitle: string;
  canonical: string;
  ogData: Record<string, string>;
  jsonLd: unknown[];
  internalLinks: string[];
  externalLinks: string[];
  crawledAt: string;
}

type PageType =
  | "product"
  | "category"
  | "page"
  | "blog-post"
  | "blog-archive"
  | "cart"
  | "checkout"
  | "account"
  | "search"
  | "homepage"
  | "other";

interface Product {
  url: string;
  slug: string;
  name: string;
  sku: string;
  price: string;
  priceRegular: string;
  priceSale: string;
  currency: string;
  description: string;
  shortDescription: string;
  categories: string[];
  tags: string[];
  images: ProductImage[];
  attributes: Record<string, string>;
  inStock: boolean;
  metaTitle: string;
  metaDescription: string;
  breadcrumbs: string[];
  relatedProducts: string[];
  reviews: Review[];
  jsonLd: unknown;
}

interface ProductImage {
  url: string;
  alt: string;
  localPath: string;
  isPrimary: boolean;
}

interface Category {
  url: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  parentSlug: string;
  productCount: number;
  children: string[];
  breadcrumbs: string[];
}

interface StaticPage {
  url: string;
  slug: string;
  title: string;
  contentHtml: string;
  contentText: string;
  metaTitle: string;
  metaDescription: string;
}

interface BlogPost {
  url: string;
  slug: string;
  title: string;
  contentHtml: string;
  contentText: string;
  author: string;
  date: string;
  categories: string[];
  featuredImage: string;
  metaTitle: string;
  metaDescription: string;
}

interface Review {
  author: string;
  rating: number;
  date: string;
  content: string;
}

interface NavItem {
  label: string;
  url: string;
  children: NavItem[];
}

interface FormData {
  url: string;
  action: string;
  method: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    placeholder: string;
  }>;
}

interface MediaItem {
  url: string;
  type: string; // image, pdf, video, etc.
  foundOn: string;
}

// ─── STATE ─────────────────────────────────────────────────────────────────

const visited = new Set<string>();
const queue: string[] = [];
const allPages: CrawledPage[] = [];
const products: Product[] = [];
const categories: Category[] = [];
const pages: StaticPage[] = [];
const blogPosts: BlogPost[] = [];
const reviews: Review[] = [];
const navigation: { header: NavItem[]; footer: NavItem[] } = { header: [], footer: [] };
const forms: FormData[] = [];
const media: MediaItem[] = [];
const linksGraph: Record<string, string[]> = {};
const seoData: Record<string, { title: string; description: string; canonical: string; ogData: Record<string, string> }> = {};

// ─── UTILS ─────────────────────────────────────────────────────────────────

// Query params WooCommerce à supprimer (actions, nonces, parasites)
const WOOCOMMERCE_JUNK_PARAMS = [
  "add-to-cart", "add-to-wishlist", "add_to_compare", "remove_compare_item",
  "_wpnonce", "wc-ajax", "removed_item", "undo_item",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "mc_cid", "mc_eid",
];

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url, BASE_URL);
    u.hash = "";

    // Supprimer TOUS les query params parasites WooCommerce
    for (const param of WOOCOMMERCE_JUNK_PARAMS) {
      u.searchParams.delete(param);
    }

    // Si après nettoyage il reste des params type action WC, les virer aussi
    for (const [key] of u.searchParams) {
      if (key.startsWith("add-to-") || key.startsWith("add_to_") || key.startsWith("remove_") || key.startsWith("_wp")) {
        u.searchParams.delete(key);
      }
    }

    // Retirer le trailing slash sauf pour la racine
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    u.pathname = path;

    return u.toString();
  } catch {
    return "";
  }
}

function isInternalUrl(url: string): boolean {
  try {
    const u = new URL(url, BASE_URL);
    const host = u.hostname;
    // Accepter les deux variantes : avec et sans www
    return host === "trottistore.fr" || host === "www.trottistore.fr";
  } catch {
    return false;
  }
}

function classifyPage(url: string, $: cheerio.CheerioAPI): PageType {
  const path = new URL(url, BASE_URL).pathname;

  if (path === "/" || path === "") return "homepage";
  if (path.includes("/product/") || path.includes("/produit/") || $("body").hasClass("single-product") || $(".product_title").length > 0) return "product";
  if (path.includes("/product-category/") || path.includes("/categorie-produit/") || $("body").hasClass("tax-product_cat")) return "category";
  if (path.includes("/blog/") || path.includes("/actualites/") || $("body").hasClass("single-post")) return "blog-post";
  if ($("body").hasClass("blog") || $("body").hasClass("archive")) return "blog-archive";
  if (path.includes("/cart") || path.includes("/panier")) return "cart";
  if (path.includes("/checkout") || path.includes("/commander")) return "checkout";
  if (path.includes("/my-account") || path.includes("/mon-compte")) return "account";
  if (path.includes("?s=") || path.includes("/search")) return "search";
  if ($("body").hasClass("page")) return "page";

  return "other";
}

function slugFromUrl(url: string): string {
  const path = new URL(url, BASE_URL).pathname;
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "index";
}

async function fetchPage(url: string): Promise<{ html: string; status: number } | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    const html = await resp.text();
    return { html, status: resp.status };
  } catch (err) {
    console.error(`  ❌ Erreur fetch ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function downloadImage(imageUrl: string, localPath: string): Promise<void> {
  const fullPath = join(OUTPUT_DIR, "images", localPath);
  if (existsSync(fullPath)) return;

  try {
    await mkdir(dirname(fullPath), { recursive: true });
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok || !resp.body) return;

    const fileStream = Writable.toWeb(
      await import("node:fs").then((fs) => fs.createWriteStream(fullPath))
    );
    await resp.body.pipeTo(fileStream);
  } catch (err) {
    console.error(`  ⚠️ Image download failed: ${imageUrl} — ${(err as Error).message}`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── PARSERS ───────────────────────────────────────────────────────────────

function extractSeoData($: cheerio.CheerioAPI, url: string) {
  const ogData: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property") || "";
    ogData[prop] = $(el).attr("content") || "";
  });

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      jsonLd.push(JSON.parse($(el).html() || "{}"));
    } catch {}
  });

  const data = {
    title: $("title").text().trim(),
    description: $('meta[name="description"]').attr("content") || "",
    canonical: $('link[rel="canonical"]').attr("href") || url,
    ogData,
  };

  seoData[url] = data;
  return { ...data, jsonLd };
}

function extractLinks($: cheerio.CheerioAPI, pageUrl: string): { internal: string[]; external: string[] } {
  const internal: string[] = [];
  const external: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

    const normalized = normalizeUrl(href);
    if (!normalized) return;

    if (isInternalUrl(normalized)) {
      internal.push(normalized);
    } else {
      external.push(normalized);
    }
  });

  linksGraph[pageUrl] = [...new Set(internal)];
  return { internal: [...new Set(internal)], external: [...new Set(external)] };
}

function extractMedia($: cheerio.CheerioAPI, pageUrl: string) {
  // Images
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src") || "";
    const srcset = $(el).attr("srcset") || "";
    if (src) {
      media.push({ url: normalizeUrl(src) || src, type: "image", foundOn: pageUrl });
    }
    // Parse srcset pour toutes les résolutions
    srcset.split(",").forEach((entry) => {
      const imgUrl = entry.trim().split(/\s+/)[0];
      if (imgUrl) {
        media.push({ url: normalizeUrl(imgUrl) || imgUrl, type: "image", foundOn: pageUrl });
      }
    });
  });

  // PDFs et documents
  $('a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"], a[href$=".xlsx"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const ext = href.split(".").pop()?.toLowerCase() || "unknown";
    media.push({ url: normalizeUrl(href) || href, type: ext, foundOn: pageUrl });
  });

  // Videos
  $("video source[src], iframe[src*='youtube'], iframe[src*='vimeo']").each((_, el) => {
    const src = $(el).attr("src") || "";
    media.push({ url: src, type: "video", foundOn: pageUrl });
  });
}

function extractForms($: cheerio.CheerioAPI, pageUrl: string) {
  $("form").each((_, el) => {
    const $form = $(el);
    const fields: FormData["fields"] = [];

    $form.find("input, textarea, select").each((_, field) => {
      const $field = $(field);
      const name = $field.attr("name") || "";
      if (!name || name.startsWith("_")) return; // Skip WP nonces
      fields.push({
        name,
        type: $field.attr("type") || $field.prop("tagName")?.toLowerCase() || "text",
        required: $field.attr("required") !== undefined,
        placeholder: $field.attr("placeholder") || "",
      });
    });

    if (fields.length > 0) {
      forms.push({
        url: pageUrl,
        action: $form.attr("action") || pageUrl,
        method: ($form.attr("method") || "GET").toUpperCase(),
        fields,
      });
    }
  });
}

function extractNavigation($: cheerio.CheerioAPI) {
  // Ne l'extraire qu'une fois (depuis la homepage)
  if (navigation.header.length > 0) return;

  function parseMenu(selector: string): NavItem[] {
    const items: NavItem[] = [];
    $(selector).children("li").each((_, li) => {
      const $li = $(li);
      const $a = $li.children("a").first();
      const item: NavItem = {
        label: $a.text().trim(),
        url: normalizeUrl($a.attr("href") || ""),
        children: [],
      };
      const $submenu = $li.children("ul");
      if ($submenu.length > 0) {
        $submenu.children("li").each((_, subLi) => {
          const $subA = $(subLi).children("a").first();
          item.children.push({
            label: $subA.text().trim(),
            url: normalizeUrl($subA.attr("href") || ""),
            children: [],
          });
        });
      }
      if (item.label) items.push(item);
    });
    return items;
  }

  // Tenter différents sélecteurs WooCommerce/WordPress courants
  const headerSelectors = [
    "nav.main-navigation ul.menu",
    "header nav ul",
    "#primary-menu",
    ".main-menu > ul",
    "#mega-menu-wrap-primary #mega-menu-primary",
    "nav ul.navbar-nav",
  ];
  for (const sel of headerSelectors) {
    const items = parseMenu(sel);
    if (items.length > 0) {
      navigation.header = items;
      break;
    }
  }

  // Footer
  const footerSelectors = ["footer nav ul", ".footer-menu ul", "#footer-menu", "footer ul.menu"];
  for (const sel of footerSelectors) {
    const items = parseMenu(sel);
    if (items.length > 0) {
      navigation.footer = items;
      break;
    }
  }
}

// ─── PARSERS PAR TYPE DE PAGE ──────────────────────────────────────────────

function parseProduct($: cheerio.CheerioAPI, url: string): Product {
  const slug = slugFromUrl(url);

  // Nom du produit
  const name =
    $(".product_title").text().trim() ||
    $("h1.entry-title").text().trim() ||
    $("h1").first().text().trim();

  // Prix
  const price = $(".price .woocommerce-Price-amount").first().text().trim();
  const priceRegular = $(".price del .woocommerce-Price-amount").text().trim();
  const priceSale = $(".price ins .woocommerce-Price-amount").text().trim();

  // SKU
  const sku = $(".sku").text().trim();

  // Description
  const description = $(".woocommerce-product-details__short-description, #tab-description .woocommerce-Tabs-panel--description, .product-description").html()?.trim() || "";
  const shortDescription = $(".woocommerce-product-details__short-description").html()?.trim() || "";

  // Catégories
  const categoriesArr: string[] = [];
  $(".posted_in a, .product_meta .posted_in a").each((_, el) => {
    categoriesArr.push($(el).text().trim());
  });

  // Tags
  const tags: string[] = [];
  $(".tagged_as a, .product_meta .tagged_as a").each((_, el) => {
    tags.push($(el).text().trim());
  });

  // Images
  const imagesArr: ProductImage[] = [];
  $(".woocommerce-product-gallery__image img, .product-images img, .wp-post-image").each(
    (i, el) => {
      const $img = $(el);
      const imgUrl =
        $img.attr("data-large_image") ||
        $img.attr("data-src") ||
        $img.attr("src") ||
        "";
      if (imgUrl && !imgUrl.includes("placeholder")) {
        const ext = imgUrl.split(".").pop()?.split("?")[0] || "jpg";
        imagesArr.push({
          url: imgUrl.startsWith("http") ? imgUrl : new URL(imgUrl, BASE_URL).toString(),
          alt: $img.attr("alt") || name,
          localPath: `${slug}/${i === 0 ? "main" : `gallery-${i}`}.${ext}`,
          isPrimary: i === 0,
        });
      }
    }
  );

  // Attributs techniques
  const attributes: Record<string, string> = {};
  $(".woocommerce-product-attributes tr, .shop_attributes tr").each((_, row) => {
    const key = $(row).find("th").text().trim();
    const value = $(row).find("td").text().trim();
    if (key && value) attributes[key] = value;
  });

  // Stock
  const stockText = $(".stock").text().toLowerCase();
  const inStock = !stockText.includes("rupture") && !stockText.includes("out of stock");

  // Breadcrumbs
  const breadcrumbs: string[] = [];
  $(".woocommerce-breadcrumb a, .breadcrumb a, nav.breadcrumb a").each((_, el) => {
    breadcrumbs.push($(el).text().trim());
  });

  // Produits liés
  const relatedProducts: string[] = [];
  $(".related.products .product a.woocommerce-loop-product__link, .related-products a").each(
    (_, el) => {
      const href = $(el).attr("href");
      if (href) relatedProducts.push(normalizeUrl(href));
    }
  );

  // Avis
  const productReviews: Review[] = [];
  $(".woocommerce-Reviews .comment, #reviews .review").each((_, el) => {
    const $review = $(el);
    productReviews.push({
      author: $review.find(".woocommerce-review__author, .comment-author").text().trim(),
      rating: $review.find(".star-rating, .rating").find("strong").length || parseInt($review.find('[itemprop="ratingValue"]').text()) || 0,
      date: $review.find(".woocommerce-review__published-date, time").attr("datetime") || $review.find("time").text().trim(),
      content: $review.find(".description p, .comment-text p").text().trim(),
    });
  });

  reviews.push(...productReviews);

  // JSON-LD produit
  let jsonLd: unknown = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "{}");
      if (data["@type"] === "Product" || data["@type"]?.includes("Product")) {
        jsonLd = data;
      }
    } catch {}
  });

  const seo = extractSeoData($, url);

  return {
    url,
    slug,
    name,
    sku,
    price,
    priceRegular,
    priceSale,
    currency: "EUR",
    description,
    shortDescription,
    categories: categoriesArr,
    tags,
    images: imagesArr,
    attributes,
    inStock,
    metaTitle: seo.title,
    metaDescription: seo.description,
    breadcrumbs,
    relatedProducts: [...new Set(relatedProducts)],
    reviews: productReviews,
    jsonLd,
  };
}

function parseCategory($: cheerio.CheerioAPI, url: string): Category {
  const slug = slugFromUrl(url);
  const name =
    $(".woocommerce-products-header__title").text().trim() ||
    $("h1.page-title").text().trim() ||
    $("h1").first().text().trim();

  const description = $(".term-description, .taxonomy-description").html()?.trim() || "";
  const imageUrl = $(".category-image img, .term-image img").attr("src") || "";

  // Sous-catégories
  const children: string[] = [];
  $(".product-category a, .sub-categories a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) children.push(normalizeUrl(href));
  });

  // Compter les produits visibles
  const productCount = $(".products .product, ul.products li.product").length;

  // Breadcrumbs pour déterminer le parent
  const breadcrumbs: string[] = [];
  let parentSlug = "";
  $(".woocommerce-breadcrumb a, .breadcrumb a").each((i, el) => {
    const text = $(el).text().trim();
    breadcrumbs.push(text);
    // L'avant-dernier breadcrumb est le parent
    const href = $(el).attr("href") || "";
    if (href.includes("/product-category/") || href.includes("/categorie-produit/")) {
      parentSlug = slugFromUrl(href);
    }
  });

  return {
    url,
    slug,
    name,
    description,
    imageUrl: imageUrl ? new URL(imageUrl, BASE_URL).toString() : "",
    parentSlug,
    productCount,
    children: [...new Set(children)],
    breadcrumbs,
  };
}

function parsePage($: cheerio.CheerioAPI, url: string): StaticPage {
  const slug = slugFromUrl(url);
  const title = $("h1.entry-title, h1.page-title, h1").first().text().trim();
  const $content = $(".entry-content, .page-content, article .content, main .content");
  const contentHtml = $content.html()?.trim() || "";
  const contentText = $content.text().trim();
  const seo = extractSeoData($, url);

  return {
    url,
    slug,
    title,
    contentHtml,
    contentText,
    metaTitle: seo.title,
    metaDescription: seo.description,
  };
}

function parseBlogPost($: cheerio.CheerioAPI, url: string): BlogPost {
  const slug = slugFromUrl(url);
  const title = $("h1.entry-title, h1").first().text().trim();
  const $content = $(".entry-content, article .content");
  const contentHtml = $content.html()?.trim() || "";
  const contentText = $content.text().trim();
  const author = $(".author a, .entry-author a, [rel='author']").first().text().trim();
  const date = $("time.entry-date, time.published").attr("datetime") || $("time").first().text().trim();
  const categoriesArr: string[] = [];
  $(".cat-links a, .entry-categories a").each((_, el) => {
    categoriesArr.push($(el).text().trim());
  });
  const featuredImage = $(".post-thumbnail img, .entry-featured-image img, article img").first().attr("src") || "";
  const seo = extractSeoData($, url);

  return {
    url,
    slug,
    title,
    contentHtml,
    contentText,
    author,
    date,
    categories: categoriesArr,
    featuredImage: featuredImage ? new URL(featuredImage, BASE_URL).toString() : "",
    metaTitle: seo.title,
    metaDescription: seo.description,
  };
}

// ─── PAGINATION HANDLER ────────────────────────────────────────────────────

function extractPaginationLinks($: cheerio.CheerioAPI): string[] {
  const links: string[] = [];
  $(".woocommerce-pagination a, .pagination a, .nav-links a, a.page-numbers").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const normalized = normalizeUrl(href);
      if (normalized && isInternalUrl(normalized)) {
        links.push(normalized);
      }
    }
  });
  return [...new Set(links)];
}

// ─── SITEMAP PARSER ────────────────────────────────────────────────────────

async function parseSitemap(): Promise<string[]> {
  const urls: string[] = [];

  async function fetchSitemapUrls(sitemapUrl: string) {
    try {
      console.log(`📋 Parsing sitemap: ${sitemapUrl}`);
      const resp = await fetch(sitemapUrl, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) return;
      const xml = await resp.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      // Sitemap index (contient d'autres sitemaps)
      $("sitemap loc").each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) urls.push(loc); // On va les re-fetcher
      });

      // URLs directes
      $("url loc").each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) urls.push(loc);
      });

      // Traiter les sous-sitemaps
      const subSitemaps = $("sitemap loc")
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean);
      for (const sub of subSitemaps) {
        await fetchSitemapUrls(sub);
        await delay(100);
      }
    } catch (err) {
      console.warn(`  ⚠️ Sitemap non trouvé ou erreur: ${sitemapUrl}`);
    }
  }

  // Tenter les chemins sitemap courants
  const sitemapPaths = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/wp-sitemap.xml",
    "/sitemap-index.xml",
  ];

  for (const path of sitemapPaths) {
    await fetchSitemapUrls(`${BASE_URL}${path}`);
  }

  return [...new Set(urls.filter((u) => isInternalUrl(u)))];
}

// ─── MAIN CRAWLER ──────────────────────────────────────────────────────────

async function crawl() {
  console.log("🕷️  TrottiStore Crawler — Démarrage");
  console.log(`🌐 URL de base : ${BASE_URL}`);
  console.log(`📁 Sortie : ${OUTPUT_DIR}`);
  console.log("");

  // Créer les dossiers de sortie
  await mkdir(join(OUTPUT_DIR, "images"), { recursive: true });
  await mkdir(join(OUTPUT_DIR, "raw-html"), { recursive: true });

  // Phase 1 : Découverte via sitemap
  console.log("═══ Phase 1 : Découverte via sitemap ═══");
  const sitemapUrls = await parseSitemap();
  console.log(`  📋 ${sitemapUrls.length} URLs trouvées dans les sitemaps`);

  // Ajouter les URLs du sitemap à la queue
  for (const url of sitemapUrls) {
    const normalized = normalizeUrl(url);
    if (normalized && !visited.has(normalized)) {
      queue.push(normalized);
    }
  }

  // Ajouter la homepage si pas déjà présente
  const homepageUrl = normalizeUrl(BASE_URL);
  if (!visited.has(homepageUrl)) {
    queue.unshift(homepageUrl); // En premier
  }

  // Phase 2 : Crawl BFS récursif
  console.log("");
  console.log("═══ Phase 2 : Crawl récursif BFS ═══");

  let pageCount = 0;
  const startTime = Date.now();

  while (queue.length > 0 && pageCount < MAX_PAGES) {
    const url = queue.shift()!;
    const normalized = normalizeUrl(url);

    if (!normalized || visited.has(normalized)) continue;
    if (!isInternalUrl(normalized)) continue;

    // Ignorer certains patterns
    const parsedUrl = new URL(normalized);
    const path = parsedUrl.pathname;
    const search = parsedUrl.search;
    if (
      path.includes("/wp-admin") ||
      path.includes("/wp-login") ||
      path.includes("/wp-json") ||
      path.includes("/feed") ||
      path.includes("/xmlrpc") ||
      path.includes("/wp-content/uploads") ||
      path.includes("/wp-cron") ||
      path.includes("/trackback") ||
      path.includes("/comment-page-") ||
      path.endsWith(".xml") ||
      path.endsWith(".css") ||
      path.endsWith(".js") ||
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".gif") ||
      path.endsWith(".svg") ||
      path.endsWith(".woff") ||
      path.endsWith(".woff2") ||
      // Ignorer toute URL avec des query params WooCommerce parasites
      search.includes("add-to-cart") ||
      search.includes("add-to-wishlist") ||
      search.includes("add_to_compare") ||
      search.includes("remove_compare") ||
      search.includes("removed_item") ||
      search.includes("wc-ajax") ||
      search.includes("_wpnonce") ||
      search.includes("replytocom")
    ) {
      continue;
    }

    visited.add(normalized);
    pageCount++;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  [${pageCount}] (${elapsed}s) ${normalized}`);

    // Fetch
    const result = await fetchPage(normalized);
    if (!result) continue;

    // Sauvegarder HTML brut
    const rawPath = join(
      OUTPUT_DIR,
      "raw-html",
      slugFromUrl(normalized) + ".html"
    );
    await writeFile(rawPath, result.html, "utf-8").catch(() => {});

    // Parser
    const $ = cheerio.load(result.html);
    const type = classifyPage(normalized, $);

    // SEO
    const seo = extractSeoData($, normalized);

    // Liens
    const links = extractLinks($, normalized);

    // Media
    extractMedia($, normalized);

    // Formulaires
    extractForms($, normalized);

    // Navigation (une seule fois depuis la homepage)
    if (type === "homepage") {
      extractNavigation($);
    }

    // Pagination
    const paginationLinks = extractPaginationLinks($);

    // Enregistrer la page crawlée
    const crawledPage: CrawledPage = {
      url: normalized,
      type,
      status: result.status,
      title: $("title").text().trim(),
      metaDescription: seo.description,
      metaTitle: seo.title,
      canonical: seo.canonical,
      ogData: seo.ogData,
      jsonLd: seo.jsonLd || [],
      internalLinks: links.internal,
      externalLinks: links.external,
      crawledAt: new Date().toISOString(),
    };
    allPages.push(crawledPage);

    // Parser selon le type
    switch (type) {
      case "product": {
        const product = parseProduct($, normalized);
        products.push(product);
        console.log(`    📦 Produit : ${product.name} (${product.sku || "no SKU"}) — ${product.price}`);
        break;
      }
      case "category": {
        const category = parseCategory($, normalized);
        categories.push(category);
        console.log(`    📂 Catégorie : ${category.name} (${category.productCount} produits)`);
        break;
      }
      case "page": {
        const page = parsePage($, normalized);
        pages.push(page);
        console.log(`    📄 Page : ${page.title}`);
        break;
      }
      case "blog-post": {
        const post = parseBlogPost($, normalized);
        blogPosts.push(post);
        console.log(`    📝 Blog : ${post.title}`);
        break;
      }
      case "homepage": {
        const page = parsePage($, normalized);
        pages.push(page);
        console.log(`    🏠 Homepage crawlée`);
        break;
      }
      default:
        console.log(`    ℹ️  Type: ${type}`);
    }

    // Ajouter les nouveaux liens à la queue
    for (const link of [...links.internal, ...paginationLinks]) {
      const normLink = normalizeUrl(link);
      if (normLink && !visited.has(normLink) && isInternalUrl(normLink)) {
        queue.push(normLink);
      }
    }

    // Délai de politesse
    await delay(CRAWL_DELAY_MS);
  }

  // Phase 3 : Téléchargement des images produits
  console.log("");
  console.log("═══ Phase 3 : Téléchargement des images produits ═══");

  const allImages = products.flatMap((p) => p.images);
  console.log(`  📷 ${allImages.length} images à télécharger`);

  // Télécharger par lots
  for (let i = 0; i < allImages.length; i += MAX_CONCURRENT_IMAGES) {
    const batch = allImages.slice(i, i + MAX_CONCURRENT_IMAGES);
    await Promise.all(
      batch.map((img) => downloadImage(img.url, img.localPath))
    );
    if (i % 20 === 0 && i > 0) {
      console.log(`  📷 ${i}/${allImages.length} images téléchargées...`);
    }
  }
  console.log(`  ✅ ${allImages.length} images traitées`);

  // Phase 4 : Export JSON
  console.log("");
  console.log("═══ Phase 4 : Export des données ═══");

  const exports = [
    { file: "sitemap.json", data: allPages, label: "Sitemap" },
    { file: "products.json", data: products, label: "Produits" },
    { file: "categories.json", data: categories, label: "Catégories" },
    { file: "pages.json", data: pages, label: "Pages" },
    { file: "blog.json", data: blogPosts, label: "Articles blog" },
    { file: "reviews.json", data: reviews, label: "Avis clients" },
    { file: "seo.json", data: seoData, label: "SEO" },
    { file: "navigation.json", data: navigation, label: "Navigation" },
    {
      file: "media.json",
      data: [...new Map(media.map((m) => [m.url, m])).values()],
      label: "Médias",
    },
    { file: "forms.json", data: forms, label: "Formulaires" },
    { file: "links-graph.json", data: linksGraph, label: "Graphe de liens" },
  ];

  for (const exp of exports) {
    const filePath = join(OUTPUT_DIR, exp.file);
    await writeFile(filePath, JSON.stringify(exp.data, null, 2), "utf-8");
    const count = Array.isArray(exp.data)
      ? exp.data.length
      : Object.keys(exp.data).length;
    console.log(`  ✅ ${exp.label} → ${exp.file} (${count} entrées)`);
  }

  // Résumé final
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log("═══════════════════════════════════════════");
  console.log("  🎉 CRAWL TERMINÉ");
  console.log(`  ⏱️  Durée : ${totalTime}s`);
  console.log(`  📄 Pages crawlées : ${pageCount}`);
  console.log(`  📦 Produits : ${products.length}`);
  console.log(`  📂 Catégories : ${categories.length}`);
  console.log(`  📄 Pages statiques : ${pages.length}`);
  console.log(`  📝 Articles blog : ${blogPosts.length}`);
  console.log(`  ⭐ Avis clients : ${reviews.length}`);
  console.log(`  📷 Images : ${allImages.length}`);
  console.log(`  🔗 Liens internes uniques : ${Object.keys(linksGraph).length}`);
  console.log(`  📁 Sortie : ${OUTPUT_DIR}`);
  console.log("═══════════════════════════════════════════");
}

// ─── EXÉCUTION ─────────────────────────────────────────────────────────────

crawl().catch((err) => {
  console.error("💀 Erreur fatale:", err);
  process.exit(1);
});
