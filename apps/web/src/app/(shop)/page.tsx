"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Lightbulb, Disc, Cable, Monitor } from "lucide-react";
import { formatPriceTTC, formatPrice } from "@/lib/utils";

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

const BRANDS_MARQUEE =
  "DUALTRON \u00b7 TEVERUN \u00b7 XIAOMI \u00b7 KAABO \u00b7 NINEBOT \u00b7 VSETT \u00b7 SEGWAY \u00b7 KUICKWHEEL \u00b7 ";

const STATS = [
  { value: "2045", label: "PRODUITS" },
  { value: "15", label: "MARQUES" },
  { value: "2019", label: "DEPUIS" },
  { value: "103", label: "AVIS GOOGLE" },
];

const CATEGORIES_SMALL = [
  { name: "ÉCLAIRAGES", icon: Lightbulb, count: 48 },
  { name: "FREINAGE", icon: Disc, count: 92 },
  { name: "CÂBLES", icon: Cable, count: 67 },
  { name: "DISPLAYS", icon: Monitor, count: 31 },
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

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await fetch("/api/v1/products/featured");
        if (res.ok) {
          const data = await res.json();
          setFeaturedProducts(data.data || data.products || data || []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchFeatured();
  }, []);

  return (
    <>
      {/* ================================================================
          SECTION 1 — HERO
          ================================================================ */}
      <section
        className="grain"
        style={{
          minHeight: "100vh",
          backgroundColor: "#0A0A0A",
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
                  color: "#00FFD1",
                  marginBottom: 24,
                  textTransform: "uppercase",
                }}
              >
                MOBILITÉ ÉLECTRIQUE ——
              </p>

              <h1 className="heading-xl animate-slide-up stagger-2">
                GLISSEZ
                <br />
                EN TOUTE
                <br />
                LIBERTÉ<span style={{ color: "#00FFD1" }}>.</span>
              </h1>

              <p
                className="animate-slide-up stagger-3"
                style={{
                  color: "#888",
                  fontSize: "0.95rem",
                  lineHeight: 1.6,
                  maxWidth: 400,
                  marginTop: 24,
                  marginBottom: 32,
                }}
              >
                Trottinettes, pièces détachées et réparation. Expert depuis
                2019.
              </p>

              <div
                className="animate-slide-up stagger-4"
                style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
              >
                <Link href="/produits" className="btn-neon">
                  CATALOGUE
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
                    "radial-gradient(ellipse at center, rgba(0,255,209,0.15) 0%, transparent 70%)",
                  filter: "blur(20px)",
                }}
              />
              <img
                src="https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg"
                alt="Trottinette électrique Teverun Tetra"
                style={{
                  maxWidth: "100%",
                  maxHeight: 400,
                  objectFit: "contain",
                  transform: "rotate(-5deg)",
                  position: "relative",
                  zIndex: 2,
                }}
              />
            </div>
          </div>
        </div>

        {/* Brand marquee */}
        <div
          style={{
            borderTop: "1px solid #1C1C1C",
            padding: "10px 0",
            overflow: "hidden",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div className="marquee-track font-mono" style={{ fontSize: "0.65rem", color: "#333", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            <span style={{ whiteSpace: "nowrap", paddingRight: 0 }}>{BRANDS_MARQUEE}{BRANDS_MARQUEE}{BRANDS_MARQUEE}{BRANDS_MARQUEE}</span>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 2 — STATS BAR
          ================================================================ */}
      <section
        style={{
          backgroundColor: "#141414",
          borderTop: "1px solid #2A2A2A",
          borderBottom: "1px solid #2A2A2A",
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
                borderRight: i < STATS.length - 1 ? "1px solid #2A2A2A" : "none",
              }}
            >
              <div
                className="font-display"
                style={{
                  fontWeight: 800,
                  fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
                  color: "#E8E8E8",
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
          SECTION 3 — FEATURED PRODUCTS
          ================================================================ */}
      <section style={{ backgroundColor: "#0A0A0A", padding: "64px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          {/* Title */}
          <div style={{ marginBottom: 8 }}>
            <h2 className="heading-lg">NOS TROTTINETTES</h2>
            <span
              className="font-mono"
              style={{ fontSize: "0.75rem", color: "#555" }}
            >
              Sélection
            </span>
          </div>
          <div className="divider-neon" style={{ marginBottom: 32 }} />

          {/* Product grid */}
          {loading ? (
            <div
              className="products-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 16,
              }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="product-card"
                  style={{ opacity: 0.4 }}
                >
                  <div
                    className="product-card-image"
                    style={{ background: "#141414" }}
                  >
                    <div style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div className="product-card-body">
                    <div
                      style={{
                        height: 8,
                        background: "#2A2A2A",
                        width: "50%",
                        marginBottom: 8,
                      }}
                    />
                    <div
                      style={{
                        height: 12,
                        background: "#2A2A2A",
                        width: "80%",
                        marginBottom: 10,
                      }}
                    />
                    <div
                      style={{
                        height: 20,
                        background: "#2A2A2A",
                        width: "40%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
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
                          <img
                            src={img.url}
                            alt={img.alt || product.name}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#333",
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
                            color: "#E8E8E8",
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
                color: "#555",
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
        style={{ backgroundColor: "#141414", padding: "64px 0" }}
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
                border: "1px solid #2A2A2A",
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <img
                src="https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg"
                alt="Trottinettes électriques"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
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
                <div className="spec-label" style={{ marginBottom: 8, color: "#00FFD1" }}>
                  CATÉGORIE PRINCIPALE
                </div>
                <h3 className="heading-lg" style={{ color: "#E8E8E8", marginBottom: 12 }}>
                  TROTTINETTES ÉLECTRIQUES
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
                <div
                  key={cat.name}
                  className="category-card"
                  style={{
                    backgroundColor: "#1C1C1C",
                    border: "1px solid #2A2A2A",
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "border-color 200ms",
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <Icon style={{ width: 22, height: 22, color: "#555", marginBottom: 12 }} />
                    <h4
                      className="font-display"
                      style={{
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        color: "#E8E8E8",
                        textTransform: "uppercase",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {cat.name}
                    </h4>
                  </div>
                  <span className="font-mono" style={{ fontSize: "0.65rem", color: "#555" }}>
                    {cat.count} produits
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 5 — ATELIER
          ================================================================ */}
      <section style={{ backgroundColor: "#0A0A0A", padding: "80px 0" }}>
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
              style={{ color: "#00FFD1" }}
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
                  color: "#E8E8E8",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                DIAGNOSTIC
              </h4>
              <p className="font-mono" style={{ fontSize: "0.75rem", color: "#888", lineHeight: 1.5 }}>
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
                  color: "#E8E8E8",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                RÉPARATION
              </h4>
              <p className="font-mono" style={{ fontSize: "0.75rem", color: "#888", lineHeight: 1.5 }}>
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
                  color: "#E8E8E8",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                PIÈCES
              </h4>
              <p className="font-mono" style={{ fontSize: "0.75rem", color: "#888", lineHeight: 1.5 }}>
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
      <section style={{ backgroundColor: "#141414", padding: "64px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ marginBottom: 32 }}>
            <h2 className="heading-lg" style={{ marginBottom: 8 }}>
              AVIS CLIENTS
            </h2>
            <span className="font-mono" style={{ fontSize: "0.75rem", color: "#888" }}>
              Google &middot; 5.0 &middot; 103 avis
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
                  backgroundColor: "#1C1C1C",
                  border: "1px solid #2A2A2A",
                  padding: 24,
                }}
              >
                <div style={{ marginBottom: 12, color: "#00FFD1", letterSpacing: 2 }}>
                  ★★★★★
                </div>
                <p
                  className="font-mono"
                  style={{
                    fontSize: "0.75rem",
                    color: "#888",
                    lineHeight: 1.6,
                    fontStyle: "italic",
                    marginBottom: 16,
                  }}
                >
                  &ldquo;{review.text}&rdquo;
                </p>
                <div>
                  <span style={{ color: "#E8E8E8", fontSize: "0.85rem", fontWeight: 600 }}>
                    {review.name}
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: "0.65rem", color: "#555", marginLeft: 8 }}
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
      <section style={{ backgroundColor: "#0A0A0A", padding: "64px 0" }}>
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
          <form
            onSubmit={(e) => e.preventDefault()}
            style={{
              display: "flex",
              flex: 1,
              minWidth: 280,
              gap: 0,
            }}
          >
            <input
              type="email"
              placeholder="Votre adresse email"
              className="input-dark"
              style={{
                flex: 1,
                borderRight: "none",
              }}
            />
            <button type="submit" className="btn-neon" style={{ whiteSpace: "nowrap" }}>
              S&apos;INSCRIRE
            </button>
          </form>
        </div>
      </section>

    </>
  );
}
