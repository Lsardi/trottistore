import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Compatibilité pièces trottinette | ${brand.name}`,
  description: "Sélectionnez votre marque et modèle de trottinette. On vous montre uniquement les pièces compatibles en stock. Dualtron, Xiaomi, Ninebot, Kaabo et plus.",
};

export default function CompatibiliteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
