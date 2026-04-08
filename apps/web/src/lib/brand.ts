/**
 * Brand configuration — White-label system
 *
 * All brand-specific values are centralized here.
 * Override via NEXT_PUBLIC_BRAND_* environment variables.
 *
 * IMPORTANT: Next.js only inlines NEXT_PUBLIC_* env vars when accessed
 * statically (process.env.NEXT_PUBLIC_FOO). Dynamic access via
 * process.env[key] does NOT work in client bundles. Each variable
 * must be accessed directly.
 *
 * Usage:
 *   import { brand } from "@/lib/brand";
 *   <span>{brand.name}</span>
 */

export interface BrandConfig {
  // ── Identity ──
  name: string;
  nameParts: [string, string]; // For split logo display: ["TROTTI", "STORE"]
  tagline: string;
  domain: string;
  since: string;

  // ── Contact ──
  email: string;
  phone: string;
  phoneIntl: string; // tel: format, e.g. "+33604463055"

  // ── Address ──
  address: {
    street: string;
    postalCode: string;
    city: string;
    cityShort: string; // Uppercase short version for header
  };

  // ── SEO ──
  seo: {
    title: string;
    titleTemplate: string;
    description: string;
    keywords: string[];
    ogUrl: string;
    locale: string;
  };

  // ── Navigation labels (product-type agnostic) ──
  nav: {
    mainCategory: string; // "TROTTINETTES" → customizable
    mainCategorySlug: string; // "trottinettes-electriques"
    parts: string;
    partsSlug: string; // "pieces-detachees"
    repair: string;
    diagnostic: string;
    compatibility: string;
  };

  // ── Content ──
  heroTitle: [string, string, string]; // 3 lines
  heroSubtitle: string;
  footerTagline: string;

  // ── Social / external ──
  googleReviewCount: string;
  brandsMarquee: string;
}

function splitName(name: string, customParts: string | undefined): [string, string] {
  if (customParts && customParts.includes(",")) {
    const [a, b] = customParts.split(",", 2);
    return [a.trim(), b.trim()];
  }
  // Auto-split: first half / second half
  const mid = Math.ceil(name.length / 2);
  return [name.slice(0, mid), name.slice(mid)];
}

// Static access to NEXT_PUBLIC_* env vars — required by Next.js for client-side inlining
const name = process.env.NEXT_PUBLIC_BRAND_NAME || "TROTTISTORE";
const nameParts = splitName(name, process.env.NEXT_PUBLIC_BRAND_NAME_PARTS);

export const brand: BrandConfig = {
  // Identity
  name,
  nameParts,
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || "Spécialiste trottinettes électriques depuis 2019",
  domain: process.env.NEXT_PUBLIC_BRAND_DOMAIN || "trottistore.fr",
  since: process.env.NEXT_PUBLIC_BRAND_SINCE || "2019",

  // Contact
  email: process.env.NEXT_PUBLIC_BRAND_EMAIL || "contact@trottistore.fr",
  phone: process.env.NEXT_PUBLIC_BRAND_PHONE || "06 04 46 30 55",
  phoneIntl: process.env.NEXT_PUBLIC_BRAND_PHONE_INTL || "+33604463055",

  // Address
  address: {
    street: process.env.NEXT_PUBLIC_BRAND_ADDRESS_STREET || "18 bis Rue Mechin",
    postalCode: process.env.NEXT_PUBLIC_BRAND_ADDRESS_POSTAL || "93450",
    city: process.env.NEXT_PUBLIC_BRAND_ADDRESS_CITY || "L'Île-Saint-Denis",
    cityShort: process.env.NEXT_PUBLIC_BRAND_ADDRESS_CITY_SHORT || "L'ÎLE-SAINT-DENIS",
  },

  // SEO
  seo: {
    title: process.env.NEXT_PUBLIC_BRAND_SEO_TITLE || "TrottiStore — Trottinettes électriques & Pièces détachées",
    titleTemplate: process.env.NEXT_PUBLIC_BRAND_SEO_TITLE_TEMPLATE || "%s | TrottiStore",
    description: process.env.NEXT_PUBLIC_BRAND_SEO_DESCRIPTION || "Boutique spécialisée trottinettes électriques, pièces détachées et réparation SAV. Livraison France, paiement en plusieurs fois sans frais.",
    keywords: (process.env.NEXT_PUBLIC_BRAND_SEO_KEYWORDS || "trottinette électrique,pièces détachées trottinette,réparation trottinette,SAV trottinette,TrottiStore").split(","),
    ogUrl: process.env.NEXT_PUBLIC_BRAND_OG_URL || "https://trottistore.fr",
    locale: process.env.NEXT_PUBLIC_BRAND_LOCALE || "fr_FR",
  },

  // Navigation
  nav: {
    mainCategory: process.env.NEXT_PUBLIC_BRAND_NAV_MAIN || "TROTTINETTES",
    mainCategorySlug: process.env.NEXT_PUBLIC_BRAND_NAV_MAIN_SLUG || "trottinettes-electriques",
    parts: process.env.NEXT_PUBLIC_BRAND_NAV_PARTS || "PIÈCES",
    partsSlug: process.env.NEXT_PUBLIC_BRAND_NAV_PARTS_SLUG || "pieces-detachees",
    repair: process.env.NEXT_PUBLIC_BRAND_NAV_REPAIR || "SAV",
    diagnostic: process.env.NEXT_PUBLIC_BRAND_NAV_DIAGNOSTIC || "DIAGNOSTIC",
    compatibility: process.env.NEXT_PUBLIC_BRAND_NAV_COMPAT || "COMPATIBILITÉ",
  },

  // Content
  heroTitle: [
    process.env.NEXT_PUBLIC_BRAND_HERO_L1 || "GLISSEZ",
    process.env.NEXT_PUBLIC_BRAND_HERO_L2 || "EN TOUTE",
    process.env.NEXT_PUBLIC_BRAND_HERO_L3 || "LIBERTÉ",
  ],
  heroSubtitle: process.env.NEXT_PUBLIC_BRAND_HERO_SUBTITLE || "Trottinettes, pièces détachées et réparation. Expert depuis 2019.",
  footerTagline: process.env.NEXT_PUBLIC_BRAND_FOOTER_TAGLINE || "Spécialiste trottinettes électriques depuis 2019",

  // Social
  googleReviewCount: process.env.NEXT_PUBLIC_BRAND_REVIEW_COUNT || "103",
  brandsMarquee: process.env.NEXT_PUBLIC_BRAND_MARQUEE || "DUALTRON · TEVERUN · XIAOMI · KAABO · NINEBOT · VSETT · SEGWAY · KUICKWHEEL · ",
};
