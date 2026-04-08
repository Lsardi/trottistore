import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SOSButton from "@/components/SOSButton";
import CookieBanner from "@/components/CookieBanner";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--color-neon)] focus:text-[var(--color-void)] focus:font-mono focus:text-sm"
      >
        Aller au contenu principal
      </a>
      <Header />
      <main id="main-content" style={{ flex: 1 }}>{children}</main>
      <Footer />
      <SOSButton />
      <CookieBanner />
    </div>
  );
}
