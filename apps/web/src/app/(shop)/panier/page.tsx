"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  ArrowRight,
  ImageOff,
  CreditCard,
  Loader2,
  X,
} from "lucide-react";
import { cartApi, type CartItem } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await cartApi.get();
        setItems(res.data || []);
      } catch {
        // Panier vide ou erreur
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function updateQuantity(productId: string, quantity: number) {
    try {
      if (quantity <= 0) {
        await cartApi.removeItem(productId);
        setItems((prev) => prev.filter((item) => item.productId !== productId));
      } else {
        const res = await cartApi.updateItem(productId, { quantity });
        setItems(res.data || []);
      }
    } catch {
      console.error("Erreur mise a jour panier");
    }
  }

  async function clearCart() {
    try {
      await cartApi.clear();
      setItems([]);
    } catch {
      console.error("Erreur vidange panier");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          <div className="h-8 bg-surface w-48" />
          <div className="h-28 bg-surface" />
          <div className="h-28 bg-surface" />
          <div className="h-48 bg-surface mt-6" />
        </div>
      </div>
    );
  }

  const subtotal = items.reduce((sum, item) => {
    const price = parseFloat(item.product?.priceHt || "0");
    const tva = parseFloat(item.product?.tvaRate || "20");
    return sum + price * (1 + tva / 100) * item.quantity;
  }, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <h1 className="heading-lg mb-8">PANIER</h1>

      {items.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-20 h-20 mx-auto mb-6 bg-surface border border-border flex items-center justify-center">
            <ShoppingCart className="w-10 h-10 text-text-dim" />
          </div>
          <p className="heading-lg mb-2">PANIER VIDE</p>
          <p className="font-mono text-sm text-text-muted mb-8">
            Aucun article dans votre panier
          </p>
          <Link
            href="/produits"
            className="font-mono text-sm text-neon hover:underline"
          >
            Decouvrez notre catalogue &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => {
              const price = parseFloat(item.product?.priceHt || "0");
              const tva = parseFloat(item.product?.tvaRate || "20");
              const priceTTC = price * (1 + tva / 100);
              const image =
                item.product?.images?.find((img) => img.isPrimary) || item.product?.images?.[0];

              return (
                <div
                  key={item.productId}
                  className="flex gap-4 bg-surface border border-border p-4 sm:p-5"
                >
                  {/* Image */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-void border border-border overflow-hidden flex-shrink-0 relative">
                    {image ? (
                      <Image src={image.url} alt={image.alt || item.product?.name || "Produit"} fill sizes="96px" style={{ objectFit: "contain", padding: "4px" }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="w-8 h-8 text-text-dim" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/produits/${item.product?.slug}`}
                      className="text-sm font-medium text-text hover:text-neon line-clamp-2 transition-colors"
                    >
                      {item.product?.name || "Produit"}
                    </Link>
                    <p className="font-mono text-xs text-text-dim mt-1">
                      {formatPrice(priceTTC)} / unite
                    </p>

                    {/* Quantity controls + total */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-8 h-8 border border-border flex items-center justify-center text-text-muted hover:border-neon hover:text-neon transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center font-mono text-sm font-bold text-text">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-8 h-8 border border-border flex items-center justify-center text-text-muted hover:border-neon hover:text-neon transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updateQuantity(item.productId, 0)}
                          className="ml-2 w-8 h-8 flex items-center justify-center text-text-dim hover:text-danger transition-colors"
                          aria-label="Supprimer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="font-mono font-bold text-neon">
                        {formatPrice(priceTTC * item.quantity)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-surface border border-border p-6">
              <h2 className="spec-label mb-4">RECAPITULATIF</h2>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between font-mono text-sm">
                  <span className="text-text-muted">Sous-total TTC</span>
                  <span className="text-text">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between font-mono text-sm">
                  <span className="text-text-muted">Livraison</span>
                  <span className="text-text-dim text-xs">Calculee a l&apos;etape suivante</span>
                </div>
              </div>

              <div className="divider mb-4" />

              <div className="flex justify-between items-center mb-6">
                <span className="font-mono text-sm text-text-muted">Total estime</span>
                <span className="price-main">{formatPrice(subtotal)}</span>
              </div>

              {subtotal >= 300 && (
                <div className="bg-neon-dim border border-border text-neon text-xs font-mono px-4 py-3 mb-6 flex items-start gap-2">
                  <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Eligible au paiement en 2x, 3x ou 4x sans frais</span>
                </div>
              )}

              <div className="space-y-3">
                <Link
                  href="/mon-compte"
                  className="btn-neon w-full"
                >
                  COMMANDER
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={clearCart}
                  className="w-full font-mono text-xs text-text-dim hover:text-danger text-center py-2 transition-colors"
                >
                  Vider le panier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
