import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Checkout | ${brand.name}`,
  description: "Finalisez votre commande. Paiement sécurisé par carte, Apple Pay ou Google Pay.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
