"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ApiError, authApi, cartApi, ordersApi, type CartItem, type User } from "@/lib/api";

const PAYMENT_METHODS = [
  { value: "APPLE_PAY", label: "Apple Pay" },
  { value: "GOOGLE_PAY", label: "Google Pay" },
  { value: "CARD", label: "Carte bancaire" },
  { value: "INSTALLMENT_3X", label: "Paiement en 3x sans frais" },
  { value: "BANK_TRANSFER", label: "Virement bancaire" },
] as const;

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

export default function CheckoutPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [billingAddressId, setBillingAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["value"]>("APPLE_PAY");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [successOrderId, setSuccessOrderId] = useState("");

  useEffect(() => {
    async function loadCheckout() {
      try {
        const [cartRes, meRes] = await Promise.all([cartApi.get(), authApi.me()]);
        setItems(cartRes.data.items);
        setUser(meRes.data);
        const defaultAddress = meRes.data.addresses?.find((a) => a.isDefault) ?? meRes.data.addresses?.[0];
        if (defaultAddress) {
          setShippingAddressId(defaultAddress.id);
          setBillingAddressId(defaultAddress.id);
        }
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 500;
        if (status === 401) {
          window.location.href = "/mon-compte?next=/checkout";
          return;
        }
        setError("Impossible de charger le checkout.");
      } finally {
        setLoading(false);
      }
    }

    loadCheckout();
  }, []);

  const totalTtc = useMemo(() => items.reduce((sum, item) => sum + item.lineTotalHt * 1.2, 0), [items]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shippingAddressId) {
      setError("Sélectionne une adresse de livraison.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await ordersApi.create({
        shippingAddressId,
        billingAddressId: billingAddressId || undefined,
        paymentMethod,
        notes: notes || undefined,
      });
      setSuccessOrderId(res.data.id);
      setItems([]);
    } catch (err) {
      if (err instanceof ApiError) {
        const payload = err.data as { error?: { message?: string } } | null;
        setError(payload?.error?.message || "La commande a échoué.");
      } else {
        setError("La commande a échoué.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 w-64 bg-surface animate-pulse mb-6" />
        <div className="h-64 bg-surface animate-pulse" />
      </div>
    );
  }

  if (successOrderId) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="spec-label mb-3">COMMANDE VALIDEE</p>
        <h1 className="heading-lg mb-4">Merci, votre commande est enregistrée</h1>
        <p className="font-mono text-sm text-text-muted mb-8">Référence: {successOrderId}</p>
        <Link href="/mon-compte" className="btn-neon">
          VOIR MON COMPTE
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <Link href="/panier" className="font-mono text-xs uppercase tracking-wider text-text-muted inline-flex items-center gap-2 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Retour panier
      </Link>
      <h1 className="heading-lg mb-8">CHECKOUT</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-surface border border-border p-6 space-y-5">
          <div>
            <p className="spec-label mb-2">Adresse de livraison</p>
            <select
              value={shippingAddressId}
              onChange={(e) => setShippingAddressId(e.target.value)}
              className="input-dark w-full"
              required
            >
              <option value="">Sélectionner une adresse</option>
              {user?.addresses?.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.label || `${address.firstName} ${address.lastName}`} — {address.street}, {address.postalCode} {address.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="spec-label mb-2">Adresse de facturation</p>
            <select
              value={billingAddressId}
              onChange={(e) => setBillingAddressId(e.target.value)}
              className="input-dark w-full"
            >
              <option value="">Identique à la livraison</option>
              {user?.addresses?.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.label || `${address.firstName} ${address.lastName}`} — {address.street}, {address.postalCode} {address.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="spec-label mb-2">Paiement</p>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as (typeof PAYMENT_METHODS)[number]["value"])}
              className="input-dark w-full"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="spec-label mb-2">Notes (optionnel)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-dark w-full min-h-24"
              placeholder="Instruction de livraison ou remarque"
            />
          </div>

          {error && (
            <div className="border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-sm text-danger">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting || items.length === 0} className="btn-neon w-full disabled:opacity-50">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                VALIDATION...
              </>
            ) : (
              "PASSER LA COMMANDE"
            )}
          </button>
        </form>

        <aside className="bg-surface border border-border p-6 h-fit sticky top-24">
          <p className="spec-label mb-4">Récapitulatif</p>
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantId ?? "default"}`} className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-text">{item.product.name}</p>
                  <p className="font-mono text-[11px] text-text-dim">x{item.quantity}</p>
                </div>
                <p className="font-mono text-xs text-text">{formatPrice(item.lineTotalHt * 1.2)}</p>
              </div>
            ))}
          </div>
          <div className="divider mb-3" />
          <div className="flex justify-between items-center">
            <span className="font-mono text-sm text-text-muted">Total TTC</span>
            <span className="price-main" style={{ fontSize: "1.4rem" }}>{formatPrice(totalTtc)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
