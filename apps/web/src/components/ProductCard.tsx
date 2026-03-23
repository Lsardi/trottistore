"use client";

import Link from "next/link";
import { ImageOff, ShoppingCart } from "lucide-react";
import { motion } from "motion/react";
import type { Product } from "@/lib/api";
import { cartApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useState } from "react";

function formatPrice(priceHt: string, tvaRate: string): string {
  const ht = parseFloat(priceHt);
  const tva = parseFloat(tvaRate);
  const ttc = ht * (1 + tva / 100);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(ttc);
}

function isNewProduct(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return created >= thirtyDaysAgo;
}

export default function ProductCard({
  product,
  variant: cardVariant = "light",
}: {
  product: Product;
  variant?: "light" | "dark";
}) {
  const [addingToCart, setAddingToCart] = useState(false);
  const [added, setAdded] = useState(false);

  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const defaultVariant = product.variants?.[0];
  const inStock = defaultVariant ? defaultVariant.stockQuantity > 0 : true;
  const lowStock = inStock && defaultVariant && defaultVariant.stockQuantity <= 5;
  const priceTTC = parseFloat(product.priceHt) * (1 + parseFloat(product.tvaRate) / 100);
  const hasSalePrice = !!product.salePriceHt && parseFloat(product.salePriceHt) < parseFloat(product.priceHt);
  const isNew = isNewProduct(product.createdAt);

  const isDark = cardVariant === "dark";

  async function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock || addingToCart) return;
    setAddingToCart(true);
    try {
      await cartApi.addItem({
        productId: product.id,
        variantId: defaultVariant?.id,
        quantity: 1,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      // silently fail
    } finally {
      setAddingToCart(false);
    }
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="h-full"
    >
      <Link
        href={`/produits/${product.slug}`}
        className={cn(
          "group relative flex flex-col h-full rounded-2xl overflow-hidden transition-all duration-300",
          isDark
            ? "bg-gray-900 border border-gray-800 hover:shadow-[0_8px_30px_rgba(40,175,177,0.15)]"
            : "bg-white border border-gray-100 hover:shadow-[0_8px_30px_rgba(40,175,177,0.12)]"
        )}
      >
        {/* Image container */}
        <div className={cn(
          "aspect-square relative overflow-hidden",
          isDark ? "bg-gray-800" : "bg-gray-50"
        )}>
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.alt || product.name}
              className="w-full h-full object-contain p-3 transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className={cn(
              "w-full h-full flex items-center justify-center",
              isDark ? "text-gray-600" : "text-gray-300"
            )}>
              <ImageOff className="w-12 h-12" />
            </div>
          )}

          {/* Bottom gradient overlay */}
          <div className={cn(
            "absolute inset-x-0 bottom-0 h-16 pointer-events-none",
            isDark
              ? "bg-gradient-to-t from-gray-900/60 to-transparent"
              : "bg-gradient-to-t from-white/40 to-transparent"
          )} />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {hasSalePrice && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                Promo
              </span>
            )}
            {isNew && !hasSalePrice && (
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                Nouveau
              </span>
            )}
          </div>

          {!inStock && (
            <span className="absolute top-3 right-3 bg-gray-700 text-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
              Rupture
            </span>
          )}
          {lowStock && (
            <span className="absolute top-3 right-3 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
              Stock limite
            </span>
          )}

          {/* Quick add to cart — visible on hover (desktop), always on mobile */}
          <div className={cn(
            "absolute bottom-3 right-3 transition-all duration-300",
            "opacity-100 translate-y-0",
            "md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0"
          )}>
            <button
              onClick={handleQuickAdd}
              disabled={!inStock || addingToCart}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all duration-200",
                added
                  ? "bg-emerald-500 text-white"
                  : "bg-[#28afb1] text-white hover:bg-[#1f9294] disabled:opacity-40 disabled:cursor-not-allowed"
              )}
              aria-label="Ajouter au panier"
            >
              {added ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : addingToCart ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <ShoppingCart className="w-4.5 h-4.5" />
              )}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1 p-4">
          {/* Brand */}
          {product.brand && (
            <p className="text-[10px] font-semibold text-[#28afb1] uppercase tracking-widest mb-1">
              {product.brand.name}
            </p>
          )}

          {/* Name */}
          <h3 className={cn(
            "text-sm font-medium line-clamp-2 mb-2 leading-snug transition-colors",
            isDark
              ? "text-gray-100 group-hover:text-[#28afb1]"
              : "text-gray-900 group-hover:text-[#28afb1]"
          )}>
            {product.name}
          </h3>

          {/* Stars */}
          <div className="flex items-center gap-0.5 mb-3">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className="w-3.5 h-3.5 text-amber-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>

          {/* Price — pushed to bottom */}
          <div className="mt-auto">
            {hasSalePrice ? (
              <>
                <div className="flex items-baseline gap-2">
                  <p className={cn(
                    "text-lg font-bold",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    {formatPrice(product.salePriceHt!, product.tvaRate)}
                  </p>
                  <p className="text-sm text-gray-400 line-through">
                    {formatPrice(product.priceHt, product.tvaRate)}
                  </p>
                </div>
              </>
            ) : (
              <p className={cn(
                "text-lg font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {formatPrice(product.priceHt, product.tvaRate)}
              </p>
            )}
            <p className={cn(
              "text-xs mt-0.5",
              isDark ? "text-gray-500" : "text-gray-400"
            )}>
              {parseFloat(product.priceHt).toFixed(2)} &euro; HT
            </p>
            {priceTTC >= 300 && (
              <p className="text-xs text-[#28afb1] font-medium mt-1.5">
                ou 3x {(priceTTC / 3).toFixed(2)} &euro; sans frais
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
