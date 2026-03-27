/**
 * Brand configuration — White-label system
 *
 * All brand-specific values are centralized here.
 * Override via NEXT_PUBLIC_BRAND_* environment variables.
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
    parts: string;
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

function env(key: string, fallback: string): string {
  if (typeof process !== "undefined" && process.env) {
    return process.env[key] || fallback;
  }
  return fallback;
}

function splitName(name: string): [string, string] {
  const custom = env("NEXT_PUBLIC_BRAND_NAME_PARTS", "");
  if (custom && custom.includes(",")) {
    const [a, b] = custom.split(",", 2);
    return [a.trim(), b.trim()];
  }
  // Auto-split: first half / second half
  const mid = Math.ceil(name.length / 2);
  return [name.slice(0, mid), name.slice(mid)];
}

const name = env("NEXT_PUBLIC_BRAND_NAME", "TROTTISTORE");

export const brand: BrandConfig = {
  // Identity
  name,
  nameParts: splitName(name),
  tagline: env("NEXT_PUBLIC_BRAND_TAGLINE", "Spécialiste trottinettes électriques depuis 2019"),
  domain: env("NEXT_PUBLIC_BRAND_DOMAIN", "trottistore.fr"),
  since: env("NEXT_PUBLIC_BRAND_SINCE", "2019"),

  // Contact
  email: env("NEXT_PUBLIC_BRAND_EMAIL", "contact@trottistore.fr"),
  phone: env("NEXT_PUBLIC_BRAND_PHONE", "06 04 46 30 55"),
  phoneIntl: env("NEXT_PUBLIC_BRAND_PHONE_INTL", "+33604463055"),

  // Address
  address: {
    street: env("NEXT_PUBLIC_BRAND_ADDRESS_STREET", "18 bis Rue Mechin"),
    postalCode: env("NEXT_PUBLIC_BRAND_ADDRESS_POSTAL", "93450"),
    city: env("NEXT_PUBLIC_BRAND_ADDRESS_CITY", "L'Île-Saint-Denis"),
    cityShort: env("NEXT_PUBLIC_BRAND_ADDRESS_CITY_SHORT", "L'ÎLE-SAINT-DENIS"),
  },

  // SEO
  seo: {
    title: env(
      "NEXT_PUBLIC_BRAND_SEO_TITLE",
      "TrottiStore — Trottinettes electriques & Pieces detachees",
    ),
    titleTemplate: env("NEXT_PUBLIC_BRAND_SEO_TITLE_TEMPLATE", "%s | TrottiStore"),
    description: env(
      "NEXT_PUBLIC_BRAND_SEO_DESCRIPTION",
      "Boutique specialisee trottinettes electriques, pieces detachees et reparation SAV. Livraison France, paiement en plusieurs fois sans frais.",
    ),
    keywords: env(
      "NEXT_PUBLIC_BRAND_SEO_KEYWORDS",
      "trottinette electrique,pieces detachees trottinette,reparation trottinette,SAV trottinette,TrottiStore",
    ).split(","),
    ogUrl: env("NEXT_PUBLIC_BRAND_OG_URL", "https://trottistore.fr"),
    locale: env("NEXT_PUBLIC_BRAND_LOCALE", "fr_FR"),
  },

  // Navigation
  nav: {
    mainCategory: env("NEXT_PUBLIC_BRAND_NAV_MAIN", "TROTTINETTES"),
    parts: env("NEXT_PUBLIC_BRAND_NAV_PARTS", "PIÈCES"),
    repair: env("NEXT_PUBLIC_BRAND_NAV_REPAIR", "SAV"),
    diagnostic: env("NEXT_PUBLIC_BRAND_NAV_DIAGNOSTIC", "DIAGNOSTIC"),
    compatibility: env("NEXT_PUBLIC_BRAND_NAV_COMPAT", "COMPATIBILITÉ"),
  },

  // Content
  heroTitle: [
    env("NEXT_PUBLIC_BRAND_HERO_L1", "GLISSEZ"),
    env("NEXT_PUBLIC_BRAND_HERO_L2", "EN TOUTE"),
    env("NEXT_PUBLIC_BRAND_HERO_L3", "LIBERTÉ"),
  ],
  heroSubtitle: env(
    "NEXT_PUBLIC_BRAND_HERO_SUBTITLE",
    "Trottinettes, pièces détachées et réparation. Expert depuis 2019.",
  ),
  footerTagline: env(
    "NEXT_PUBLIC_BRAND_FOOTER_TAGLINE",
    "Spécialiste trottinettes électriques depuis 2019",
  ),

  // Social
  googleReviewCount: env("NEXT_PUBLIC_BRAND_REVIEW_COUNT", "103"),
  brandsMarquee: env(
    "NEXT_PUBLIC_BRAND_MARQUEE",
    "DUALTRON · TEVERUN · XIAOMI · KAABO · NINEBOT · VSETT · SEGWAY · KUICKWHEEL · ",
  ),
};
