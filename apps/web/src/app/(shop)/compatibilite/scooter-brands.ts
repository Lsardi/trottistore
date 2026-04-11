/**
 * Scooter brands and models for the compatibility checker.
 *
 * Static fallback / curated reference list. The /compatibilite page calls
 * the SAV API `/repairs/scooter-models` first to get the real models we
 * have actually serviced, and merges that result with this list. This file
 * is kept as a baseline so the compat picker is never empty (cold start,
 * API down, no SAV history yet).
 *
 * To add a new brand or model to the curated baseline, edit this list.
 */
export interface ScooterBrand {
  name: string;
  models: string[];
}

export const SCOOTER_BRANDS: ScooterBrand[] = [
  { name: "Dualtron", models: ["Thunder 2", "Mini", "Victor", "Storm", "Eagle Pro", "Spider 2", "Compact", "Ultra 2"] },
  { name: "Xiaomi", models: ["M365", "M365 Pro", "Pro 2", "Essential", "Mi 4", "Mi 4 Pro"] },
  { name: "Ninebot", models: ["Max G30", "Max G30LP", "Max G2", "E2", "F2", "F2 Plus", "F2 Pro"] },
  { name: "Kaabo", models: ["Mantis 10", "Mantis King GT", "Wolf Warrior 11", "Wolf King GT Pro"] },
  { name: "Segway", models: ["Ninebot P65", "Ninebot P100S", "Ninebot GT2"] },
  { name: "Vsett", models: ["8", "9+", "10+", "11+"] },
  { name: "Inokim", models: ["OX", "OXO", "Quick 4", "Light 2"] },
  { name: "Minimotors", models: ["Speedway 5", "Speedway Leger", "Dualtron"] },
  { name: "Teverun", models: ["Fighter 11+", "Fighter Supreme 7260R", "Blade GT"] },
  { name: "Kuickwheel", models: ["S1-C Pro", "S1-C Pro+"] },
];

/**
 * Merge a dynamic list of brands (e.g. from the SAV API) with the static
 * baseline. Dynamic models supplement the static ones; brands present only
 * in one source are kept; duplicates are de-duplicated case-insensitively.
 * The result is sorted alphabetically by brand and by model within a brand.
 */
export function mergeScooterBrands(
  dynamic: ScooterBrand[],
  staticBaseline: ScooterBrand[] = SCOOTER_BRANDS,
): ScooterBrand[] {
  const map = new Map<string, Set<string>>();

  function add(list: ScooterBrand[]) {
    for (const b of list) {
      const key = b.name.trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, new Set());
      const bucket = map.get(key)!;
      for (const m of b.models) {
        const trimmed = m.trim();
        if (trimmed) bucket.add(trimmed);
      }
    }
  }

  add(staticBaseline);
  add(dynamic);

  return Array.from(map.entries())
    .map(([name, modelsSet]) => ({
      name,
      models: Array.from(modelsSet).sort((a, b) => a.localeCompare(b, "fr")),
    }))
    .filter((b) => b.models.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
