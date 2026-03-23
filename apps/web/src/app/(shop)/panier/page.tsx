"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  ArrowRight,
  ImageOff,
  CreditCard,
  Loader2,
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
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-48" />
          <div className="h-28 bg-gray-100 rounded-2xl" />
          <div className="h-28 bg-gray-100 rounded-2xl" />
          <div className="h-48 bg-gray-100 rounded-2xl mt-6" />
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
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">Panier</h1>

      {items.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <ShoppingCart className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-lg font-medium text-gray-900 mb-2">Votre panier est vide</p>
          <p className="text-sm text-gray-500 mb-8">
            Decouvrez nos produits et ajoutez-les a votre panier
          </p>
          <Link
            href="/produits"
            className="inline-flex items-center gap-2 bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors"
          >
            Voir le catalogue
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const price = parseFloat(item.product?.priceHt || "0");
              const tva = parseFloat(item.product?.tvaRate || "20");
              const priceTTC = price * (1 + tva / 100);
              const image =
                item.product?.images?.find((img) => img.isPrimary) || item.product?.images?.[0];

              return (
                <div
                  key={item.productId}
                  className="flex gap-4 bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm"
                >
                  {/* Image */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                    {image ? (
                      <img src={image.url} alt="" className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/produits/${item.product?.slug}`}
                      className="text-sm font-medium text-gray-900 hover:text-teal-600 line-clamp-2 transition-colors"
                    >
                      {item.product?.name || "Produit"}
                    </Link>
                    <p className="text-sm text-gray-400 mt-1">
                      {formatPrice(priceTTC)} / unite
                    </p>

                    {/* Quantity controls + total (mobile stacks, desktop inline) */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updateQuantity(item.productId, 0)}
                          className="ml-2 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="font-semibold text-gray-900">
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
            <div className="sticky top-24 bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recapitulatif</h2>

              <div className="space-y-3 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sous-total TTC</span>
                  <span className="font-semibold text-gray-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Livraison</span>
                  <span className="text-gray-400 text-xs">Calculee a l&apos;etape suivante</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 flex justify-between mb-4">
                <span className="text-lg font-bold text-gray-900">Total estime</span>
                <span className="text-lg font-bold text-gray-900">{formatPrice(subtotal)}</span>
              </div>

              {subtotal >= 300 && (
                <div className="bg-teal-50 border border-teal-100 text-teal-700 text-sm px-4 py-3 rounded-xl mb-6 flex items-start gap-2">
                  <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Eligible au paiement en 2x, 3x ou 4x sans frais</span>
                </div>
              )}

              <div className="space-y-3">
                <Link
                  href="/mon-compte"
                  className="flex items-center justify-center gap-2 w-full bg-teal-500 text-white py-3.5 rounded-xl font-semibold hover:bg-teal-600 transition-colors shadow-lg shadow-teal-500/20"
                >
                  Passer commande
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={clearCart}
                  className="w-full text-sm text-gray-400 hover:text-red-500 text-center py-2 transition-colors"
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
