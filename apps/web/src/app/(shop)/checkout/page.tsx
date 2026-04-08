"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { ApiError, addressesApi, authApi, cartApi, checkoutApi, ordersApi, type CartItem, type User } from "@/lib/api";

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

    onError("Paiement en attente. Vérifiez votre historique de commande.");
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
  const [isGuest, setIsGuest] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [showInlineAddressForm, setShowInlineAddressForm] = useState(false);
  const [creatingAddress, setCreatingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [inlineAddress, setInlineAddress] = useState({
    firstName: "",
    lastName: "",
    street: "",
    street2: "",
    postalCode: "",
    city: "",
    country: "FR",
    phone: "",
    label: "Livraison",
  });

  useEffect(() => {
    async function loadCheckout() {
      try {
        const cartRes = await cartApi.get();
        setItems(cartRes.data.items);

        // Try to get user — if 401, switch to guest mode
        try {
          const meRes = await authApi.me();
          setUser(meRes.data);
          setInlineAddress((prev) => ({
            ...prev,
            firstName: meRes.data.firstName || prev.firstName,
            lastName: meRes.data.lastName || prev.lastName,
            phone: meRes.data.phone || prev.phone,
          }));

          const defaultAddress = meRes.data.addresses?.find((a) => a.isDefault) ?? meRes.data.addresses?.[0];
          if (defaultAddress) {
            setShippingAddressId(defaultAddress.id);
            setBillingAddressId(defaultAddress.id);
          } else {
            setShowInlineAddressForm(true);
          }
        } catch (authErr) {
          // Not authenticated — enable guest checkout
          setIsGuest(true);
          setShowInlineAddressForm(true);
        }

        const stripeConfig = await checkoutApi.config().catch(() => null);
        if (stripeConfig?.success) {
          setStripePublishableKey(stripeConfig.data.publishableKey);
        }
      } catch (err) {
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
  const hasAddresses = (user?.addresses?.length ?? 0) > 0;

  function normalizeCountryCode(rawCountry: string): string {
    const value = rawCountry.trim().toUpperCase();
    if (!value) return "FR";
    if (value === "FRANCE") return "FR";
    if (value.length === 2) return value;
    return "FR";
  }

  async function createInlineAddress(): Promise<string | null> {
    const requiredFields: Array<keyof typeof inlineAddress> = ["firstName", "lastName", "street", "postalCode", "city"];
    const missingRequiredField = requiredFields.some((field) => !inlineAddress[field].trim());
    if (missingRequiredField) {
      setAddressError("Renseigne prénom, nom, rue, code postal et ville.");
      return null;
    }

    setCreatingAddress(true);
    setAddressError("");

    try {
      const res = await addressesApi.create({
        firstName: inlineAddress.firstName.trim(),
        lastName: inlineAddress.lastName.trim(),
        street: inlineAddress.street.trim(),
        street2: inlineAddress.street2.trim() || undefined,
        postalCode: inlineAddress.postalCode.trim(),
        city: inlineAddress.city.trim(),
        country: normalizeCountryCode(inlineAddress.country),
        phone: inlineAddress.phone.trim() || undefined,
        label: inlineAddress.label.trim() || "Livraison",
        type: "SHIPPING",
        isDefault: !hasAddresses,
      });

      const createdAddress = res.data;
      setUser((prev) =>
        prev
          ? {
              ...prev,
              addresses: [...(prev.addresses ?? []), createdAddress],
            }
          : prev,
      );
      setShippingAddressId(createdAddress.id);
      setBillingAddressId(createdAddress.id);
      setShowInlineAddressForm(false);

      return createdAddress.id;
    } catch {
      setAddressError("Impossible d'enregistrer l'adresse. Réessaie.");
      return null;
    } finally {
      setCreatingAddress(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedCgv) {
      setError("Veuillez accepter les conditions générales de vente.");
      return;
    }
    setSubmitting(true);
    setError("");
    let selectedShippingAddressId = shippingAddressId;

    try {
      const normalizedNotes = [
        deliveryMode === "PICKUP_1H" ? "[RETRAIT_1H] Client souhaite retrait boutique sous 1h." : null,
        notes || null,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 1000);

      let orderRes;

      if (isGuest) {
        // Guest checkout — send address inline
        if (!inlineAddress.firstName || !inlineAddress.lastName || !inlineAddress.street || !inlineAddress.postalCode || !inlineAddress.city) {
          setError("Veuillez remplir tous les champs obligatoires de l'adresse.");
          return;
        }
        if (!guestEmail) {
          setError("Veuillez saisir votre adresse email.");
          return;
        }

        orderRes = await fetch("/api/v1/orders/guest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-id": localStorage.getItem("sessionId") || "",
          },
          body: JSON.stringify({
            email: guestEmail,
            shippingAddress: {
              firstName: inlineAddress.firstName,
              lastName: inlineAddress.lastName,
              street: inlineAddress.street,
              street2: inlineAddress.street2 || undefined,
              postalCode: inlineAddress.postalCode,
              city: inlineAddress.city,
              country: inlineAddress.country || "FR",
              phone: inlineAddress.phone || undefined,
            },
            paymentMethod,
            shippingMethod,
            notes: normalizedNotes || undefined,
            acceptedCgv: true,
          }),
        }).then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.error?.message || "Erreur lors de la commande");
          return data;
        });
      } else {
        // Authenticated checkout
        if (!selectedShippingAddressId && showInlineAddressForm) {
          const createdAddressId = await createInlineAddress();
          if (!createdAddressId) {
            return;
          }
          selectedShippingAddressId = createdAddressId;
        }

        if (!selectedShippingAddressId) {
          setError("Sélectionnez une adresse de livraison.");
          return;
        }

        orderRes = await ordersApi.create({
          shippingAddressId: selectedShippingAddressId,
          billingAddressId: billingAddressId || undefined,
          paymentMethod,
          notes: normalizedNotes || undefined,
          shippingMethod,
          acceptedCgv: true,
        });
      }

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
          {isGuest && (
            <div>
              <p className="spec-label mb-2">Votre email</p>
              <input
                type="email"
                required
                placeholder="votre@email.fr"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="input-dark w-full"
              />
              <p className="font-mono text-xs text-text-dim mt-1">
                Vous recevrez la confirmation de commande à cette adresse.
                <Link href="/mon-compte?next=/checkout" className="text-neon ml-1">Vous avez un compte ?</Link>
              </p>
            </div>
          )}
          <div>
            <p className="spec-label mb-2">Adresse de livraison</p>
            <select
              value={shippingAddressId}
              onChange={(e) => setShippingAddressId(e.target.value)}
              className="input-dark w-full"
              required
              disabled={!hasAddresses}
            >
              <option value="">Sélectionner une adresse</option>
              {user?.addresses?.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.label || `${address.firstName} ${address.lastName}`} — {address.street}, {address.postalCode} {address.city}
                </option>
              ))}
            </select>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-text-muted">
                {hasAddresses ? "Tu peux aussi ajouter une nouvelle adresse." : "Aucune adresse enregistrée pour ce compte."}
              </p>
              <button
                type="button"
                className="font-mono text-xs text-neon underline disabled:opacity-50"
                onClick={() => {
                  setShowInlineAddressForm((prev) => !prev);
                  setAddressError("");
                }}
              >
                {showInlineAddressForm ? "Fermer le formulaire" : "Ajouter une adresse"}
              </button>
            </div>
            {showInlineAddressForm ? (
              <div className="mt-3 border border-border p-4 space-y-3">
                <p className="spec-label">Nouvelle adresse</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className="input-dark w-full"
                    placeholder="Prénom*"
                    value={inlineAddress.firstName}
                    onChange={(e) => setInlineAddress((prev) => ({ ...prev, firstName: e.target.value }))}
                  />
                  <input
                    className="input-dark w-full"
                    placeholder="Nom*"
                    value={inlineAddress.lastName}
                    onChange={(e) => setInlineAddress((prev) => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
                <input
                  className="input-dark w-full"
                  placeholder="Adresse*"
                  value={inlineAddress.street}
                  onChange={(e) => setInlineAddress((prev) => ({ ...prev, street: e.target.value }))}
                />
                <input
                  className="input-dark w-full"
                  placeholder="Complément d'adresse"
                  value={inlineAddress.street2}
                  onChange={(e) => setInlineAddress((prev) => ({ ...prev, street2: e.target.value }))}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className="input-dark w-full"
                    placeholder="Code postal*"
                    value={inlineAddress.postalCode}
                    onChange={(e) => setInlineAddress((prev) => ({ ...prev, postalCode: e.target.value }))}
                  />
                  <input
                    className="input-dark w-full"
                    placeholder="Ville*"
                    value={inlineAddress.city}
                    onChange={(e) => setInlineAddress((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className="input-dark w-full"
                    placeholder="Pays (code ISO, ex: FR)"
                    value={inlineAddress.country}
                    onChange={(e) => setInlineAddress((prev) => ({ ...prev, country: e.target.value }))}
                  />
                  <input
                    className="input-dark w-full"
                    placeholder="Téléphone"
                    value={inlineAddress.phone}
                    onChange={(e) => setInlineAddress((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <input
                  className="input-dark w-full"
                  placeholder="Libellé (ex: domicile)"
                  value={inlineAddress.label}
                  onChange={(e) => setInlineAddress((prev) => ({ ...prev, label: e.target.value }))}
                />
                {addressError ? <p className="font-mono text-xs text-danger">{addressError}</p> : null}
                <button
                  type="button"
                  onClick={async () => {
                    await createInlineAddress();
                  }}
                  disabled={creatingAddress}
                  className="btn-outline w-full disabled:opacity-50"
                >
                  {creatingAddress ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      ENREGISTREMENT...
                    </>
                  ) : (
                    "ENREGISTRER CETTE ADRESSE"
                  )}
                </button>
              </div>
            ) : null}
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
