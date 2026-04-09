import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { brand } from "@/lib/brand";
import { formatPriceTTC, priceTTC } from "@/lib/utils";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/api";
import ProductGallery from "./ProductGallery";
import AddToCartSection from "./AddToCartSection";
import StockAlertForm from "./StockAlertForm";

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

const ECOMMERCE_BASE_URL = process.env.ECOMMERCE_URL || process.env.NEXT_PUBLIC_API_ECOMMERCE || "http://localhost:3001";

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />

      <div
        className="px-4 sm:px-6 lg:px-8 py-3"
        style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
      >
        <nav
          className="mx-auto max-w-[1400px] font-mono text-[0.65rem] uppercase tracking-wider flex items-center gap-2 flex-wrap"
          style={{ color: "var(--color-text-dim)" }}
        >
          <Link href="/" className="transition-colors hover:text-neon">
            ACCUEIL
          </Link>
          <span>/</span>
          <Link href="/produits" className="transition-colors hover:text-neon">
            CATALOGUE
          </Link>
          {categoryName && categorySlug && (
            <>
              <span>/</span>
              <Link href={`/produits?categorySlug=${categorySlug}`} className="transition-colors hover:text-neon">
                {categoryName.toUpperCase()}
              </Link>
            </>
          )}
          <span>/</span>
          <span style={{ color: "var(--color-text-muted)" }}>{product.name.toUpperCase()}</span>
        </nav>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 lg:gap-12">
          <ProductGallery images={images} productName={product.name} />

          <div className="py-2">
            {product.brand && (
              <Link
                href={`/produits?search=${product.brand.slug}`}
                className="spec-label transition-colors hover:opacity-80"
                style={{ color: "var(--color-neon)" }}
              >
                {product.brand.name}
              </Link>
            )}

            <h1 className="heading-lg mt-2 mb-4" style={{ color: "var(--color-text)" }}>
              {product.name.toUpperCase()}
            </h1>

            <div className="divider mb-5" />

            <div className="mb-5">
              <div className="flex items-baseline gap-3">
                <span className="price-main">{ttcFormatted}</span>
                {hasSalePrice && (
                  <span className="font-mono text-sm line-through" style={{ color: "var(--color-text-dim)" }}>
                    {formatPriceTTC(product.priceHt, product.tvaRate)}
                  </span>
                )}
              </div>
              <p className="price-sub mt-1">{formatHT(displayPriceHt)} &euro; HT</p>
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

            <div className="divider mb-5" />

            <div className="space-y-3 mb-5">
              <div className="flex items-start gap-6">
                <span className="spec-label w-28 flex-shrink-0 pt-0.5">RÉF.</span>
                <span className="spec-value">{product.sku}</span>
              </div>

              {categoryName && (
                <div className="flex items-start gap-6">
                  <span className="spec-label w-28 flex-shrink-0 pt-0.5">CATÉGORIE</span>
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

            {inStock && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  backgroundColor: "rgba(0, 255, 209, 0.08)",
                  border: "1px solid rgba(0, 255, 209, 0.2)",
                  marginBottom: 20,
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <MapPin style={{ width: 16, height: 16, color: "var(--color-neon)", flexShrink: 0 }} />
                <div>
                  <p className="font-display" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-neon)" }}>
                    RETRAIT BOUTIQUE EN 1H
                  </p>
                  <p className="font-mono" style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>
                    Commandez en ligne, récupérez en magasin
                  </p>
                </div>
                <Clock style={{ width: 14, height: 14, color: "var(--color-text-dim)", flexShrink: 0, marginLeft: "auto" }} />
              </div>
            )}

            <div className="divider mb-5" />

            {inStock ? (
              <AddToCartSection productId={product.id} variantId={variant?.id} maxQuantity={variant?.stockQuantity ?? 99} />
            ) : (
              <StockAlertForm productId={product.id} variantId={variant?.id} />
            )}
          </div>
        </div>

        {(product.shortDescription || product.description) && (
          <div className="mt-16">
            <div className="divider mb-8" />
            <p className="spec-label mb-4">DESCRIPTION</p>

            {product.shortDescription && (
              <div
                className="font-mono text-sm leading-relaxed mb-4"
                style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}
                dangerouslySetInnerHTML={{ __html: sanitizeProductHtml(product.shortDescription) }}
              />
            )}

            {product.description && product.description !== product.shortDescription && (
              <div
                className="font-mono text-sm leading-relaxed"
                style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}
                dangerouslySetInnerHTML={{ __html: sanitizeProductHtml(product.description) }}
              />
            )}
          </div>
        )}

        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <div className="divider mb-8" />
            <p className="spec-label mb-6">PRODUITS SIMILAIRES</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {relatedProducts.map((rp) => (
                <ProductCard key={rp.id} product={rp} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-10">
          <Link
            href="/produits"
            className="font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-colors hover:text-neon"
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
