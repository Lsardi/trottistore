import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Truck, Phone, ChevronRight } from "lucide-react";
import { brand } from "@/lib/brand";
import { formatPriceTTC, priceTTC } from "@/lib/utils";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/api";
import ProductGallery from "./ProductGallery";
import AddToCartSection from "./AddToCartSection";
import StockAlertForm from "./StockAlertForm";
import ProductReviews from "./ProductReviews";
import ProductRatingBadge from "./ProductRatingBadge";
import GoogleReviewsBadge from "@/components/GoogleReviewsBadge";
import GoogleReviewsSection from "@/components/GoogleReviewsSection";

interface ProductsListResponse {
  success?: boolean;
  data?: Product[];
  products?: Product[];
}

interface ProductResponse {
  success?: boolean;
  data?: Product;
  product?: Product;
}

const ECOMMERCE_BASE_URL = process.env.API_URL || "http://localhost:3001";

function formatHT(priceHt: string): string {
  const num = parseFloat(priceHt);
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

import sanitizeHtml from "sanitize-html";

/**
 * Server-safe HTML sanitizer using sanitize-html (no DOM dependency).
 * Whitelist approach: only allow safe tags and attributes.
 */
function sanitizeProductHtml(html?: string | null): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "h4", "span", "div", "table", "thead", "tbody", "tr", "td", "th", "a", "img"],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      span: ["class"],
      div: ["class"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https"],
    disallowedTagsMode: "discard",
  });
}

async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${ECOMMERCE_BASE_URL}/api/v1/products/${slug}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as ProductResponse;
    return payload.data || payload.product || null;
  } catch {
    return null;
  }
}

async function fetchRelatedProducts(product: Product): Promise<Product[]> {
  const categorySlug = product.categories?.[0]?.category?.slug;
  if (!categorySlug) return [];

  try {
    const res = await fetch(
      `${ECOMMERCE_BASE_URL}/api/v1/products?categorySlug=${encodeURIComponent(categorySlug)}&limit=8`,
      { next: { revalidate: 120 } },
    );
    if (!res.ok) return [];
    const payload = (await res.json()) as ProductsListResponse;
    const items = payload.data || payload.products || [];
    return items.filter((p) => p.id !== product.id).slice(0, 4);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return {
      title: `Produit introuvable | ${brand.name}`,
      robots: { index: false, follow: false },
    };
  }

  const displayPriceHt =
    product.salePriceHt && parseFloat(product.salePriceHt) < parseFloat(product.priceHt)
      ? product.salePriceHt
      : product.priceHt;
  const ttc = priceTTC(displayPriceHt, product.tvaRate).toFixed(2);
  const description = (product.shortDescription || product.description || brand.seo.description)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return {
    title: `${product.name} | ${brand.name}`,
    description,
    alternates: {
      canonical: `/produits/${slug}`,
    },
    openGraph: {
      title: `${product.name} | ${brand.name}`,
      description,
      url: `/produits/${slug}`,
      type: "website",
      images: product.images?.[0]
        ? [
            {
              url: product.images[0].url,
              alt: product.images[0].alt || product.name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | ${brand.name}`,
      description,
      images: product.images?.[0] ? [product.images[0].url] : undefined,
    },
    other: {
      "product:price:amount": ttc,
      "product:price:currency": "EUR",
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await fetchRelatedProducts(product);

  const variant = product.variants?.[0];
  const inStock = variant ? variant.stockQuantity > 0 : true;
  const stockQty = variant?.stockQuantity ?? 0;
  const images = product.images?.length ? product.images : [];
  const hasSalePrice = !!product.salePriceHt && parseFloat(product.salePriceHt) < parseFloat(product.priceHt);

  const displayPriceHt = hasSalePrice ? product.salePriceHt! : product.priceHt;
  const ttcFormatted = formatPriceTTC(displayPriceHt, product.tvaRate);
  const ttcNum = priceTTC(displayPriceHt, product.tvaRate);

  const categoryName = product.categories?.[0]?.category?.name;
  const categorySlug = product.categories?.[0]?.category?.slug;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://trottistore.fr" },
      { "@type": "ListItem", position: 2, name: "Catalogue", item: "https://trottistore.fr/produits" },
      ...(categoryName
        ? [{ "@type": "ListItem", position: 3, name: categoryName, item: `https://trottistore.fr/produits?categorySlug=${categorySlug}` }]
        : []),
      { "@type": "ListItem", position: categoryName ? 4 : 3, name: product.name },
    ],
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description || "",
    image: images.map((img) => img.url),
    sku: product.sku || undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      url: `https://trottistore.fr/produits/${slug}`,
      priceCurrency: "EUR",
      price: ttcNum.toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "TrottiStore" },
    },
    ...(categoryName && { category: categoryName }),
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-void)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c") }} />

      {/* Breadcrumb */}
      <div
        className="px-4 sm:px-6 lg:px-8 py-3"
        style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
      >
        <nav
          className="mx-auto max-w-[1400px] font-mono text-[0.65rem] uppercase tracking-wider flex items-center gap-2 flex-wrap"
          style={{ color: "var(--color-text-dim)" }}
        >
          <Link href="/" className="cursor-pointer transition-colors duration-200 hover:text-neon">
            ACCUEIL
          </Link>
          <ChevronRight className="w-3 h-3" style={{ color: "var(--color-border-light)" }} />
          <Link href="/produits" className="cursor-pointer transition-colors duration-200 hover:text-neon">
            CATALOGUE
          </Link>
          {categoryName && categorySlug && (
            <>
              <ChevronRight className="w-3 h-3" style={{ color: "var(--color-border-light)" }} />
              <Link href={`/produits?categorySlug=${categorySlug}`} className="cursor-pointer transition-colors duration-200 hover:text-neon">
                {categoryName.toUpperCase()}
              </Link>
            </>
          )}
          <ChevronRight className="w-3 h-3" style={{ color: "var(--color-border-light)" }} />
          <span style={{ color: "var(--color-text-muted)" }}>{product.name.toUpperCase()}</span>
        </nav>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 lg:gap-12">
          {/* Gallery */}
          <ProductGallery images={images} productName={product.name} />

          {/* Product info */}
          <div className="py-2">
            {product.brand && (
              <Link
                href={`/produits?search=${product.brand.slug}`}
                className="cursor-pointer spec-label transition-colors duration-200 hover:opacity-80"
                style={{ color: "var(--color-neon)" }}
              >
                {product.brand.name}
              </Link>
            )}

            <h1 className="heading-lg mt-2 mb-3" style={{ color: "var(--color-text)" }}>
              {product.name.toUpperCase()}
            </h1>

            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <GoogleReviewsBadge variant="compact" />
              <ProductRatingBadge slug={product.slug} />
            </div>

            <div className="divider mb-5" />

            {/* Price section -- prominent */}
            <div className="mb-5">
              <div className="flex items-baseline gap-3">
                <span
                  className="font-display font-extrabold tracking-tight"
                  style={{ fontSize: "2.25rem", color: "var(--color-neon)", lineHeight: 1 }}
                >
                  {ttcFormatted}
                </span>
                <span
                  className="font-mono text-xs uppercase tracking-wider px-2 py-0.5"
                  style={{
                    color: "var(--color-neon)",
                    backgroundColor: "var(--color-neon-dim)",
                    border: "1px solid rgba(0, 255, 209, 0.25)",
                  }}
                >
                  TTC
                </span>
                {hasSalePrice && (
                  <span className="font-mono text-sm line-through" style={{ color: "var(--color-text-dim)" }}>
                    {formatPriceTTC(product.priceHt, product.tvaRate)}
                  </span>
                )}
              </div>
              <p className="font-mono text-xs mt-1.5" style={{ color: "var(--color-text-dim)" }}>
                {formatHT(displayPriceHt)} &euro; HT
              </p>
              {ttcNum >= 300 && (
                <p className="font-mono text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                  Payez en 3&times;{" "}
                  {new Intl.NumberFormat("fr-FR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(ttcNum / 3)}{" "}
                  &euro;
                </p>
              )}
            </div>

            {/* Delivery + pickup badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              <div
                className="inline-flex items-center gap-2 px-3 py-2"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <Truck style={{ width: 14, height: 14, color: "var(--color-neon)", flexShrink: 0 }} />
                <span className="font-mono text-text-muted" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Livraison 48-72h
                </span>
              </div>
              {inStock && (
                <div
                  className="inline-flex items-center gap-2 px-3 py-2"
                  style={{
                    backgroundColor: "rgba(0, 255, 209, 0.08)",
                    border: "1px solid rgba(0, 255, 209, 0.2)",
                  }}
                >
                  <MapPin style={{ width: 14, height: 14, color: "var(--color-neon)", flexShrink: 0 }} />
                  <span className="font-mono" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-neon)" }}>
                    Retrait boutique 1h
                  </span>
                  <Clock style={{ width: 12, height: 12, color: "var(--color-neon-muted)", flexShrink: 0 }} />
                </div>
              )}
            </div>

            <div className="divider mb-5" />

            {/* Specs */}
            <div className="space-y-3 mb-5">
              <div className="flex items-start gap-6">
                <span className="spec-label w-28 flex-shrink-0 pt-0.5">REF.</span>
                <span className="spec-value">{product.sku}</span>
              </div>

              {categoryName && (
                <div className="flex items-start gap-6">
                  <span className="spec-label w-28 flex-shrink-0 pt-0.5">CATEGORIE</span>
                  <span className="spec-value">{categoryName}</span>
                </div>
              )}

              {product.weightGrams && (
                <div className="flex items-start gap-6">
                  <span className="spec-label w-28 flex-shrink-0 pt-0.5">POIDS</span>
                  <span className="spec-value">{(product.weightGrams / 1000).toFixed(1)} kg</span>
                </div>
              )}

              <div className="flex items-start gap-6">
                <span className="spec-label w-28 flex-shrink-0 pt-0.5">STOCK</span>
                <span className="spec-value flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 flex-shrink-0"
                    style={{
                      backgroundColor: inStock ? "var(--color-neon)" : "var(--color-danger)",
                      borderRadius: "50%",
                      boxShadow: inStock ? "0 0 6px rgba(0, 255, 209, 0.5)" : "0 0 6px rgba(255, 59, 48, 0.5)",
                    }}
                  />
                  {inStock ? (
                    <span>
                      EN STOCK{" "}
                      <span style={{ color: "var(--color-text-dim)" }}>
                        ({stockQty} disponible{stockQty > 1 ? "s" : ""})
                      </span>
                    </span>
                  ) : (
                    <span style={{ color: "var(--color-danger)" }}>RUPTURE DE STOCK</span>
                  )}
                </span>
              </div>
            </div>

            {/* Specs table -- extracted from description HTML */}
            {product.description && (() => {
              const specRegex = /<li><strong>([^<]+)\s*:<\/strong>\s*([^<]+)<\/li>/g;
              const specs: Array<[string, string]> = [];
              let match;
              while ((match = specRegex.exec(product.description)) !== null) {
                specs.push([match[1].trim(), match[2].trim()]);
              }
              if (specs.length === 0) return null;
              return (
                <div className="mb-5">
                  <p className="spec-label mb-3">CARACTERISTIQUES</p>
                  <div className="border border-border overflow-hidden">
                    {specs.map(([label, value], i) => (
                      <div
                        key={label}
                        className="flex items-center px-3 py-2 font-mono text-xs"
                        style={{
                          borderBottom: i < specs.length - 1 ? "1px solid var(--color-border)" : "none",
                          backgroundColor: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-2)",
                        }}
                      >
                        <span className="text-text-dim w-28 flex-shrink-0">{label}</span>
                        <span className="text-text">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="divider mb-5" />

            {inStock ? (
              <AddToCartSection productId={product.id} variantId={variant?.id} maxQuantity={variant?.stockQuantity ?? 99} />
            ) : (
              <StockAlertForm productId={product.id} variantId={variant?.id} />
            )}

            {/* Help CTA */}
            <div
              className="mt-5 flex items-center gap-3 px-4 py-3"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <Phone style={{ width: 16, height: 16, color: "var(--color-neon)", flexShrink: 0 }} />
              <div>
                <p className="font-display text-sm font-bold" style={{ color: "var(--color-text)" }}>
                  Besoin d&apos;aide ?
                </p>
                <p className="font-mono text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Appelez-nous au{" "}
                  <a
                    href="tel:+33176340000"
                    className="cursor-pointer transition-colors duration-200 hover:text-neon"
                    style={{ color: "var(--color-neon)" }}
                  >
                    01 76 34 00 00
                  </a>
                  {" "}ou{" "}
                  <Link
                    href="/contact"
                    className="cursor-pointer underline transition-colors duration-200 hover:text-neon"
                    style={{ color: "var(--color-text)" }}
                  >
                    contactez-nous
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        <ProductReviews slug={product.slug} />

        <GoogleReviewsSection />

        {/* Related products -- horizontal scroll */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <div className="divider-neon mb-8" />
            <div className="flex items-center justify-between mb-6">
              <p className="spec-label">PRODUITS SIMILAIRES</p>
              {categorySlug && (
                <Link
                  href={`/produits?categorySlug=${categorySlug}`}
                  className="cursor-pointer font-mono text-xs text-text-dim hover:text-neon transition-colors duration-200 inline-flex items-center gap-1"
                >
                  Voir tout
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
              {relatedProducts.map((rp) => (
                <div key={rp.id} className="min-w-[260px] lg:min-w-0 flex-shrink-0">
                  <ProductCard product={rp} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10">
          <Link
            href="/produits"
            className="cursor-pointer font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-colors duration-200 hover:text-neon"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
