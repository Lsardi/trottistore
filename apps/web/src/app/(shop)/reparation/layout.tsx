import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Réparation trottinette — SAV toutes marques | ${brand.name}`,
  description: `Déposez votre demande de réparation en ligne. Diagnostic gratuit, devis transparent, suivi en temps réel. Atelier à ${brand.address.city}.`,
};

export default function ReparationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
