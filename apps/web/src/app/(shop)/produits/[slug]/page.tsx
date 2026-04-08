"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, ImageOff, ArrowLeft, MapPin, Clock, Bell } from "lucide-react";
import DOMPurify from "dompurify";
import { productsApi, cartApi, stockAlertsApi, type Product } from "@/lib/api";
import { formatPriceTTC, priceTTC } from "@/lib/utils";
import ProductCard from "@/components/ProductCard";

function formatHT(priceHt: string): string {
  const num = parseFloat(priceHt);
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [cartSuccess, setCartSuccess] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSent, setAlertSent] = useState(false);
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertError, setAlertError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await productsApi.getBySlug(slug);
        setProduct(res.data);

        if (res.data.categories?.[0]?.category?.slug) {
          try {
            const relRes = await productsApi.list({
              categorySlug: res.data.categories[0].category.slug,
              limit: 8,
            });
            setRelatedProducts(
              relRes.data.filter((p) => p.id !== res.data.id).slice(0, 4)
            );
          } catch {
            // not critical
          }
        }
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  async function handleAddToCart() {
    if (!product) return;
    setAddingToCart(true);
    try {
      await cartApi.addItem({
        productId: product.id,
        variantId: product.variants?.[0]?.id,
        quantity,
      });
      window.dispatchEvent(new Event("trottistore:cart-updated"));
      setCartSuccess(true);
      setCartMessage("Produit ajouté au panier");
      setTimeout(() => {
        setCartMessage("");
        setCartSuccess(false);
      }, 3000);
    } catch {
      setCartMessage("Erreur lors de l'ajout au panier");
      setTimeout(() => setCartMessage(""), 3000);
    } finally {
      setAddingToCart(false);
    }
  }

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--color-void)" }}>
        {/* Breadcrumb skeleton */}
        <div className="px-4 sm:px-6 lg:px-8 py-3" style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
          <div className="mx-auto max-w-[1400px]">
            <div className="h-3 w-72 animate-pulse" style={{ backgroundColor: "var(--color-surface-2)" }} />
          </div>
        </div>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 lg:gap-12">
            <div>
              <div className="aspect-square animate-pulse" style={{ backgroundColor: "#0F0F0F" /* image bg */, border: "1px solid var(--color-border)" }} />
              <div className="flex gap-2 mt-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-16 h-16 animate-pulse" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }} />
                ))}
              </div>
            </div>
            <div className="space-y-4 py-2">
              <div className="h-3 w-24 animate-pulse" style={{ backgroundColor: "var(--color-surface-2)" }} />
              <div className="h-8 w-full animate-pulse" style={{ backgroundColor: "var(--color-surface-2)" }} />
              <div className="h-8 w-2/3 animate-pulse" style={{ backgroundColor: "var(--color-surface-2)" }} />
              <div className="divider my-4" />
              <div className="h-10 w-40 animate-pulse" style={{ backgroundColor: "var(--color-surface-2)" }} />
              <div className="h-4 w-28 animate-pulse" style={{ backgroundColor: "var(--color-surface-2)" }} />
              <div className="divider my-4" />
              <div className="h-12 w-full animate-pulse mt-6" style={{ backgroundColor: "var(--color-surface-2)" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Not found ─── */
  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-void)" }}>
        <div className="text-center">
          <h1 className="heading-lg mb-4" style={{ color: "var(--color-text)" }}>
            PRODUIT INTROUVABLE
          </h1>
          <Link
            href="/produits"
            className="font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-colors"
            style={{ color: "var(--color-neon)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Derived data ─── */
  const variant = product.variants?.[0];
  const inStock = variant ? variant.stockQuantity > 0 : true;
  const stockQty = variant?.stockQuantity ?? 0;
  const images = product.images?.length ? product.images : [];
  const hasSalePrice =
    !!product.salePriceHt &&
    parseFloat(product.salePriceHt) < parseFloat(product.priceHt);

  const displayPriceHt = hasSalePrice ? product.salePriceHt! : product.priceHt;
  const ttcFormatted = formatPriceTTC(displayPriceHt, product.tvaRate);
  const ttcNum = priceTTC(displayPriceHt, product.tvaRate);

  const categoryName = product.categories?.[0]?.category?.name;
  const categorySlug = product.categories?.[0]?.category?.slug;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-void)" }}>
      {/* ── Breadcrumb bar ── */}
      <div
        className="px-4 sm:px-6 lg:px-8 py-3"
        style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
      >
        <nav className="mx-auto max-w-[1400px] font-mono text-[0.65rem] uppercase tracking-wider flex items-center gap-2 flex-wrap" style={{ color: "var(--color-text-dim)" }}>
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
              <Link
                href={`/produits?categorySlug=${categorySlug}`}
                className="transition-colors hover:text-neon"
              >
                {categoryName.toUpperCase()}
              </Link>
            </>
          )}
          <span>/</span>
          <span style={{ color: "var(--color-text-muted)" }}>{product.name.toUpperCase()}</span>
        </nav>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 lg:gap-12">
          {/* ── LEFT: Image gallery ── */}
          <div>
            {/* Main image */}
            <div
              className="aspect-square flex items-center justify-center overflow-hidden relative"
              style={{ backgroundColor: "#0F0F0F" /* image bg */, border: "1px solid var(--color-border)" }}
            >
              {images[selectedImage] ? (
                <Image
                  src={images[selectedImage].url}
                  alt={images[selectedImage].alt || product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  style={{ objectFit: "contain", padding: "24px" }}
                />
              ) : (
                <ImageOff className="w-20 h-20" style={{ color: "var(--color-border)" }} />
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-3">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0 overflow-hidden transition-colors relative"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      border: i === selectedImage ? "1px solid var(--color-neon)" : "1px solid var(--color-border)",
                    }}
                  >
                    <Image
                      src={img.url}
                      alt=""
                      fill
                      sizes="80px"
                      style={{ objectFit: "contain", padding: "4px" }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Spec sheet ── */}
          <div className="py-2">
            {/* Brand */}
            {product.brand && (
              <Link
                href={`/produits?search=${product.brand.slug}`}
                className="spec-label transition-colors hover:opacity-80"
                style={{ color: "var(--color-neon)" }}
              >
                {product.brand.name}
              </Link>
            )}

            {/* Product name */}
            <h1 className="heading-lg mt-2 mb-4" style={{ color: "var(--color-text)" }}>
              {product.name.toUpperCase()}
            </h1>

            <div className="divider mb-5" />

            {/* ── Price block ── */}
            <div className="mb-5">
              <div className="flex items-baseline gap-3">
                <span className="price-main">{ttcFormatted}</span>
                {hasSalePrice && (
                  <span className="font-mono text-sm line-through" style={{ color: "var(--color-text-dim)" }}>
                    {formatPriceTTC(product.priceHt, product.tvaRate)}
                  </span>
                )}
              </div>
              <p className="price-sub mt-1">
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

            <div className="divider mb-5" />

            {/* ── Specs table ── */}
            <div className="space-y-3 mb-5">
              {/* REF */}
              <div className="flex items-start gap-6">
                <span className="spec-label w-28 flex-shrink-0 pt-0.5">RÉF.</span>
                <span className="spec-value">{product.sku}</span>
              </div>

              {/* Category */}
              {categoryName && (
                <div className="flex items-start gap-6">
                  <span className="spec-label w-28 flex-shrink-0 pt-0.5">CATÉGORIE</span>
                  <span className="spec-value">{categoryName}</span>
                </div>
              )}

              {/* Weight */}
              {product.weightGrams && (
                <div className="flex items-start gap-6">
                  <span className="spec-label w-28 flex-shrink-0 pt-0.5">POIDS</span>
                  <span className="spec-value">{(product.weightGrams / 1000).toFixed(1)} kg</span>
                </div>
              )}

              {/* Stock */}
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

            {/* Badge retrait boutique */}
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

            {/* ── Quantity + Add to cart ── */}
            {inStock && (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <span className="spec-label">QTÉ</span>
                  <div className="flex items-center" style={{ border: "1px solid var(--color-border)" }}>
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", borderRight: "1px solid var(--color-border)" }}
                      aria-label="Diminuer la quantité"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 1) setQuantity(val);
                      }}
                      min={1}
                      className="w-12 h-10 text-center font-mono text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", border: "none" }}
                    />
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text)", borderLeft: "1px solid var(--color-border)" }}
                      aria-label="Augmenter la quantité"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className="btn-neon w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ height: "48px" }}
                >
                  {cartSuccess
                    ? "AJOUTÉ AU PANIER"
                    : addingToCart
                    ? "AJOUT EN COURS..."
                    : "AJOUTER AU PANIER"}
                </button>

                <p className="font-mono text-xs text-text-muted mt-3">
                  Droit de rétractation de 14 jours et garantie légale de conformité de 2 ans.{" "}
                  <Link href="/cgv" className="underline text-text">
                    Voir les CGV
                  </Link>
                  .
                </p>
              </>
            )}

            {!inStock && (
              <div>
                <div
                  className="w-full h-12 font-mono text-xs uppercase tracking-wider flex items-center justify-center mb-3"
                  style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-text-dim)", border: "1px solid var(--color-border)" }}
                >
                  RUPTURE DE STOCK
                </div>
                {alertSent ? (
                  <div
                    className="flex items-center gap-2 p-3"
                    style={{ backgroundColor: "rgba(0, 255, 209, 0.08)", border: "1px solid rgba(0, 255, 209, 0.2)" }}
                  >
                    <Bell style={{ width: 16, height: 16, color: "var(--color-neon)" }} />
                    <p className="font-mono text-xs" style={{ color: "var(--color-neon)" }}>
                      Vous serez prevenu(e) des le retour en stock.
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!product) return;
                      setAlertError("");
                      setAlertSubmitting(true);
                      try {
                        await stockAlertsApi.create({
                          productId: product.id,
                          variantId: variant?.id,
                          email: alertEmail,
                        });
                        setAlertSent(true);
                      } catch {
                        setAlertError("Impossible d'enregistrer l'alerte pour le moment.");
                      } finally {
                        setAlertSubmitting(false);
                      }
                    }}
                    className="flex gap-0"
                  >
                    <input
                      type="email"
                      required
                      placeholder="Votre email pour etre prevenu"
                      value={alertEmail}
                      onChange={(e) => setAlertEmail(e.target.value)}
                      className="input-dark flex-1"
                      style={{ borderRight: "none" }}
                    />
                    <button
                      type="submit"
                      disabled={alertSubmitting}
                      className="btn-neon whitespace-nowrap disabled:opacity-60"
                      style={{ borderRadius: 0 }}
                    >
                      <Bell style={{ width: 14, height: 14 }} />
                      {alertSubmitting ? "ENVOI..." : "ALERTEZ-MOI"}
                    </button>
                  </form>
                )}
                {alertError && (
                  <p className="font-mono text-xs mt-2" style={{ color: "var(--color-danger)" }}>
                    {alertError}
                  </p>
                )}
              </div>
            )}

            {/* Cart message */}
            {cartMessage && (
              <div className="mt-3">
                <p
                  className="font-mono text-xs uppercase tracking-wider"
                  style={{ color: cartSuccess ? "var(--color-neon)" : "var(--color-danger)" }}
                >
                  {cartMessage}
                </p>
                {cartSuccess && (
                  <Link
                    href="/panier"
                    className="btn-outline inline-block mt-2"
                    style={{ fontSize: "0.7rem", padding: "0.4rem 1.2rem" }}
                  >
                    VOIR LE PANIER
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Description section ── */}
        {(product.shortDescription || product.description) && (
          <div className="mt-16">
            <div className="divider mb-8" />
            <p className="spec-label mb-4">DESCRIPTION</p>

            {product.shortDescription && (
              <div
                className="font-mono text-sm leading-relaxed mb-4"
                style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.shortDescription) }}
              />
            )}

            {product.description &&
              product.description !== product.shortDescription && (
                <div
                  className="font-mono text-sm leading-relaxed"
                  style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
                />
              )}
          </div>
        )}

        {/* ── Related products ── */}
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
      </div>
    </div>
  );
}
