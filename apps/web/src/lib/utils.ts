import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}

export function formatPriceTTC(priceHt: string | number, tvaRate: string | number = 20): string {
  const ht = typeof priceHt === "string" ? parseFloat(priceHt) : priceHt;
  const tva = typeof tvaRate === "string" ? parseFloat(tvaRate) : tvaRate;
  return formatPrice(ht * (1 + tva / 100));
}

export function priceTTC(priceHt: string | number, tvaRate: string | number = 20): number {
  const ht = typeof priceHt === "string" ? parseFloat(priceHt) : priceHt;
  const tva = typeof tvaRate === "string" ? parseFloat(tvaRate) : tvaRate;
  return ht * (1 + tva / 100);
}
