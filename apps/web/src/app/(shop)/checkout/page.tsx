"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { ApiError, authApi, cartApi, checkoutApi, ordersApi, type CartItem, type User } from "@/lib/api";

const PAYMENT_METHODS = [
  { value: "CARD", label: "Carte bancaire (Stripe)" },
  { value: "APPLE_PAY", label: "Apple Pay (Stripe)" },
  { value: "GOOGLE_PAY", label: "Google Pay (Stripe)" },
  { value: "LINK", label: "Link (Stripe)" },
  { value: "INSTALLMENT_3X", label: "Paiement en 3x sans frais" },
  { value: "BANK_TRANSFER", label: "Virement bancaire" },
] as const;

const DELIVERY_MODES = [
  { value: "STANDARD", label: "Livraison standard" },
  { value: "PICKUP_1H", label: "Retrait boutique en 1h" },
] as const;

type StripePaymentMethod = "CARD" | "APPLE_PAY" | "GOOGLE_PAY" | "LINK";

function isStripePaymentMethod(method: (typeof PAYMENT_METHODS)[number]["value"]): method is StripePaymentMethod {
  return method === "CARD" || method === "APPLE_PAY" || method === "GOOGLE_PAY" || method === "LINK";
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

interface StripeConfirmationFormProps {
  orderId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

function StripeConfirmationForm({ orderId, onSuccess, onError }: StripeConfirmationFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setConfirming(true);
    onError("");

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/mon-compte?commande=${orderId}`,
      },
      redirect: "if_required",
    });

    setConfirming(false);

    if (result.error) {
      onError(result.error.message || "Le paiement a échoué.");
      return;
    }

    if (result.paymentIntent?.status === "succeeded" || result.paymentIntent?.status === "processing") {
      onSuccess();
      return;
    }

    onError("Paiement en attente. Vérifie ton historique de commande.");
  }

  return (
    <form onSubmit={handleConfirm} className="space-y-4">
      <PaymentElement />
      <button type="submit" disabled={confirming || !stripe || !elements} className="btn-neon w-full disabled:opacity-50">
        {confirming ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            CONFIRMATION...
          </>
        ) : (
          "PAYER MAINTENANT"
        )}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [billingAddressId, setBillingAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["value"]>("CARD");
  const [deliveryMode, setDeliveryMode] = useState<(typeof DELIVERY_MODES)[number]["value"]>("STANDARD");
  const [notes, setNotes] = useState("");
  const [acceptedCgv, setAcceptedCgv] = useState(false);
  const [error, setError] = useState("");
  const [successOrderId, setSuccessOrderId] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(null);
  const [pendingStripeCheckout, setPendingStripeCheckout] = useState<{
    orderId: string;
    clientSecret: string;
  } | null>(null);

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

        const stripeConfig = await checkoutApi.config().catch(() => null);
        if (stripeConfig?.success) {
          setStripePublishableKey(stripeConfig.data.publishableKey);
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

  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
    [stripePublishableKey],
  );

  const stripeElementsOptions = useMemo<StripeElementsOptions | undefined>(
    () =>
      pendingStripeCheckout
        ? {
            clientSecret: pendingStripeCheckout.clientSecret,
            appearance: {
              theme: "night",
            },
          }
        : undefined,
    [pendingStripeCheckout],
  );

  const shippingMethod = deliveryMode === "PICKUP_1H" ? "STORE_PICKUP" : "DELIVERY";
  const isStripeFlow = isStripePaymentMethod(paymentMethod);
  const stripeAvailable = Boolean(stripePublishableKey && stripePromise);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shippingAddressId) {
      setError("Sélectionne une adresse de livraison.");
      return;
    }
    if (!acceptedCgv) {
      setError("Tu dois accepter les conditions generales de vente.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const normalizedNotes = [
        deliveryMode === "PICKUP_1H" ? "[RETRAIT_1H] Client souhaite retrait boutique sous 1h." : null,
        notes || null,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 1000);

      const orderRes = await ordersApi.create({
        shippingAddressId,
        billingAddressId: billingAddressId || undefined,
        paymentMethod,
        notes: normalizedNotes || undefined,
        shippingMethod,
      });

      if (isStripeFlow && stripeAvailable) {
        const paymentIntentRes = await checkoutApi.createPaymentIntent({
          orderId: orderRes.data.id,
          paymentMethod,
          shippingMethod,
        });

        setPendingStripeCheckout({
          orderId: orderRes.data.id,
          clientSecret: paymentIntentRes.data.clientSecret,
        });
        return;
      }

      setSuccessOrderId(orderRes.data.id);
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
            <select value={billingAddressId} onChange={(e) => setBillingAddressId(e.target.value)} className="input-dark w-full">
              <option value="">Identique à la livraison</option>
              {user?.addresses?.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.label || `${address.firstName} ${address.lastName}`} — {address.street}, {address.postalCode} {address.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="spec-label mb-2">Mode de retrait</p>
            <select
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as (typeof DELIVERY_MODES)[number]["value"])}
              className="input-dark w-full"
            >
              {DELIVERY_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
            {deliveryMode === "PICKUP_1H" ? (
              <p className="font-mono text-xs text-neon mt-2">
                Retrait express sélectionné: une confirmation sera envoyée dès que la commande est prête.
              </p>
            ) : null}
          </div>

          <div>
            <p className="spec-label mb-2">Paiement</p>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value as (typeof PAYMENT_METHODS)[number]["value"]);
                setPendingStripeCheckout(null);
              }}
              className="input-dark w-full"
              disabled={Boolean(pendingStripeCheckout)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            <p className="font-mono text-xs mt-2 text-text-dim">
              {isStripeFlow
                ? stripeAvailable
                  ? "Paiement Stripe prêt (mode test)."
                  : "Stripe non disponible, fallback sur flux standard."
                : "Méthode hors Stripe: la commande sera finalisée immédiatement."}
            </p>
          </div>

          <div>
            <p className="spec-label mb-2">Notes (optionnel)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-dark w-full min-h-24"
              placeholder="Instruction de livraison ou remarque"
              disabled={Boolean(pendingStripeCheckout)}
            />
          </div>

          {pendingStripeCheckout && stripePromise && stripeElementsOptions ? (
            <div className="space-y-3 border border-border p-4">
              <p className="spec-label">Paiement sécurisé Stripe</p>
              <Elements stripe={stripePromise} options={stripeElementsOptions}>
                <StripeConfirmationForm
                  orderId={pendingStripeCheckout.orderId}
                  onSuccess={() => {
                    setSuccessOrderId(pendingStripeCheckout.orderId);
                    setItems([]);
                  }}
                  onError={(message) => setError(message)}
                />
              </Elements>
              <button
                type="button"
                className="font-mono text-xs text-text-muted underline"
                onClick={() => setPendingStripeCheckout(null)}
              >
                Changer de mode de paiement
              </button>
            </div>
          ) : null}

          {!pendingStripeCheckout ? (
            <label className="flex items-start gap-2 font-mono text-xs text-text-muted">
              <input
                type="checkbox"
                checked={acceptedCgv}
                onChange={(e) => setAcceptedCgv(e.target.checked)}
                className="mt-0.5"
                required
              />
              <span>
                J&apos;accepte les{" "}
                <Link href="/cgv" className="underline text-text">
                  conditions générales de vente
                </Link>
                .
              </span>
            </label>
          ) : null}

          {error && <div className="border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-sm text-danger">{error}</div>}

          {!pendingStripeCheckout ? (
            <button type="submit" disabled={submitting || items.length === 0} className="btn-neon w-full disabled:opacity-50">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  VALIDATION...
                </>
              ) : isStripeFlow && stripeAvailable ? (
                "CONTINUER VERS PAIEMENT"
              ) : (
                "PASSER LA COMMANDE"
              )}
            </button>
          ) : null}
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
            <span className="price-main" style={{ fontSize: "1.4rem" }}>
              {formatPrice(totalTtc)}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
