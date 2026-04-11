/**
 * "Mon Garage" — stockage local des trottinettes de l'utilisateur.
 *
 * Source de vérité: localStorage (fonctionne sans compte).
 * Si l'utilisateur est connecté, on synchronise dans les deux sens avec
 * `CustomerProfile.scooterModels` côté backend (route /auth/garage).
 *
 * Format de stockage canonique côté backend: tableau de strings "Brand Model".
 * Côté frontend on enrichit avec id + addedAt pour l'UX.
 */

export interface GarageScooter {
  id: string;
  brand: string;
  model: string;
  addedAt: string; // ISO date
}

const STORAGE_KEY = "trottistore:garage";

function readGarage(): GarageScooter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeGarage(scooters: GarageScooter[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scooters));
  window.dispatchEvent(new Event("trottistore:garage-updated"));
}

export function getGarageScooters(): GarageScooter[] {
  return readGarage();
}

function makeId(brand: string, model: string): string {
  return `${brand}_${model}`.toLowerCase().replace(/\s+/g, "-");
}

export function addScooterToGarage(brand: string, model: string): GarageScooter {
  const scooters = readGarage();
  // Éviter les doublons
  const existing = scooters.find(
    (s) => s.brand.toLowerCase() === brand.toLowerCase() && s.model.toLowerCase() === model.toLowerCase()
  );
  if (existing) return existing;

  const newScooter: GarageScooter = {
    id: makeId(brand, model),
    brand,
    model,
    addedAt: new Date().toISOString(),
  };
  writeGarage([...scooters, newScooter]);
  return newScooter;
}

export function removeScooterFromGarage(id: string): void {
  const scooters = readGarage();
  writeGarage(scooters.filter((s) => s.id !== id));
}

export function getPrimaryScooter(): GarageScooter | null {
  const scooters = readGarage();
  return scooters[0] ?? null;
}

// ── Server sync ─────────────────────────────────────────────

/** Convert "Brand Model Variant" → { brand, model } (brand = first token). */
function parseCanonical(canonical: string): { brand: string; model: string } | null {
  const trimmed = canonical.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return null;
  return { brand: parts[0], model: parts.slice(1).join(" ") };
}

function canonicalString(brand: string, model: string): string {
  return `${brand.trim()} ${model.trim()}`.replace(/\s+/g, " ").trim();
}

/**
 * Merge server scooters into the local garage and push the union back.
 * Used at login / on app boot when the user is authenticated. Idempotent.
 *
 * - Pulls server list via GET /auth/garage
 * - Adds any local-only scooter to the union
 * - Adds any server-only scooter to localStorage
 * - PUTs the union back so both sides converge
 */
export async function syncGarageWithServer(token: string): Promise<void> {
  if (typeof window === "undefined") return;

  let serverList: string[] = [];
  try {
    const res = await fetch("/api/v1/auth/garage", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const json = await res.json();
    serverList = Array.isArray(json?.data?.scooters) ? json.data.scooters : [];
  } catch {
    return; // soft-fail: keep localStorage as-is
  }

  const local = readGarage();
  const seen = new Set<string>();
  const merged: GarageScooter[] = [];

  function pushIfNew(scooter: GarageScooter) {
    const key = `${scooter.brand}|${scooter.model}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(scooter);
  }

  // Local first (preserves addedAt timestamps)
  for (const s of local) pushIfNew(s);

  // Then server entries that weren't already local
  for (const canonical of serverList) {
    const parsed = parseCanonical(canonical);
    if (!parsed) continue;
    pushIfNew({
      id: makeId(parsed.brand, parsed.model),
      brand: parsed.brand,
      model: parsed.model,
      addedAt: new Date().toISOString(), // unknown server-side
    });
  }

  writeGarage(merged);

  // Push the merged union back so the server reflects local additions.
  const canonicalList = merged.map((s) => canonicalString(s.brand, s.model));
  try {
    await fetch("/api/v1/auth/garage", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ scooters: canonicalList }),
    });
  } catch {
    // soft-fail: localStorage is now correct, the next sync will retry
  }
}

/**
 * Push the current local garage to the server. Called after add/remove
 * when the user is authenticated, so the server stays in sync without
 * waiting for the next login.
 */
export async function pushGarageToServer(token: string): Promise<void> {
  if (typeof window === "undefined") return;
  const local = readGarage();
  const canonicalList = local.map((s) => canonicalString(s.brand, s.model));
  try {
    await fetch("/api/v1/auth/garage", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ scooters: canonicalList }),
    });
  } catch {
    // soft-fail
  }
}
