import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Mon compte | ${brand.name}`,
  robots: { index: false, follow: false },
};

export default function MonCompteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
