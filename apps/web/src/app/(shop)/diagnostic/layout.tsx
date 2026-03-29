import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Diagnostic trottinette en ligne — Gratuit | ${brand.name}`,
  description: `Diagnostic gratuit en 2 clics. Identifiez la panne de votre trottinette électrique, obtenez le coût estimé et la durée de réparation. ${brand.address.city}.`,
};

export default function DiagnosticLayout({ children }: { children: React.ReactNode }) {
  return children;
}
