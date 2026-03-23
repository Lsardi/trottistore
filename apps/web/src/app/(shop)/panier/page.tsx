"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cartApi, type CartItem } from "@/lib/api";

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
      console.error("Erreur mise à jour panier");
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
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Panier</h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-6xl mb-4">🛒</p>
          <p className="text-lg text-gray-600 mb-6">Votre panier est vide</p>
          <Link
            href="/produits"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-500 transition"
          >
            Voir le catalogue
          </Link>
        </div>
      ) : (
        <>
          {/* Items */}
          <div className="space-y-4 mb-8">
            {items.map((item) => {
              const price = parseFloat(item.product?.priceHt || "0");
              const tva = parseFloat(item.product?.tvaRate || "20");
              const priceTTC = price * (1 + tva / 100);
              const image = item.product?.images?.find((img) => img.isPrimary) || item.product?.images?.[0];

              return (
                <div
                  key={item.productId}
                  className="flex gap-4 bg-white rounded-xl border border-gray-200 p-4"
                >
                  {/* Image */}
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {image ? (
                      <img src={image.url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🛴</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/produits/${item.product?.slug}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
                    >
                      {item.product?.name || "Produit"}
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">{formatPrice(priceTTC)} / unité</p>
                  </div>

                  {/* Quantité */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>

                  {/* Total ligne */}
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatPrice(priceTTC * item.quantity)}</p>
                    <button
                      onClick={() => updateQuantity(item.productId, 0)}
                      className="text-xs text-red-500 hover:text-red-700 mt-1"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Résumé */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Sous-total TTC</span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between mb-4">
              <span className="text-gray-600">Livraison</span>
              <span className="text-sm text-gray-500">Calculée à l&apos;étape suivante</span>
            </div>
            <div className="border-t pt-4 flex justify-between">
              <span className="text-lg font-bold">Total estimé</span>
              <span className="text-lg font-bold">{formatPrice(subtotal)}</span>
            </div>

            {subtotal >= 300 && (
              <p className="text-sm text-green-600 mt-3 text-center font-medium">
                ✓ Éligible au paiement en 2x, 3x ou 4x sans frais
              </p>
            )}

            <div className="mt-6 space-y-3">
              <Link
                href="/mon-compte"
                className="block w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-center hover:bg-blue-500 transition"
              >
                Passer commande
              </Link>
              <button
                onClick={clearCart}
                className="block w-full text-sm text-gray-500 hover:text-red-600 text-center"
              >
                Vider le panier
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
