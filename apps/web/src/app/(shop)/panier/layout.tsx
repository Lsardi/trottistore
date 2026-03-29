import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Panier | ${brand.name}`,
  description: "Votre panier TrottiStore. Paiement en 3x sans frais disponible à partir de 300€.",
};

export default function PanierLayout({ children }: { children: React.ReactNode }) {
  return children;
}
