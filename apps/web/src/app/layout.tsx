import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { fontVariables } from "@/lib/fonts";
import { DEFAULT_THEME, THEME_PROFILES, THEME_STORAGE_KEY } from "@/lib/themes";
import StructuredData from "@/components/StructuredData";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(brand.seo.ogUrl),
  title: {
    default: brand.seo.title,
    template: brand.seo.titleTemplate,
  },
  description: brand.seo.description,
  keywords: brand.seo.keywords,
  alternates: {
    canonical: "./",
  },
  openGraph: {
    type: "website",
    locale: brand.seo.locale,
    url: brand.seo.ogUrl,
    siteName: brand.name,
    title: brand.seo.title,
    description: brand.seo.description,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `${brand.name} — Trottinettes électriques, pièces détachées et réparation`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: brand.seo.title,
    description: brand.seo.description,
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const allowedThemes = THEME_PROFILES.map((item) => item.id);

  return (
    <html lang="fr" data-theme={DEFAULT_THEME} className={fontVariables} suppressHydrationWarning>
      <head>
        <StructuredData />
      </head>
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var allowed = ${JSON.stringify(allowedThemes)};
                  var fallback = ${JSON.stringify(DEFAULT_THEME)};
                  var saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
                  var theme = allowed.indexOf(saved) >= 0 ? saved : fallback;
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (_e) {
                  document.documentElement.setAttribute('data-theme', ${JSON.stringify(DEFAULT_THEME)});
                }
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
