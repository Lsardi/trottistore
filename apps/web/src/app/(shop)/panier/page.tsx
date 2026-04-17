"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart,
  Minus,
  Plus,
  ArrowRight,
  ArrowLeft,
  ImageOff,
  X,
  Shield,
  Truck,
  RotateCcw,
  CreditCard,
} from "lucide-react";
import { cartApi, type CartItem, type CartDiscount } from "@/lib/api";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [discount, setDiscount] = useState<CartDiscount | null>(null);
  const [code, setCode] = useState("");
  const [applyingCode, setApplyingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await cartApi.get();
        setItems(res.data.items || []);
        setDiscount(res.data.discount ?? null);
      } catch {
        // Panier vide ou erreur
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function applyDiscountCode() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setApplyingCode(true);
    setCodeError(null);
    try {
      const res = await cartApi.applyDiscount(trimmed);
      setDiscount(res.data.discount);
      setCode("");
    } catch (err) {
      const msg =
        err && typeof err === "object" && "data" in err
          ? ((err as { data?: { error?: { message?: string } } }).data?.error?.message ?? "Code invalide")
          : "Code invalide";
      setCodeError(msg);
    } finally {
      setApplyingCode(false);
    }
  }

  async function removeDiscountCode() {
    try {
      await cartApi.removeDiscount();
      setDiscount(null);
      setCodeError(null);
    } catch {
      /* ignore */
    }
  }

  async function updateQuantity(productId: string, quantity: number) {
    try {
      if (quantity <= 0) {
        const res = await cartApi.removeItem(productId);
        setItems(res.data.items || []);
        window.dispatchEvent(new Event("trottistore:cart-updated"));
      } else {
        const res = await cartApi.updateItem(productId, { quantity });
        setItems(res.data.items || []);
        window.dispatchEvent(new Event("trottistore:cart-updated"));
      }
    } catch {
      console.error("Erreur mise a jour panier");
    }
  }

  async function clearCart() {
    try {
      await cartApi.clear();
      setItems([]);
      window.dispatchEvent(new Event("trottistore:cart-updated"));
    } catch {
      console.error("Erreur vidange panier");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-void">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="h-10 w-48 animate-pulse bg-surface mb-2" />
          <div className="h-4 w-32 animate-pulse bg-surface mb-6" />
          <div className="divider-neon mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse bg-surface border border-border" />
              ))}
            </div>
            <div className="h-64 animate-pulse bg-surface border border-border" />
          </div>
        </div>
      </div>
    );
  }

  const subtotal = items.reduce((sum, item) => {
    return sum + item.lineTotalHt * 1.2;
  }, 0);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-void">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-2">
          <h1 className="heading-lg">PANIER</h1>
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" style={{ color: "var(--color-neon)" }} />
              <span
                className="font-display font-bold text-lg tabular-nums"
                style={{ color: "var(--color-neon)" }}
              >
                {itemCount}
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-text-dim">
                article{itemCount > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
        <div className="divider-neon mb-8" />

        {items.length === 0 ? (
          /* Empty cart state */
          <div className="text-center py-20">
            <div
              className="w-24 h-24 mx-auto mb-8 flex items-center justify-center"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <ShoppingCart className="w-10 h-10" style={{ color: "var(--color-text-dim)" }} />
            </div>
            <p className="heading-lg mb-3">PANIER VIDE</p>
            <p className="font-mono text-sm mb-10" style={{ color: "var(--color-text-muted)" }}>
              Aucun article dans votre panier pour le moment
            </p>
            <Link
              href="/produits"
              className="cursor-pointer btn-neon inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              DECOUVRIR LE CATALOGUE
            </Link>

            {/* Reassurance strip even when empty */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
              {[
                { icon: CreditCard, label: "Paiement securise" },
                { icon: Truck, label: "Livraison rapide" },
                { icon: RotateCcw, label: "Retour 14 jours" },
                { icon: Shield, label: "Garantie 2 ans" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 py-4 px-3"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <Icon style={{ width: 18, height: 18, color: "var(--color-neon)" }} />
                  <span className="font-mono text-text-muted text-center" style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart items */}
            <div className="lg:col-span-2 space-y-3">
              {items.map((item) => {
                const priceTTC = item.unitPriceHt * 1.2;
                const image = item.product?.image;

                return (
                  <div
                    key={item.productId}
                    className="flex gap-4 p-4 sm:p-5 transition-all duration-200"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {/* Product image */}
                    <Link
                      href={`/produits/${item.product?.slug}`}
                      className="cursor-pointer w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0 relative overflow-hidden"
                      style={{
                        backgroundColor: "var(--color-void)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {image ? (
                        <Image
                          src={image.url}
                          alt={image.alt || item.product?.name || "Produit"}
                          fill
                          sizes="112px"
                          style={{ objectFit: "contain", padding: "4px" }}
                        />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center">
                          <ImageOff className="w-8 h-8 text-text-dim" />
                        </span>
                      )}
                    </Link>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/produits/${item.product?.slug}`}
                            className="cursor-pointer text-sm font-display font-bold text-text hover:text-neon line-clamp-2 transition-colors duration-200"
                          >
                            {item.product?.name || "Produit"}
                          </Link>
                          <p className="font-mono text-xs mt-1" style={{ color: "var(--color-text-dim)" }}>
                            {formatPrice(priceTTC)} / unite
                          </p>
                        </div>
                        <button
                          onClick={() => updateQuantity(item.productId, 0)}
                          className="cursor-pointer flex-shrink-0 w-8 h-8 flex items-center justify-center text-text-dim hover:text-danger transition-colors duration-200"
                          aria-label="Supprimer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quantity + line total */}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="cursor-pointer w-9 h-9 flex items-center justify-center text-text-muted hover:border-neon hover:text-neon transition-colors duration-200"
                            style={{ border: "1px solid var(--color-border)" }}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span
                            className="w-10 h-9 flex items-center justify-center font-mono text-sm font-bold text-text"
                            style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="cursor-pointer w-9 h-9 flex items-center justify-center text-text-muted hover:border-neon hover:text-neon transition-colors duration-200"
                            style={{ border: "1px solid var(--color-border)" }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p
                          className="font-display font-bold text-lg"
                          style={{ color: "var(--color-neon)" }}
                        >
                          {formatPrice(priceTTC * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Continue shopping link */}
              <div className="pt-4">
                <Link
                  href="/produits"
                  className="cursor-pointer btn-outline inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  CONTINUER LES ACHATS
                </Link>
              </div>
            </div>

            {/* Order summary sidebar */}
            <div className="lg:col-span-1">
              <div
                className="sticky top-24 p-6"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h2 className="spec-label mb-5">RECAPITULATIF</h2>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-text-muted">
                      Sous-total ({itemCount} article{itemCount > 1 ? "s" : ""})
                    </span>
                    <span className="text-text font-bold">{formatPrice(subtotal)}</span>
                  </div>
                  {discount ? (
                    <div className="flex justify-between font-mono text-sm">
                      <span className="text-text-muted">
                        Code{" "}
                        <span className="text-neon font-bold">{discount.code}</span>
                        {discount.kind === "PERCENT" ? ` (-${discount.value}%)` : ""}
                      </span>
                      <span className="text-neon">&minus;{formatPrice(discount.amount * 1.2)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between font-mono text-sm">
                    <span className="text-text-muted">Livraison</span>
                    <span className="text-text-dim text-xs">Calculee a l&apos;etape suivante</span>
                  </div>
                </div>

                {/* Discount code input */}
                <div className="mb-4">
                  {discount ? (
                    <div
                      className="flex items-center justify-between px-3 py-2"
                      style={{
                        backgroundColor: "var(--color-neon-dim)",
                        border: "1px solid rgba(0, 255, 209, 0.3)",
                      }}
                    >
                      <p className="font-mono text-xs text-neon">
                        Code <strong>{discount.code}</strong> applique
                      </p>
                      <button
                        type="button"
                        onClick={() => void removeDiscountCode()}
                        className="cursor-pointer font-mono text-[11px] text-neon hover:text-text transition-colors duration-200"
                        aria-label="Retirer le code"
                      >
                        Retirer
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-0">
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => {
                            setCode(e.target.value.toUpperCase());
                            if (codeError) setCodeError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void applyDiscountCode();
                            }
                          }}
                          placeholder="Code promo"
                          className="input-dark flex-1 font-mono tracking-widest text-xs uppercase"
                          disabled={applyingCode}
                        />
                        <button
                          type="button"
                          onClick={() => void applyDiscountCode()}
                          disabled={applyingCode || !code.trim()}
                          className="cursor-pointer btn-outline px-3 disabled:opacity-60"
                          style={{ borderLeft: "none" }}
                        >
                          Appliquer
                        </button>
                      </div>
                      {codeError ? (
                        <p className="font-mono text-[11px] text-danger mt-1" role="alert">
                          {codeError}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="divider mb-4" />

                {/* Total with neon accent */}
                <div className="flex justify-between items-center mb-6">
                  <span className="font-mono text-sm text-text-muted">Total estime</span>
                  <span
                    className="font-display font-extrabold text-2xl"
                    style={{
                      color: "var(--color-neon)",
                      textShadow: "0 0 20px rgba(0, 255, 209, 0.3)",
                    }}
                  >
                    {formatPrice(discount ? Math.max(0, subtotal - discount.amount * 1.2) : subtotal)}
                  </span>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/checkout"
                    className="cursor-pointer btn-neon w-full"
                  >
                    PASSER LA COMMANDE
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={clearCart}
                    className="cursor-pointer w-full font-mono text-xs text-text-dim hover:text-danger text-center py-2 transition-colors duration-200"
                  >
                    Vider le panier
                  </button>
                </div>

                {/* Reassurance in sidebar */}
                <div className="divider mt-5 mb-4" />
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: CreditCard, label: "Paiement securise" },
                    { icon: Truck, label: "Livraison rapide" },
                    { icon: RotateCcw, label: "Retour 14 jours" },
                    { icon: Shield, label: "Garantie 2 ans" },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 px-2 py-2"
                      style={{
                        backgroundColor: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <Icon style={{ width: 12, height: 12, color: "var(--color-neon)", flexShrink: 0 }} />
                      <span className="font-mono text-text-muted" style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
