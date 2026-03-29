import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Checkout | ${brand.name}`,
  description: "Finalisez votre commande. Paiement sécurisé par carte, Apple Pay, Google Pay ou en 3x sans frais.",
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
