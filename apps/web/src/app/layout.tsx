import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TrottiStore — Trottinettes electriques & Pieces detachees",
    template: "%s | TrottiStore",
  },
  description:
    "Boutique specialisee trottinettes electriques, pieces detachees et reparation SAV. Livraison France, paiement en plusieurs fois sans frais.",
  keywords: [
    "trottinette electrique",
    "pieces detachees trottinette",
    "reparation trottinette",
    "SAV trottinette",
    "TrottiStore",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://trottistore.fr",
    siteName: "TrottiStore",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
