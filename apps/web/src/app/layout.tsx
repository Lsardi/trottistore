import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TrottiStore — Trottinettes \u00e9lectriques & Pi\u00e8ces d\u00e9tach\u00e9es",
    template: "%s | TrottiStore",
  },
  description:
    "Boutique sp\u00e9cialis\u00e9e trottinettes \u00e9lectriques, pi\u00e8ces d\u00e9tach\u00e9es et r\u00e9paration SAV. Livraison France, paiement en plusieurs fois sans frais.",
  keywords: [
    "trottinette \u00e9lectrique",
    "pi\u00e8ces d\u00e9tach\u00e9es trottinette",
    "r\u00e9paration trottinette",
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
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
