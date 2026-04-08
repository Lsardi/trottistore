import Link from "next/link";
import Image from "next/image";
import { Lightbulb, Disc, Cable, Monitor } from "lucide-react";
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

// ─── STATIC DATA ──────────────────────────────────────────

const BRANDS_MARQUEE = brand.brandsMarquee;

const STATS = [
  { value: "2045", label: "PRODUITS" },
  { value: "15", label: "MARQUES" },
  { value: brand.since, label: "DEPUIS" },
  { value: brand.googleReviewCount, label: "AVIS GOOGLE" },
];

const CATEGORIES_SMALL = [
  { name: "ÉCLAIRAGES", icon: Lightbulb, count: 48, slug: "eclairages" },
  { name: "FREINAGE", icon: Disc, count: 92, slug: "freinage" },
  { name: "CÂBLES", icon: Cable, count: 67, slug: "cables" },
  { name: "DISPLAYS", icon: Monitor, count: 31, slug: "displays" },
];

const REVIEWS = [
  {
    name: "Marc D.",
    date: "il y a 2 semaines",
    text: "Excellent service ! Ma Dualtron est arrivée en 48h, parfaitement emballée. Le SAV m'a rappelé pour vérifier.",
  },
  {
    name: "Sophie L.",
    date: "il y a 1 mois",
    text: "J'ai fait réparer ma trottinette à l'atelier. Travail impeccable, prix honnête et très bon accueil.",
  },
  {
    name: "Karim B.",
    date: "il y a 3 semaines",
    text: "Paiement en 4x sans frais, c'est top. Livraison rapide et produit conforme à la description.",
  },
];

// ─── HOMEPAGE ─────────────────────────────────────────────

async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  const ecommerceBaseUrl = process.env.ECOMMERCE_URL || process.env.NEXT_PUBLIC_API_ECOMMERCE || "http://localhost:3001";
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
          SECTION 1 — HERO
          ================================================================ */}
      <section
        className="grain"
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--color-void)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 24px",
            width: "100%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            className="hero-inner"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 48,
              alignItems: "center",
              width: "100%",
              paddingTop: 40,
              paddingBottom: 80,
            }}
          >
            {/* Left: Text */}
            <div>
              <p
                className="font-mono animate-slide-up stagger-1"
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: "0.1em",
                  color: "var(--color-neon)",
                  marginBottom: 24,
                  textTransform: "uppercase",
                }}
              >
                MOBILITÉ ÉLECTRIQUE ——
              </p>

              <h1 className="heading-xl animate-slide-up stagger-2">
                {brand.heroTitle[0]}
                <br />
                {brand.heroTitle[1]}
                <br />
                {brand.heroTitle[2]}<span style={{ color: "var(--color-neon)" }}>.</span>
              </h1>

              <p
                className="animate-slide-up stagger-3"
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "0.95rem",
                  lineHeight: 1.6,
                  maxWidth: 400,
                  marginTop: 24,
                  marginBottom: 32,
                }}
              >
                {brand.heroSubtitle}
              </p>

              <div
                className="animate-slide-up stagger-4"
                style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
              >
                <Link href="/produits" className="btn-neon">
                  CATALOGUE
                </Link>
                <Link href="/quiz" className="btn-outline">
                  TROUVEZ VOTRE TROTT
                </Link>
                <Link href="/reparation" className="btn-outline">
                  RÉPARATION SAV
                </Link>
              </div>
            </div>

            {/* Right: Scooter image */}
            <div
              className="hero-image-container animate-slide-up stagger-5"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "80%",
                  height: 40,
                  background:
                    "radial-gradient(ellipse at center, var(--color-neon-dim) 0%, transparent 70%)",
                  filter: "blur(20px)",
                }}
              />
              <Image
                src="https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg"
                alt="Trottinette électrique Teverun Tetra"
                width={300}
                height={300}
                priority
                style={{
                  maxWidth: "100%",
                  maxHeight: 400,
                  objectFit: "contain",
                  transform: "rotate(-5deg)",
                  position: "relative",
                  zIndex: 2,
                  width: "auto",
                  height: "auto",
                }}
              />
            </div>
          </div>
        </div>

        {/* Brand marquee */}
        <div
          style={{
            borderTop: "1px solid var(--color-surface-2)",
            padding: "10px 0",
            overflow: "hidden",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div className="marquee-track font-mono" style={{ fontSize: "0.65rem", color: "var(--color-border-light)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            <span style={{ whiteSpace: "nowrap", paddingRight: 0 }}>{BRANDS_MARQUEE}{BRANDS_MARQUEE}{BRANDS_MARQUEE}{BRANDS_MARQUEE}</span>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 2 — STATS BAR
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
            gridTemplateColumns: "repeat(4, 1fr)",
          }}
        >
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              style={{
                padding: "24px 20px",
                textAlign: "center",
                borderRight: i < STATS.length - 1 ? "1px solid var(--color-border)" : "none",
              }}
            >
              <div
                className="font-display"
                style={{
                  fontWeight: 800,
                  fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
                  color: "var(--color-text)",
                  lineHeight: 1,
                  marginBottom: 6,
                }}
              >
                {stat.value}
              </div>
              <div className="spec-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================
          GARAGE BANNER — personalized if user has a scooter
          ================================================================ */}
      <GarageBanner />

      {/* ================================================================
          SECTION 3 — FEATURED PRODUCTS
          ================================================================ */}
      <section style={{ backgroundColor: "var(--color-void)", padding: "64px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          {/* Title */}
          <div style={{ marginBottom: 8 }}>
            <h2 className="heading-lg">NOS {brand.nav.mainCategory}</h2>
            <span
              className="font-mono"
              style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}
            >
              Sélection
            </span>
          </div>
          <div className="divider-neon" style={{ marginBottom: 32 }} />

          {/* Product grid */}
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
          SECTION 4 — CATEGORIES
          ================================================================ */}
      <section
        className="grain"
        style={{ backgroundColor: "var(--color-surface)", padding: "64px 0" }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div
            className="categories-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: 16,
              minHeight: 360,
            }}
          >
            {/* Large card */}
            <div
              style={{
                gridRow: "1 / 3",
                position: "relative",
                overflow: "hidden",
                border: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <Image
                src="https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg"
                alt={`${brand.nav.mainCategory}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{
                  objectFit: "cover",
                  opacity: 0.3,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 100%)",
                }}
              />
              <div style={{ position: "relative", padding: 28, zIndex: 2 }}>
                <div className="spec-label" style={{ marginBottom: 8, color: "var(--color-neon)" }}>
                  CATÉGORIE PRINCIPALE
                </div>
                <h3 className="heading-lg" style={{ color: "var(--color-text)", marginBottom: 12 }}>
                  {brand.nav.mainCategory} ÉLECTRIQUES
                </h3>
                <Link href="/produits?categorySlug=trottinettes-electriques" className="btn-neon" style={{ padding: "0.5rem 1.5rem", fontSize: "0.7rem" }}>
                  EXPLORER
                </Link>
              </div>
            </div>

            {/* Small category cards */}
            {CATEGORIES_SMALL.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.name}
                  href={`/produits?categorySlug=${cat.slug}`}
                  className="category-card"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "border-color 200ms",
                    cursor: "pointer",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div>
                    <Icon style={{ width: 22, height: 22, color: "var(--color-text-dim)", marginBottom: 12 }} />
                    <h4
                      className="font-display"
                      style={{
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        color: "var(--color-text)",
                        textTransform: "uppercase",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {cat.name}
                    </h4>
                  </div>
                  <span className="font-mono" style={{ fontSize: "0.65rem", color: "var(--color-text-dim)" }}>
                    {cat.count} produits
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 5 — ATELIER
          ================================================================ */}
      <section style={{ backgroundColor: "var(--color-void)", padding: "80px 0" }}>
        <div
          className="atelier-grid"
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          {/* Left: Big text */}
          <div>
            <h2
              className="heading-xl text-outline"
              style={{ marginBottom: 8 }}
            >
              ATELIER
            </h2>
            <h2
              className="heading-xl"
              style={{ color: "var(--color-neon)" }}
            >
              RÉPARATION
            </h2>
          </div>

          {/* Right: Spec blocks */}
          <div>
            <div style={{ marginBottom: 24 }}>
              <h4
                className="font-display"
                style={{
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: "var(--color-text)",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                DIAGNOSTIC
              </h4>
              <p className="font-mono" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                Identification du problème en 2 clics
              </p>
            </div>

            <div className="divider" style={{ marginBottom: 24 }} />

            <div style={{ marginBottom: 24 }}>
              <h4
                className="font-display"
                style={{
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: "var(--color-text)",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                RÉPARATION
              </h4>
              <p className="font-mono" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                Toutes marques, toutes pannes
              </p>
            </div>

            <div className="divider" style={{ marginBottom: 24 }} />

            <div style={{ marginBottom: 32 }}>
              <h4
                className="font-display"
                style={{
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: "var(--color-text)",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                PIÈCES
              </h4>
              <p className="font-mono" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                700+ références en stock immédiat
              </p>
            </div>

            <Link href="/reparation" className="btn-neon">
              DÉPOSER UN TICKET SAV
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 6 — REVIEWS
          ================================================================ */}
      <section style={{ backgroundColor: "var(--color-surface)", padding: "64px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ marginBottom: 32 }}>
            <h2 className="heading-lg" style={{ marginBottom: 8 }}>
              AVIS CLIENTS
            </h2>
            <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              Google &middot; 5.0 &middot; {brand.googleReviewCount} avis
            </span>
          </div>

          <div
            className="reviews-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            {REVIEWS.map((review, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  padding: 24,
                }}
              >
                <div style={{ marginBottom: 12, color: "var(--color-neon)", letterSpacing: 2 }}>
                  ★★★★★
                </div>
                <p
                  className="font-mono"
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                    lineHeight: 1.6,
                    fontStyle: "italic",
                    marginBottom: 16,
                  }}
                >
                  &ldquo;{review.text}&rdquo;
                </p>
                <div>
                  <span style={{ color: "var(--color-text)", fontSize: "0.85rem", fontWeight: 600 }}>
                    {review.name}
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: "0.65rem", color: "var(--color-text-dim)", marginLeft: 8 }}
                  >
                    {review.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 7 — NEWSLETTER
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
