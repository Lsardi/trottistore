/**
 * "Mon Garage" — stockage local des trottinettes de l'utilisateur
 *
 * Persiste dans localStorage. Fonctionne sans compte.
 * Quand l'utilisateur est connecté, on pourra sync avec le CRM (scooterModels).
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

export function addScooterToGarage(brand: string, model: string): GarageScooter {
  const scooters = readGarage();
  // Éviter les doublons
  const existing = scooters.find(
    (s) => s.brand.toLowerCase() === brand.toLowerCase() && s.model.toLowerCase() === model.toLowerCase()
  );
  if (existing) return existing;

  const newScooter: GarageScooter = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
