"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Lock,
  Headphones,
  Truck,
  Star,
  ShoppingCart,
  Heart,
  Eye,
} from "lucide-react";
import { formatPriceTTC } from "@/lib/utils";

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

const GOOGLE_REVIEWS = [
  {
    name: "Marc D.",
    date: "il y a 2 semaines",
    text: "Excellent service ! Ma Dualtron Achilleus est arrivée en 48h, parfaitement emballée. Le SAV m'a rappelé pour vérifier que tout était ok.",
  },
  {
    name: "Sophie L.",
    date: "il y a 1 mois",
    text: "J'ai fait réparer ma trottinette à l'atelier de l'Île-Saint-Denis. Travail impeccable, prix honnête et très bon accueil.",
  },
  {
    name: "Karim B.",
    date: "il y a 3 semaines",
    text: "Paiement en 4x sans frais, c'est top pour une Teverun Fighter. Livraison rapide et produit conforme à la description.",
  },
  {
    name: "Julie M.",
    date: "il y a 1 mois",
    text: "Très satisfaite de ma Kuickwheel S9 ! Parfaite pour mes trajets quotidiens. Merci TrottiStore pour les conseils.",
  },
  {
    name: "Thomas R.",
    date: "il y a 2 mois",
    text: "Spécialistes sérieux, ils connaissent vraiment leur sujet. J'ai eu un diagnostic gratuit et des recommandations pertinentes.",
  },
];

const BLOG_POSTS = [
  {
    title: "Guide d'achat trottinette électrique 2026",
    category: "Guide d'Achat",
    image:
      "https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNSPACE52V18A-TROTTINETTE-ELECTRIQUE-TEVERUN-SPACE-52V-18AH-300x300.png",
    slug: "guide-achat-trottinette-2026",
    date: "15 mars 2026",
  },
  {
    title: "Comment entretenir sa trottinette électrique",
    category: "Entretien",
    image:
      "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONFOREVER60V18A2025-TROTTINETTE-ELECTRIQUE-DUALTRON-FOREVER-60V-182A-2025-EY4-300x300.jpg",
    slug: "entretenir-trottinette-electrique",
    date: "8 mars 2026",
  },
  {
    title: "Les meilleurs accessoires pour trottinette",
    category: "Conseils Pratiques",
    image:
      "https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg",
    slug: "meilleurs-accessoires-trottinette",
    date: "1 mars 2026",
  },
  {
    title: "Réglementation trottinette électrique en France",
    category: "Guide d'Achat",
    image:
      "https://www.trottistore.fr/wp-content/uploads/2025/07/MMDUALTRONXLTD-TROTTINETTE-ELECTRIQUE-DUALTRON-X-LTD-300x300.jpg",
    slug: "reglementation-trottinette-france",
    date: "22 février 2026",
  },
];

// ─── PRODUCT CARD COMPONENT ──────────────────────────────

function ProductCard({ product }: { product: FeaturedProduct }) {
  const primaryImage = product.images?.[0];
  const price = formatPriceTTC(product.priceHt, product.tvaRate);

  return (
    <div className="product-card">
      <Link href={`/produits/${product.slug}`}>
        <div className="product-card-image">
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.alt || product.name}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#d1d5db",
                fontSize: "3rem",
              }}
            >
              🛴
            </div>
          )}
        </div>
      </Link>
      <div className="product-card-body">
        {product.brand && (
          <div className="product-card-category">{product.brand.name}</div>
        )}
        <Link href={`/produits/${product.slug}`}>
          <h3 className="product-card-title">{product.name}</h3>
        </Link>
        <div className="product-card-price">{price}</div>
        <div className="product-card-actions">
          <button className="btn-add">
            <ShoppingCart style={{ width: 14, height: 14 }} />
            Ajouter au panier
          </button>
          <button className="btn-icon">
            <Heart style={{ width: 16, height: 16 }} />
          </button>
          <Link href={`/produits/${product.slug}`} className="btn-icon">
            <Eye style={{ width: 16, height: 16 }} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT GRID SKELETON ───────────────────────────────

function ProductGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "16px",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="product-card" style={{ opacity: 0.5 }}>
          <div className="product-card-image">
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#f3f4f6",
              }}
            />
          </div>
          <div className="product-card-body">
            <div
              style={{
                height: 10,
                background: "#f3f4f6",
                borderRadius: 4,
                marginBottom: 8,
                width: "60%",
              }}
            />
            <div
              style={{
                height: 12,
                background: "#f3f4f6",
                borderRadius: 4,
                marginBottom: 8,
                width: "90%",
              }}
            />
            <div
              style={{
                height: 16,
                background: "#f3f4f6",
                borderRadius: 4,
                width: "40%",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── HOMEPAGE ─────────────────────────────────────────────

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("new");

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await fetch("/api/v1/products/featured");
        if (res.ok) {
          const data = await res.json();
          setFeaturedProducts(data.data || data.products || data || []);
        }
      } catch {
        // Silently fail — products will show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchFeatured();
  }, []);

  return (
    <>
      {/* ================================================================
          SECTION 1 — HERO BANNER
          ================================================================ */}
      <section
        style={{
          position: "relative",
          width: "100%",
          minHeight: 420,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage:
            "url('https://www.trottistore.fr/wp-content/uploads/2025/07/TEVERUNTETRA-TROTTINETTE-ELECTRIQUE-TEVERUN-TETRA-4-MOTEURS-300x300.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "white",
          textAlign: "center",
        }}
      >
        {/* Dark overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.65), rgba(0,0,0,0.75))",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 800,
            padding: "60px 20px",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              fontWeight: 800,
              letterSpacing: "0.02em",
              lineHeight: 1.2,
              marginBottom: 16,
              textTransform: "uppercase",
            }}
          >
            Glissez en toute liberté avec nos trottinettes
          </h1>
          <p
            style={{
              fontSize: "clamp(0.95rem, 2vw, 1.15rem)",
              color: "rgba(255,255,255,0.8)",
              marginBottom: 28,
              lineHeight: 1.6,
            }}
          >
            Découvrez notre sélection de trottinettes électriques des
            meilleures marques. Livraison rapide, paiement en plusieurs fois,
            SAV expert.
          </p>
          <Link
            href="/produits?categorySlug=trottinettes-electriques"
            className="btn-primary"
            style={{ fontSize: "1rem", padding: "14px 32px" }}
          >
            En savoir plus
          </Link>
        </div>
      </section>

      {/* ================================================================
          SECTION 2 — TRUST BADGES
          ================================================================ */}
      <div className="trust-badges">
        <div className="trust-badge">
          <div className="trust-badge-icon">
            <Shield style={{ width: 28, height: 28 }} />
          </div>
          <div className="trust-badge-text">
            <h4>Garantie</h4>
            <p>Satisfait ou remboursé</p>
          </div>
        </div>
        <div className="trust-badge">
          <div className="trust-badge-icon">
            <Lock style={{ width: 28, height: 28 }} />
          </div>
          <div className="trust-badge-text">
            <h4>Paiement sécurisé</h4>
            <p>Paiements 100% sécurisés</p>
          </div>
        </div>
        <div className="trust-badge">
          <div className="trust-badge-icon">
            <Headphones style={{ width: 28, height: 28 }} />
          </div>
          <div className="trust-badge-text">
            <h4>Assistance</h4>
            <p>Support dédié en 24h</p>
          </div>
        </div>
        <div className="trust-badge">
          <div className="trust-badge-icon">
            <Truck style={{ width: 28, height: 28 }} />
          </div>
          <div className="trust-badge-text">
            <h4>Livraison rapide</h4>
            <p>Expédition sous 24-48h</p>
          </div>
        </div>
      </div>

      {/* ================================================================
          SECTION 3 — BONNES AFFAIRES DU JOUR
          ================================================================ */}
      <section style={{ background: "white", padding: "48px 0" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              marginBottom: 32,
              flexWrap: "wrap",
            }}
          >
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              Bonnes affaires du jour
            </h2>
            <div className="countdown">
              <span className="countdown-digit">05</span>:
              <span className="countdown-digit">23</span>:
              <span className="countdown-digit">41</span>:
              <span className="countdown-digit">09</span>
            </div>
          </div>

          {loading ? (
            <ProductGridSkeleton count={5} />
          ) : featuredProducts.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {featuredProducts.slice(0, 10).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#9ca3af",
              }}
            >
              <p style={{ marginBottom: 12 }}>
                Les produits arrivent bientôt...
              </p>
              <Link
                href="/produits"
                className="btn-primary"
              >
                Voir tous les produits
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================
          SECTION 4 — PRODUITS RECOMMANDÉS (TABS)
          ================================================================ */}
      <section style={{ background: "#f9fafb", padding: "48px 0" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px" }}>
          <h2 className="section-title">Produits recommandés</h2>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 0,
              marginBottom: 32,
              borderBottom: "2px solid #f3f4f6",
            }}
          >
            {[
              { key: "new", label: "Nouvelles arrivées" },
              { key: "best", label: "Meilleure vente" },
              { key: "promo", label: "En promotion" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "10px 24px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  borderBottom:
                    activeTab === tab.key
                      ? "2px solid #28afb1"
                      : "2px solid transparent",
                  color:
                    activeTab === tab.key ? "#28afb1" : "#6b7280",
                  cursor: "pointer",
                  marginBottom: -2,
                  transition: "color 150ms ease, border-color 150ms ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <ProductGridSkeleton count={5} />
          ) : featuredProducts.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {featuredProducts.slice(0, 10).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#9ca3af",
              }}
            >
              <p>Aucun produit pour le moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================
          SECTION 5 — GOOGLE REVIEWS
          ================================================================ */}
      <section style={{ background: "white", padding: "48px 0" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px" }}>
          <h2 className="section-title">
            Découvrez ce que nos clients pensent de nous sur Google !
          </h2>

          {/* Rating summary */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginBottom: 32,
            }}
          >
            <img
              src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_42x16dp.png"
              alt="Google"
              style={{ height: 20 }}
            />
            <span
              style={{ fontWeight: 700, fontSize: "1.1rem", color: "#1a1a1a" }}
            >
              5.0
            </span>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  style={{
                    width: 18,
                    height: 18,
                    fill: "#facc15",
                    color: "#facc15",
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              Basé sur 103 avis
            </span>
          </div>

          {/* Review cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {GOOGLE_REVIEWS.map((review, i) => (
              <div
                key={i}
                style={{
                  background: "#f9fafb",
                  border: "1px solid #f3f4f6",
                  borderRadius: 8,
                  padding: 20,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#28afb1",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      flexShrink: 0,
                    }}
                  >
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: "#1a1a1a",
                      }}
                    >
                      {review.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                      {review.date}
                    </div>
                  </div>
                </div>
                {/* Stars */}
                <div
                  style={{ display: "flex", gap: 2, marginBottom: 10 }}
                >
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      style={{
                        width: 14,
                        height: 14,
                        fill: "#facc15",
                        color: "#facc15",
                      }}
                    />
                  ))}
                </div>
                {/* Text */}
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#4b5563",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {review.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 6 — BLOG "CONSEILS ET ASTUCES TROTTI"
          ================================================================ */}
      <section style={{ background: "#f9fafb", padding: "48px 0" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px" }}>
          <h2 className="section-title">Conseils et Astuces Trotti</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
              gap: 20,
            }}
          >
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{
                  display: "block",
                  background: "white",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #f3f4f6",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "16/10",
                    background: "#f3f4f6",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={post.image}
                    alt={post.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  {/* Category badge */}
                  <span
                    className="badge"
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      background: "#28afb1",
                      color: "white",
                    }}
                  >
                    {post.category}
                  </span>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <h3
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: "#1a1a1a",
                      marginBottom: 6,
                      lineHeight: 1.3,
                    }}
                  >
                    {post.title}
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                    {post.date}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 7 — NEWSLETTER
          ================================================================ */}
      <section style={{ background: "white", padding: "48px 0" }}>
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: "0 20px",
            textAlign: "center",
          }}
        >
          <h2 className="section-title">
            Inscrivez-vous à notre newsletter
          </h2>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#6b7280",
              marginBottom: 20,
            }}
          >
            Recevez nos offres exclusives, nouveautés et conseils directement
            dans votre boîte mail.
          </p>
          <form
            onSubmit={(e) => e.preventDefault()}
            style={{
              display: "flex",
              gap: 8,
              maxWidth: 460,
              margin: "0 auto",
            }}
          >
            <input
              type="email"
              placeholder="Votre adresse email"
              style={{
                flex: 1,
                padding: "10px 16px",
                border: "1px solid #e5e7eb",
                borderRadius: 9999,
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
            <button type="submit" className="btn-primary">
              S&apos;inscrire
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
