"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRight,
  Check,
  X,
  ShoppingCart,
  Loader2,
  ImageOff,
  AlertCircle,
  Package,
  Tag,
  Layers,
  Weight,
  ArrowLeft,
} from "lucide-react";
import { productsApi, cartApi, type Product } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  FadeIn,
  ScaleOnScroll,
  StaggerContainer,
  StaggerItem,
  MagneticButton,
  TextReveal,
} from "@/components/motion";
import ProductCard from "@/components/ProductCard";

function formatPriceTTC(priceHt: string, tvaRate: string): string {
  const ht = parseFloat(priceHt);
  const tva = parseFloat(tvaRate);
  const ttc = ht * (1 + tva / 100);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(ttc);
}

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [cartSuccess, setCartSuccess] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const relatedScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await productsApi.getBySlug(slug);
        setProduct(res.data);

        // Load related products from same category
        if (res.data.categories?.[0]?.category?.slug) {
          try {
            const relRes = await productsApi.list({
              categorySlug: res.data.categories[0].category.slug,
              limit: 8,
            });
            setRelatedProducts(
              relRes.data.filter((p) => p.id !== res.data.id).slice(0, 6)
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
        quantity: 1,
      });
      setCartSuccess(true);
      setCartMessage("Ajoute au panier !");
      setTimeout(() => {
        setCartMessage("");
        setCartSuccess(false);
      }, 3000);
    } catch {
      setCartMessage("Erreur lors de l'ajout");
    } finally {
      setAddingToCart(false);
    }
  }

  // ─── LOADING STATE ──────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-48 mb-12" />
            <div className="flex flex-col items-center">
              <div className="w-full max-w-lg aspect-square bg-gray-800 rounded-3xl mb-8" />
              <div className="h-3 bg-gray-800 rounded w-24 mb-4" />
              <div className="h-10 bg-gray-800 rounded w-96 mb-4" />
              <div className="h-8 bg-gray-800 rounded w-32 mb-8" />
              <div className="h-14 bg-gray-800 rounded-2xl w-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── NOT FOUND ──────────────────────────────────────────
  if (!product) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Produit introuvable</h1>
          <Link
            href="/produits"
            className="text-[#28afb1] hover:text-[#1f9294] font-medium inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  const variant = product.variants?.[0];
  const inStock = variant ? variant.stockQuantity > 0 : true;
  const lowStock = inStock && variant && variant.stockQuantity <= 5;
  const images = product.images?.length ? product.images : [];
  const priceTTC = formatPriceTTC(product.priceHt, product.tvaRate);
  const priceNum = parseFloat(product.priceHt) * (1 + parseFloat(product.tvaRate) / 100);
  const hasSalePrice = !!product.salePriceHt && parseFloat(product.salePriceHt) < parseFloat(product.priceHt);
  const salePriceTTC = hasSalePrice ? formatPriceTTC(product.salePriceHt!, product.tvaRate) : null;

  const specs = [
    { icon: Tag, label: "Reference", value: product.sku },
    {
      icon: Layers,
      label: "Categorie",
      value: product.categories?.[0]?.category?.name || "Non classifie",
    },
    {
      icon: Weight,
      label: "Poids",
      value: product.weightGrams ? `${(product.weightGrams / 1000).toFixed(1)} kg` : null,
    },
    {
      icon: Package,
      label: "Disponibilite",
      value: inStock
        ? lowStock
          ? `En stock — Plus que ${variant?.stockQuantity}`
          : "En stock"
        : "Rupture de stock",
      color: inStock ? (lowStock ? "text-orange-400" : "text-emerald-400") : "text-red-400",
    },
  ].filter((s) => s.value);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — DARK HERO
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-gray-950 relative overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#28afb1]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-16 md:pt-12 md:pb-24 relative">
          {/* Breadcrumb */}
          <nav className="flex items-center text-sm text-gray-500 mb-10 overflow-x-auto">
            <Link
              href="/produits"
              className="hover:text-[#28afb1] transition-colors whitespace-nowrap"
            >
              Catalogue
            </Link>
            {product.categories?.[0] && (
              <>
                <ChevronRight className="w-4 h-4 mx-1.5 flex-shrink-0 text-gray-700" />
                <span className="whitespace-nowrap text-gray-600">
                  {product.categories[0].category?.name}
                </span>
              </>
            )}
            <ChevronRight className="w-4 h-4 mx-1.5 flex-shrink-0 text-gray-700" />
            <span className="text-gray-300 font-medium truncate">{product.name}</span>
          </nav>

          {/* Hero content */}
          <div className="flex flex-col items-center text-center">
            {/* Brand */}
            {product.brand && (
              <FadeIn delay={0.1}>
                <p className="text-xs font-semibold text-[#28afb1] uppercase tracking-[0.2em] mb-3">
                  {product.brand.name}
                </p>
              </FadeIn>
            )}

            {/* Title */}
            <FadeIn delay={0.2}>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight max-w-3xl">
                {product.name}
              </h1>
            </FadeIn>

            {/* Price */}
            <FadeIn delay={0.35}>
              <div className="mb-8">
                {hasSalePrice ? (
                  <div className="flex items-baseline gap-3 justify-center">
                    <span className="text-3xl md:text-4xl font-bold text-white">
                      {salePriceTTC}
                    </span>
                    <span className="text-xl text-gray-500 line-through">{priceTTC}</span>
                  </div>
                ) : (
                  <p className="text-3xl md:text-4xl font-bold text-white">{priceTTC}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {parseFloat(product.priceHt).toFixed(2)} &euro; HT
                </p>
                {priceNum >= 300 && (
                  <p className="text-sm text-[#28afb1] mt-2 font-medium">
                    ou 3x {(priceNum / 3).toFixed(2)} &euro; sans frais
                  </p>
                )}
              </div>
            </FadeIn>

            {/* Stock badge */}
            <FadeIn delay={0.45}>
              <div className="mb-10">
                {inStock ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium",
                      lowStock
                        ? "text-orange-300 bg-orange-500/10 border border-orange-500/20"
                        : "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
                    )}
                  >
                    <Check className="w-4 h-4" />
                    En stock
                    {lowStock && (
                      <span className="text-orange-400 ml-1">
                        — Plus que {variant?.stockQuantity}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-red-300 bg-red-500/10 border border-red-500/20 px-4 py-1.5 rounded-full text-sm font-medium">
                    <X className="w-4 h-4" />
                    Rupture de stock
                  </span>
                )}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — IMAGE GALLERY (dark)
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-gray-950 pb-16 md:pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <ScaleOnScroll className="w-full">
            <div className="aspect-[4/3] md:aspect-[16/10] bg-gray-900 rounded-3xl overflow-hidden relative border border-gray-800/50">
              <AnimatePresence mode="wait">
                {images[selectedImage] ? (
                  <motion.img
                    key={selectedImage}
                    src={images[selectedImage].url}
                    alt={images[selectedImage].alt || product.name}
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className="w-full h-full object-contain p-6 md:p-10"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-700">
                    <ImageOff className="w-24 h-24" />
                  </div>
                )}
              </AnimatePresence>
            </div>
          </ScaleOnScroll>

          {/* Thumbnails */}
          {images.length > 1 && (
            <FadeIn delay={0.1}>
              <div className="flex gap-3 mt-6 overflow-x-auto pb-2 justify-center">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      "w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-900 transition-all duration-300 border-2",
                      i === selectedImage
                        ? "border-[#28afb1] ring-2 ring-[#28afb1]/30 scale-105"
                        : "border-gray-800 hover:border-gray-600 opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-contain p-1" />
                  </button>
                ))}
              </div>
            </FadeIn>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — SPECS (light)
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Image side */}
            <FadeIn direction="left">
              <div className="aspect-square bg-gray-50 rounded-3xl overflow-hidden border border-gray-100">
                {images[0] ? (
                  <img
                    src={images[0].url}
                    alt={product.name}
                    className="w-full h-full object-contain p-8"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ImageOff className="w-20 h-20" />
                  </div>
                )}
              </div>
            </FadeIn>

            {/* Specs side */}
            <div>
              <FadeIn>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">
                  Caracteristiques
                </h2>
              </FadeIn>

              <StaggerContainer className="space-y-0" staggerDelay={0.12}>
                {specs.map((spec) => (
                  <StaggerItem key={spec.label}>
                    <div className="flex items-center gap-4 py-5 border-b border-gray-100 last:border-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex-shrink-0">
                        <spec.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                          {spec.label}
                        </p>
                        <p className={cn("text-sm font-semibold text-gray-900", spec.color)}>
                          {spec.value}
                        </p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}

                {/* Price spec */}
                <StaggerItem>
                  <div className="flex items-center gap-4 py-5 border-b border-gray-100">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#28afb1]/10 text-[#28afb1] flex-shrink-0">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                        Prix TTC
                      </p>
                      <p className="text-lg font-bold text-gray-900">{priceTTC}</p>
                    </div>
                  </div>
                </StaggerItem>
              </StaggerContainer>

              {/* Desktop Add to Cart */}
              <FadeIn delay={0.5}>
                <div className="mt-10 hidden md:block">
                  <MagneticButton
                    onClick={handleAddToCart}
                    className="w-full"
                  >
                    <div
                      className={cn(
                        "w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-lg",
                        cartSuccess
                          ? "bg-emerald-500 text-white shadow-emerald-500/20"
                          : inStock
                            ? "bg-[#28afb1] text-white hover:bg-[#1f9294] shadow-[#28afb1]/20"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      )}
                    >
                      <AnimatePresence mode="wait">
                        {cartSuccess ? (
                          <motion.span
                            key="success"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="flex items-center gap-2"
                          >
                            <Check className="w-5 h-5" />
                            Ajoute au panier !
                          </motion.span>
                        ) : addingToCart ? (
                          <motion.span
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                          >
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Ajout en cours...
                          </motion.span>
                        ) : (
                          <motion.span
                            key="default"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                          >
                            <ShoppingCart className="w-5 h-5" />
                            Ajouter au panier
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </MagneticButton>

                  {cartMessage && !cartSuccess && (
                    <p className="text-sm text-center mt-3 font-medium text-red-600">
                      {cartMessage}
                    </p>
                  )}
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — DESCRIPTION (dark)
          ═══════════════════════════════════════════════════════ */}
      {(product.shortDescription || product.description) && (
        <section className="bg-gray-950 py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
                Description
              </h2>
            </FadeIn>

            {product.shortDescription && (
              <FadeIn delay={0.15}>
                <div
                  className="text-gray-300 text-base md:text-lg leading-relaxed prose prose-invert prose-teal max-w-none mb-8
                    prose-headings:text-white prose-strong:text-white prose-a:text-[#28afb1]
                    prose-p:text-gray-300 prose-li:text-gray-300"
                  dangerouslySetInnerHTML={{ __html: product.shortDescription }}
                />
              </FadeIn>
            )}

            {product.description && product.description !== product.shortDescription && (
              <FadeIn delay={0.25}>
                <div
                  className="text-gray-400 text-sm md:text-base leading-relaxed prose prose-sm prose-invert prose-teal max-w-none
                    prose-headings:text-gray-200 prose-strong:text-gray-200 prose-a:text-[#28afb1]
                    prose-p:text-gray-400 prose-li:text-gray-400"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </FadeIn>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — RELATED PRODUCTS (light)
          ═══════════════════════════════════════════════════════ */}
      {relatedProducts.length > 0 && (
        <section className="bg-white py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 text-center">
                Vous aimerez aussi
              </h2>
              <p className="text-gray-500 text-center mb-10">
                Des produits similaires qui pourraient vous interesser
              </p>
            </FadeIn>

            <div
              ref={relatedScrollRef}
              className="flex gap-4 md:gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide
                -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0
                lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:overflow-visible"
            >
              {relatedProducts.map((rp) => (
                <div
                  key={rp.id}
                  className="min-w-[260px] sm:min-w-[280px] lg:min-w-0 snap-start"
                >
                  <ProductCard product={rp} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          MOBILE STICKY BOTTOM BAR
          ═══════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 inset-x-0 z-50 md:hidden">
        <div className="bg-white/90 backdrop-blur-xl border-t border-gray-200 px-4 py-3 safe-area-bottom">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 truncate">{product.name}</p>
              <p className="text-lg font-bold text-gray-900">{priceTTC}</p>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!inStock || addingToCart}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg flex-shrink-0",
                cartSuccess
                  ? "bg-emerald-500 text-white"
                  : "bg-[#28afb1] text-white hover:bg-[#1f9294] disabled:opacity-50 disabled:cursor-not-allowed shadow-[#28afb1]/20"
              )}
            >
              {cartSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Ajoute !
                </>
              ) : addingToCart ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  Ajouter
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom spacer for mobile sticky bar */}
      <div className="h-20 md:hidden" />
    </>
  );
}
