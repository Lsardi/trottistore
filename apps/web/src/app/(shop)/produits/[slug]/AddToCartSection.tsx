"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { cartApi } from "@/lib/api";

export default function AddToCartSection({
  productId,
  variantId,
}: {
  productId: string;
  variantId?: string;
}) {
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [cartSuccess, setCartSuccess] = useState(false);

  async function handleAddToCart() {
    setAddingToCart(true);
    try {
      await cartApi.addItem({
        productId,
        variantId,
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
      setCartSuccess(false);
      setCartMessage("Erreur lors de l'ajout au panier");
      setTimeout(() => setCartMessage(""), 3000);
    } finally {
      setAddingToCart(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <span className="spec-label">QTÉ</span>
        <div className="flex items-center" style={{ border: "1px solid var(--color-border)" }}>
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-10 h-10 flex items-center justify-center transition-colors"
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              borderRight: "1px solid var(--color-border)",
            }}
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
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              borderLeft: "1px solid var(--color-border)",
            }}
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
        {cartSuccess ? "AJOUTÉ AU PANIER" : addingToCart ? "AJOUT EN COURS..." : "AJOUTER AU PANIER"}
      </button>

      <p className="font-mono text-xs text-text-muted mt-3">
        Droit de rétractation de 14 jours et garantie légale de conformité de 2 ans.{" "}
        <Link href="/cgv" className="underline text-text">
          Voir les CGV
        </Link>
        .
      </p>

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
    </>
  );
}
