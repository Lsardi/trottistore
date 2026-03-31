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

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = `https://${brand.domain}`;
  const now = new Date();

  const staticRoutes = [
    "",
    "/atelier",
    "/avis",
    "/checkout",
    "/compatibilite",
    "/diagnostic",
    "/mon-compte",
    "/panier",
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

  return [...staticEntries, ...guideEntries, ...repairEntries];
}
