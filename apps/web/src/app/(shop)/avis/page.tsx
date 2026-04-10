import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import AvisContent from "./AvisContent";

export const metadata: Metadata = {
  title: `Avis clients | ${brand.name}`,
  description: `Découvrez les avis de nos clients sur ${brand.name} — réparation, SAV et pièces détachées pour trottinettes électriques.`,
};

export default function AvisPage() {
  return <AvisContent />;
}
