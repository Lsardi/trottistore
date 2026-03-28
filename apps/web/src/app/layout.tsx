import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: brand.seo.title,
    template: brand.seo.titleTemplate,
  },
  description: brand.seo.description,
  keywords: brand.seo.keywords,
  openGraph: {
    type: "website",
    locale: brand.seo.locale,
    url: brand.seo.ogUrl,
    siteName: brand.name,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('trottistore-theme');
                  var theme = saved || 'atelier';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (_e) {
                  document.documentElement.setAttribute('data-theme', 'atelier');
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
