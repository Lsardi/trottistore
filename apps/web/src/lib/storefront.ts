import { brand } from "@/lib/brand";

export const GOOGLE_MAPS_DIR_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  `${brand.address.street}, ${brand.address.postalCode} ${brand.address.city}`,
)}`;

export const WAZE_DIR_URL = `https://waze.com/ul?q=${encodeURIComponent(
  `${brand.address.street}, ${brand.address.postalCode} ${brand.address.city}`,
)}&navigate=yes`;

export function isStoreOpen(now = new Date()): boolean {
  const day = now.getDay(); // 0=Sun
  const hour = now.getHours();
  if (day === 0) return false;
  return hour >= 10 && hour < 19;
}

export function getStoreStatusLabel(now = new Date()): "OUVERT MAINTENANT" | "FERMÉ — RAPPEL DEMAIN 10H" {
  return isStoreOpen(now) ? "OUVERT MAINTENANT" : "FERMÉ — RAPPEL DEMAIN 10H";
}
