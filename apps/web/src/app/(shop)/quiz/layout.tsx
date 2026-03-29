import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Trouvez votre trottinette — Quiz personnalisé | ${brand.name}`,
  description: "5 questions, 30 secondes, 3 recommandations personnalisées. Trouvez la trottinette électrique idéale selon votre usage, budget et trajet.",
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
