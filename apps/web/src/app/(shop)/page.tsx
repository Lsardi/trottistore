import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Wrench, Boxes, ArrowRight, MapPin, Clock, Shield, Zap, Battery, Gauge } from "lucide-react";
import { formatPriceTTC, formatPrice } from "@/lib/utils";
import { brand } from "@/lib/brand";
import GarageBanner from "@/components/GarageBanner";
import NewsletterForm from "@/components/NewsletterForm";

// ─── TYPES ────────────────────────────────────────────────

interface ProductImage {
  url: string;
  alt: string | null;
}

interface ProductBrand {
  name: string;
  slug: string;
}

interface FeaturedProduct {
  id: string;
  name: string;
  slug: string;
  priceHt: string;
  tvaRate: string;
  isFeatured: boolean;
  brand: ProductBrand | null;
  images: ProductImage[];
}

// ─── DATA ─────────────────────────────────────────────────

const BRANDS_MARQUEE = brand.brandsMarquee;

const CUSTOMER_PATHS = [
  {
    icon: ShoppingBag,
    title: "ACHETER UNE TROTTINETTE",
    subtitle: "Trouvez le modèle idéal",
    description: "15 marques en stock, de 300€ à 7000€. Retrait 1h en boutique ou livraison 48-72h.",
    cta: "VOIR LES TROTTINETTES",
    href: "/produits?categorySlug=trottinettes-electriques",
    accent: false,
  },
  {
    icon: Wrench,
    title: "RÉPARER MA TROTTINETTE",
    subtitle: "Toutes marques, toutes pannes",
    description: "Diagnostic gratuit, devis transparent, réparation en 1 à 3 jours. Atelier à L'Île-Saint-Denis.",
    cta: "PRENDRE RENDEZ-VOUS",
    href: "/reparation",
    accent: false,
  },
  {
    icon: Boxes,
    title: "TROUVER UNE PIÈCE",
    subtitle: "700+ références compatibles",
    description: "Batteries, contrôleurs, freins, pneus, displays. Vérifiez la compatibilité avec votre modèle.",
    cta: "CHERCHER UNE PIÈCE",
    href: "/compatibilite",
    accent: false,
  },
];

const REASSURANCE = [
  { icon: MapPin, text: "Boutique & atelier à L'Île-Saint-Denis" },
  { icon: Clock, text: "Retrait en 1h · Livraison 48-72h" },
  { icon: Shield, text: "Garantie 2 ans · Retour 14 jours" },
];

// ─── HOMEPAGE ─────────────────────────────────────────────

async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  const ecommerceBaseUrl = process.env.API_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${ecommerceBaseUrl}/api/v1/products/featured`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || data.products || data || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts();

  return (
    <>
      {/* ================================================================
          HERO — Premium dark with bento grid
          ================================================================ */}
      <section className="grain" style={{ minHeight: "100dvh", backgroundColor: "var(--color-void)", position: "relative", overflow: "hidden" }}>
        {/* Animated grid background */}
        <div className="hero-grid-bg" />
        {/* Ambient glow orbs */}
        <div className="hero-glow" style={{ top: "20%", left: "15%" }} />
        <div className="hero-glow" style={{ top: "50%", left: "80%", animationDelay: "4s", background: "radial-gradient(circle, rgba(0, 153, 255, 0.1) 0%, transparent 70%)" }} />

        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", width: "100%", position: "relative", zIndex: 2 }}>

          {/* Top hero — title + scooter image */}
          <div className="hero-inner" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "center", paddingTop: 60, paddingBottom: 40 }}>
            <div>
              <div className="animate-slide-up stagger-1" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", border: "1px solid var(--color-border)", marginBottom: 24 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--color-neon)", boxShadow: "0 0 8px var(--color-neon)" }} />
                <span className="font-mono" style={{ fontSize: "0.65rem", color: "var(--color-neon)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Boutique ouverte · {brand.address.city}
                </span>
              </div>

              <h1 className="heading-xl animate-slide-up stagger-2" style={{ fontSize: "clamp(2rem, 6vw, 4.2rem)", lineHeight: 1.0, marginBottom: 20 }}>
                {brand.heroTitle[0]}<br />{brand.heroTitle[1]}<br />
                <span style={{ color: "var(--color-neon)" }}>{brand.heroTitle[2]}</span>
              </h1>

              <p className="font-mono animate-slide-up stagger-3" style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", lineHeight: 1.7, maxWidth: 420, marginBottom: 28 }}>
                La boutique #1 en Île-de-France. 738 produits, atelier de réparation intégré, pièces en stock immédiat.
              </p>

              <div className="animate-slide-up stagger-4" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="/produits" className="btn-neon" style={{ padding: "0.85rem 2.2rem" }}>VOIR LE CATALOGUE</Link>
                <Link href="/reparation" className="btn-outline">RÉPARER MA TROTT</Link>
              </div>

              {/* Trust stats inline */}
              <div className="animate-slide-up stagger-5" style={{ display: "flex", gap: 24, marginTop: 32 }}>
                {[
                  { icon: Zap, value: "738", label: "Produits" },
                  { icon: Battery, value: "15", label: "Marques" },
                  { icon: Gauge, value: "2019", label: "Depuis" },
                ].map((stat) => (
                  <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <stat.icon style={{ width: 14, height: 14, color: "var(--color-neon)", opacity: 0.6 }} />
                    <div>
                      <span className="font-display" style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--color-text)" }}>{stat.value}</span>
                      <span className="font-mono" style={{ fontSize: "0.6rem", color: "var(--color-text-dim)", marginLeft: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Scooter image */}
            <div className="hero-image-container animate-slide-up stagger-5" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <div style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", width: "90%", height: 60, background: "radial-gradient(ellipse, rgba(0,255,209,0.15) 0%, transparent 70%)", filter: "blur(30px)" }} />
              <Image
                src="https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS.jpg"
                alt="Trottinette électrique Teverun Tetra"
                width={800} height={800} priority
                sizes="(max-width: 1280px) 40vw, 520px"
                style={{ width: "100%", height: "auto", maxHeight: 480, objectFit: "contain", transform: "rotate(-5deg)", position: "relative", zIndex: 2, filter: "drop-shadow(0 25px 50px rgba(0,0,0,0.6))" }}
              />
            </div>
          </div>

          {/* BENTO GRID — 3 services */}
          <div className="bento-grid animate-slide-up stagger-6" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, paddingBottom: 40 }}>
            {[
              {
                icon: ShoppingBag,
                title: "ACHETER",
                subtitle: "Trottinettes électriques",
                stat: "à partir de 799€",
                desc: "15 marques en stock. De la citadine au monstre de puissance.",
                href: "/produits?categorySlug=trottinettes-electriques",
                gradient: "linear-gradient(135deg, rgba(0,255,209,0.08) 0%, transparent 60%)",
              },
              {
                icon: Wrench,
                title: "RÉPARER",
                subtitle: "Atelier & SAV",
                stat: "Diagnostic gratuit",
                desc: "Toutes marques, toutes pannes. Devis transparent, réparation 1-3j.",
                href: "/reparation",
                gradient: "linear-gradient(135deg, rgba(0,153,255,0.08) 0%, transparent 60%)",
              },
              {
                icon: Boxes,
                title: "PIÈCES",
                subtitle: "700+ références",
                stat: "En stock immédiat",
                desc: "Batteries, contrôleurs, freins, pneus. Compatibilité vérifiée.",
                href: "/compatibilite",
                gradient: "linear-gradient(135deg, rgba(255,153,0,0.06) 0%, transparent 60%)",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="rubrique-card group"
                  style={{
                    background: `${card.gradient}, var(--color-surface)`,
                    border: "1px solid var(--color-border)",
                    padding: "24px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    textDecoration: "none",
                    color: "inherit",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ width: 40, height: 40, backgroundColor: "var(--color-void)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon style={{ width: 18, height: 18, color: "var(--color-neon)" }} />
                    </div>
                    <ArrowRight style={{ width: 14, height: 14, color: "var(--color-text-dim)", transition: "transform 200ms, color 200ms" }} className="group-hover:translate-x-1 group-hover:text-neon" />
                  </div>
                  <div>
                    <h3 className="font-display" style={{ fontWeight: 800, fontSize: "1rem", color: "var(--color-text)", letterSpacing: "-0.01em" }}>{card.title}</h3>
                    <p className="font-mono" style={{ fontSize: "0.68rem", color: "var(--color-neon)", marginTop: 2 }}>{card.stat}</p>
                  </div>
                  <p className="font-mono" style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}>{card.desc}</p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Brand marquee */}
        <div style={{ borderTop: "1px solid var(--color-surface-2)", padding: "10px 0", overflow: "hidden", position: "relative", zIndex: 2 }}>
          <div style={{ position: "relative", height: "1em", overflow: "hidden" }}>
            <div className="marquee-track font-mono" style={{ position: "absolute", left: 0, top: 0, fontSize: "0.65rem", color: "var(--color-border-light)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span style={{ whiteSpace: "nowrap" }}>{BRANDS_MARQUEE}{BRANDS_MARQUEE}{BRANDS_MARQUEE}{BRANDS_MARQUEE}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          REASSURANCE BAR — Simple trust signals
          ================================================================ */}
      <section
        style={{
          backgroundColor: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          className="stats-grid"
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
          }}
        >
          {REASSURANCE.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.text}
                style={{
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  borderRight: i < REASSURANCE.length - 1 ? "1px solid var(--color-border)" : "none",
                }}
              >
                <Icon style={{ width: 16, height: 16, color: "var(--color-neon)", flexShrink: 0 }} />
                <span className="font-mono" style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {item.text}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================================================================
          GARAGE BANNER — personalized if user has a scooter
          ================================================================ */}
      <GarageBanner />


      {/* ================================================================
          FEATURED PRODUCTS
          ================================================================ */}
      <section style={{ backgroundColor: "var(--color-void)", padding: "64px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <h2 className="heading-lg">À LA UNE</h2>
            <Link href="/produits" className="font-mono text-xs text-neon hover:underline" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              Tout voir <ArrowRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          <div className="divider-neon" style={{ marginBottom: 32 }} />

          {featuredProducts.length > 0 ? (
            <div
              className="products-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 16,
              }}
            >
              {featuredProducts.slice(0, 8).map((product) => {
                const img = product.images?.[0];
                const priceTTC = formatPriceTTC(product.priceHt, product.tvaRate);
                const priceHT = formatPrice(parseFloat(product.priceHt));
                return (
                  <Link
                    key={product.id}
                    href={`/produits/${product.slug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className="product-card">
                      <div className="product-card-image">
                        {img ? (
                          <Image
                            src={img.url}
                            alt={img.alt || product.name}
                            fill
                            sizes="(max-width: 768px) 50vw, 25vw"
                            style={{ objectFit: "contain" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--color-border-light)",
                              fontSize: "2rem",
                            }}
                          >
                            /
                          </div>
                        )}
                      </div>
                      <div className="product-card-body">
                        {product.brand && (
                          <div className="spec-label" style={{ marginBottom: 6 }}>
                            {product.brand.name}
                          </div>
                        )}
                        <h3
                          className="heading-md"
                          style={{
                            fontSize: "0.9rem",
                            marginBottom: 8,
                            color: "var(--color-text)",
                            lineHeight: 1.2,
                          }}
                        >
                          {product.name}
                        </h3>
                        <div className="price-main" style={{ fontSize: "1.3rem" }}>
                          {priceTTC}
                        </div>
                        <div className="price-sub">
                          {priceHT} HT
                        </div>
                      </div>
                      <div className="product-card-neon-line" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                color: "var(--color-text-dim)",
              }}
            >
              <p className="font-mono" style={{ fontSize: "0.8rem", marginBottom: 16 }}>
                Les produits arrivent bientôt...
              </p>
              <Link href="/produits" className="btn-neon">
                VOIR LE CATALOGUE
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================
          ATELIER — 4-step process timeline
          ================================================================ */}
      <section className="grain" style={{ backgroundColor: "var(--color-surface)", padding: "64px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          {/* Header — compact */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p className="spec-label text-neon mb-2">NOTRE ATELIER À {brand.address.cityShort}</p>
            <h2 className="heading-lg" style={{ marginBottom: 12 }}>COMMENT ÇA MARCHE</h2>
            <p className="font-mono text-xs text-text-muted" style={{ maxWidth: 500, margin: "0 auto" }}>
              Du diagnostic au retrait, on s&apos;occupe de tout. Toutes marques, pièces en stock.
            </p>
          </div>

          {/* Timeline — 4 steps horizontal */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, position: "relative" }} className="atelier-timeline">
            {/* Connector line */}
            <div style={{ position: "absolute", top: 24, left: "12.5%", right: "12.5%", height: 2, background: "linear-gradient(90deg, var(--color-neon), var(--color-border-light))" }} className="hidden md:block" />

            {[
              { step: "01", title: "DIAGNOSTIC", desc: "15 min, gratuit", icon: "⚡" },
              { step: "02", title: "DEVIS", desc: "Transparent, sans surprise", icon: "📋" },
              { step: "03", title: "RÉPARATION", desc: "1 à 3 jours, suivi en ligne", icon: "🔧" },
              { step: "04", title: "RETRAIT", desc: "SMS quand c'est prêt", icon: "✓" },
            ].map((item, i) => (
              <div key={item.step} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative", zIndex: 2 }}>
                <div style={{
                  width: 48, height: 48,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: i === 0 ? "var(--color-neon)" : "var(--color-void)",
                  border: `2px solid ${i === 0 ? "var(--color-neon)" : "var(--color-border)"}`,
                  color: i === 0 ? "var(--color-void)" : "var(--color-text-dim)",
                  marginBottom: 16,
                }}>
                  <span className="font-mono" style={{ fontSize: "0.75rem", fontWeight: 800 }}>{item.step}</span>
                </div>
                <h4 className="font-display" style={{ fontWeight: 700, fontSize: "0.8rem", color: i === 0 ? "var(--color-neon)" : "var(--color-text)", marginBottom: 4 }}>
                  {item.title}
                </h4>
                <p className="font-mono" style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", lineHeight: 1.4, maxWidth: 160 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* CTA buttons centered */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 40 }}>
            <Link href="/reparation" className="btn-neon">DÉPOSER UN TICKET</Link>
            <Link href="/diagnostic" className="btn-outline">DIAGNOSTIC EN LIGNE</Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          NEWSLETTER
          ================================================================ */}
      <section style={{ backgroundColor: "var(--color-void)", padding: "64px 0" }}>
        <div className="divider-neon" style={{ marginBottom: 48 }} />
        <div
          className="newsletter-inner"
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          <h2 className="heading-lg" style={{ flex: "0 0 auto" }}>
            RESTEZ CONNECTÉ
          </h2>
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}
