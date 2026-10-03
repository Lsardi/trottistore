import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

const GUIDE_SLUGS = [
  "entretien-trottinette",
  "choisir-trottinette",
  "panne-trottinette-que-faire",
];

const REPAIR_SLUGS = [
  "dualtron",
  "xiaomi",
  "ninebot",
  "kaabo",
  "vsett",
  "segway",
  "inokim",
  "minimotors",
  "teverun",
  "trottinette-ne-demarre-plus",
  "pneu-creve-trottinette",
  "frein-trottinette-ne-freine-plus",
  "batterie-trottinette-ne-charge-plus",
  "guidon-trottinette-qui-bouge",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || `https://${brand.domain}`).replace(/\/$/, "");
  const now = new Date();

  // Static public routes (excluding private: /checkout, /panier, /mon-compte)
  const staticRoutes = [
    "",
    "/a-propos",
    "/atelier",
    "/avis",
    "/compatibilite",
    "/diagnostic",
    "/faq",
    "/guide",
    "/livraison",
    "/pro",
    "/produits",
    "/quiz",
    "/reparation",
    "/urgence",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  const guideEntries: MetadataRoute.Sitemap = GUIDE_SLUGS.map((slug) => ({
    url: `${baseUrl}/guide/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const repairEntries: MetadataRoute.Sitemap = REPAIR_SLUGS.map((slug) => ({
    url: `${baseUrl}/reparation/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Dynamic product URLs from API
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    for (let page = 1; ; page++) {
      const res = await fetch(
        `${process.env.API_URL || "http://localhost:3001"}/api/v1/products?limit=100&page=${page}&status=ACTIVE`,
        { next: { revalidate: 3600 } },
      );
      if (!res.ok) throw new Error(`Products API returned ${res.status} on page ${page}`);
      const data = await res.json();
      const products: { slug: string; updatedAt?: string }[] = data?.data ?? [];
      productEntries.push(...products.map((p) => ({
        url: `${baseUrl}/produits/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
        changeFrequency: "weekly" as const,
        priority: 0.9,
      })));
      if (data.pagination?.totalPages ? page >= data.pagination.totalPages : products.length < 100) break;
    }
  } catch (err) {
    console.error("[sitemap] Failed to fetch products from API — sitemap will miss product URLs:", err);
  }

  return [...staticEntries, ...productEntries, ...guideEntries, ...repairEntries];
}
