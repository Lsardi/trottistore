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
  const baseUrl = `https://${brand.domain}`;
  const now = new Date();

  // Static public routes (excluding private: /checkout, /panier, /mon-compte)
  const staticRoutes = [
    "",
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
    const res = await fetch(
      `${process.env.ECOMMERCE_URL || "http://localhost:3001"}/api/v1/products?limit=500&status=ACTIVE`,
      { next: { revalidate: 3600 } },
    );
    if (res.ok) {
      const data = await res.json();
      const products = data?.data ?? [];
      productEntries = products.map((p: { slug: string; updatedAt?: string }) => ({
        url: `${baseUrl}/produits/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
        changeFrequency: "weekly" as const,
        priority: 0.9,
      }));
    }
  } catch {
    // Sitemap generation should not fail if API is down
  }

  return [...staticEntries, ...productEntries, ...guideEntries, ...repairEntries];
}
