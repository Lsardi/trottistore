"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Truck,
  Wallet,
  Building2,
} from "lucide-react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { ApiError, addressesApi, authApi, cartApi, checkoutApi, ordersApi, type CartItem, type User } from "@/lib/api";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: "CARD", label: "Carte bancaire", icon: CreditCard },
  { value: "APPLE_PAY", label: "Apple Pay", icon: Smartphone },
  { value: "GOOGLE_PAY", label: "Google Pay", icon: Wallet },
  { value: "LINK", label: "Link (Stripe)", icon: Wallet },
  { value: "BANK_TRANSFER", label: "Virement bancaire", icon: Building2 },
] as const;

const DELIVERY_MODES = [
  { value: "STANDARD", label: "Livraison standard" },
  { value: "PICKUP_1H", label: "Retrait boutique en 1h" },
] as const;

type StripePaymentMethod = "CARD" | "APPLE_PAY" | "GOOGLE_PAY" | "LINK";

const CHECKOUT_STEPS = [
  { number: 1, label: "Adresse" },
  { number: 2, label: "Paiement" },
  { number: 3, label: "Confirmation" },
] as const;

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
      onError(result.error.message || "Le paiement a echoue.");
      return;
    }

    if (result.paymentIntent?.status === "succeeded" || result.paymentIntent?.status === "processing") {
      onSuccess();
      return;
    }

    onError("Paiement en attente. Verifiez votre historique de commande.");
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

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {CHECKOUT_STEPS.map((step, idx) => (
        <div key={step.number} className="flex items-center">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "w-8 h-8 flex items-center justify-center border font-mono text-xs font-bold transition-all duration-200",
                currentStep === step.number
                  ? "border-neon bg-neon text-void"
                  : currentStep > step.number
                    ? "border-neon/50 bg-neon/20 text-neon"
                    : "border-border text-text-dim"
              )}
            >
              {currentStep > step.number ? <Check className="w-3.5 h-3.5" /> : step.number}
            </div>
            <span
              className={cn(
                "font-mono text-xs uppercase tracking-wider hidden sm:block transition-colors duration-200",
                currentStep === step.number
                  ? "text-neon"
                  : currentStep > step.number
                    ? "text-neon/60"
                    : "text-text-dim"
              )}
            >
              {step.label}
            </span>
          </div>
          {idx < CHECKOUT_STEPS.length - 1 && (
            <div
              className={cn(
                "w-12 sm:w-16 h-px mx-3 transition-colors duration-200",
                currentStep > step.number ? "bg-neon/50" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
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
          // Not authenticated or token expired — enable guest checkout
          const hadToken = !!localStorage.getItem("accessToken");
          if (hadToken) {
            localStorage.removeItem("accessToken");
          }
          setIsGuest(true);
          setShowInlineAddressForm(true);
          if (hadToken) {
            setError("Votre session a expire. Vous pouvez continuer en tant qu'invite ou vous reconnecter.");
          }
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

  const totalHt = useMemo(() => items.reduce((sum, item) => sum + item.lineTotalHt, 0), [items]);
  const totalTtc = useMemo(() => totalHt * 1.2, [totalHt]);
  // Shipping is computed server-side at order creation. Display 'Calculee a
  // la commande' rather than a stale local guess.
  const shippingCost = 0;

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

  // Determine which checkout step is active
  const currentStep = successOrderId ? 3 : pendingStripeCheckout ? 2 : 1;

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
      setAddressError("Renseigne prenom, nom, rue, code postal et ville.");
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
      setAddressError("Impossible d'enregistrer l'adresse. Reessaie.");
      return null;
    } finally {
      setCreatingAddress(false);
    }
  }

  // Double-submit guard (useRef for immediate blocking before React re-render)
  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
    if (!acceptedCgv) {
      setError("Veuillez accepter les conditions generales de vente.");
      return;
    }
    // T-49: Prevent submit with empty cart
    if (items.length === 0) {
      setError("Votre panier est vide.");
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
            "x-session-id": localStorage.getItem("trottistore-session-id") || "",
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
          setError("Selectionnez une adresse de livraison.");
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
        setError(payload?.error?.message || "La commande a echoue.");
      } else {
        setError("La commande a echoue.");
      }
    } finally {
      setSubmitting(false);
    }
    } finally { submittingRef.current = false; }
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
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <StepIndicator currentStep={3} />
        <div className="mx-auto max-w-2xl text-center py-8">
          {/* Animated checkmark */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 border-2 border-neon animate-[success-ring_0.6s_ease-out_forwards] opacity-0" style={{ borderRadius: "50%" }} />
            <div className="absolute inset-2 bg-neon/10 flex items-center justify-center animate-[success-fill_0.4s_0.3s_ease-out_forwards] opacity-0" style={{ borderRadius: "50%" }}>
              <Check className="w-10 h-10 text-neon animate-[success-check_0.3s_0.5s_ease-out_forwards] opacity-0" />
            </div>
            {/* CSS confetti particles */}
            <div className="absolute inset-0">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1.5 h-1.5 left-1/2 top-1/2"
                  style={{
                    backgroundColor: i % 2 === 0 ? "var(--color-neon)" : "var(--color-neon-muted)",
                    animation: `confetti-burst 0.8s ${0.4 + i * 0.05}s ease-out forwards`,
                    opacity: 0,
                    transform: `rotate(${i * 45}deg) translateY(0)`,
                  }}
                />
              ))}
            </div>
          </div>

          <p className="spec-label mb-3 animate-slide-up stagger-1">COMMANDE CONFIRMEE</p>
          <h1 className="heading-lg mb-4 animate-slide-up stagger-2">Merci pour votre commande !</h1>
          <div className="inline-block bg-surface border border-neon/30 px-6 py-3 mb-4 animate-slide-up stagger-3">
            <p className="font-mono text-xs text-text-dim mb-1">Reference</p>
            <p className="font-mono text-sm text-neon font-bold tracking-wider">{successOrderId}</p>
          </div>
          <p className="font-mono text-xs text-text-dim mb-8 animate-slide-up stagger-4">
            Un email de confirmation a ete envoye. Conservez votre reference pour le suivi.
          </p>
          <div className="flex flex-wrap gap-3 justify-center animate-slide-up stagger-5">
            <Link href="/produits" className="btn-neon cursor-pointer">CONTINUER MES ACHATS</Link>
            {!isGuest && <Link href="/mon-compte" className="btn-outline cursor-pointer">MON COMPTE</Link>}
          </div>
        </div>

        {/* Success animations */}
        <style>{`
          @keyframes success-ring {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes success-fill {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes success-check {
            0% { transform: scale(0) rotate(-45deg); opacity: 0; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          @keyframes confetti-burst {
            0% { transform: rotate(var(--r, 0deg)) translateY(0) scale(1); opacity: 1; }
            100% { transform: rotate(var(--r, 0deg)) translateY(-60px) scale(0); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <Link href="/panier" className="font-mono text-xs uppercase tracking-wider text-text-muted inline-flex items-center gap-2 mb-6 cursor-pointer hover:text-neon transition-colors duration-200">
        <ArrowLeft className="w-4 h-4" />
        Retour panier
      </Link>
      <h1 className="heading-lg mb-2">CHECKOUT</h1>

      <StepIndicator currentStep={currentStep} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {/* Step 1: Address */}
          <div className="bg-surface border border-border p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-neon" />
              <p className="spec-label">Adresse de livraison</p>
            </div>

            {isGuest && (
              <div>
                <label htmlFor="guest-email" className="spec-label mb-2 block">Votre email</label>
                <input
                  id="guest-email"
                  type="email"
                  required
                  placeholder="votre@email.fr"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="input-dark w-full"
                />
                <p className="font-mono text-xs text-text-dim mt-1">
                  Vous recevrez la confirmation de commande a cette adresse.
                  <Link href="/mon-compte?next=/checkout" className="text-neon ml-1 cursor-pointer hover:underline transition-colors duration-200">Vous avez un compte ?</Link>
                </p>
              </div>
            )}

            <div>
              <select
                id="shipping-address"
                value={shippingAddressId}
                onChange={(e) => setShippingAddressId(e.target.value)}
                className="input-dark w-full cursor-pointer"
                required
                disabled={!hasAddresses}
              >
                <option value="">Selectionner une adresse</option>
                {user?.addresses?.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label || `${address.firstName} ${address.lastName}`} — {address.street}, {address.postalCode} {address.city}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-text-muted">
                  {hasAddresses ? "Tu peux aussi ajouter une nouvelle adresse." : "Aucune adresse enregistree pour ce compte."}
                </p>
                <button
                  type="button"
                  className="font-mono text-xs text-neon underline disabled:opacity-50 cursor-pointer hover:text-neon-muted transition-colors duration-200"
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
                    <div>
                      <label htmlFor="addr-firstname" className="sr-only">Prenom</label>
                      <input
                        id="addr-firstname"
                        className="input-dark w-full"
                        placeholder="Prenom*"
                        value={inlineAddress.firstName}
                        onChange={(e) => setInlineAddress((prev) => ({ ...prev, firstName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="addr-lastname" className="sr-only">Nom</label>
                      <input
                        id="addr-lastname"
                        className="input-dark w-full"
                        placeholder="Nom*"
                        value={inlineAddress.lastName}
                        onChange={(e) => setInlineAddress((prev) => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="addr-street" className="sr-only">Adresse</label>
                    <input
                      id="addr-street"
                      className="input-dark w-full"
                      placeholder="Adresse*"
                      value={inlineAddress.street}
                      onChange={(e) => setInlineAddress((prev) => ({ ...prev, street: e.target.value }))}
                    />
                  </div>
                  <input
                    className="input-dark w-full"
                    placeholder="Complement d'adresse"
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
                      placeholder="Telephone"
                      value={inlineAddress.phone}
                      onChange={(e) => setInlineAddress((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <input
                    className="input-dark w-full"
                    placeholder="Libelle (ex: domicile)"
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
                    className="btn-outline w-full disabled:opacity-50 cursor-pointer"
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
              <select value={billingAddressId} onChange={(e) => setBillingAddressId(e.target.value)} className="input-dark w-full cursor-pointer">
                <option value="">Identique a la livraison</option>
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
                className="input-dark w-full cursor-pointer"
              >
                {DELIVERY_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
              {deliveryMode === "PICKUP_1H" ? (
                <p className="font-mono text-xs text-neon mt-2">
                  Retrait express selectionne: une confirmation sera envoyee des que la commande est prete.
                </p>
              ) : null}
            </div>
          </div>

          {/* Step 2: Payment method cards */}
          <div className="bg-surface border border-border p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-neon" />
              <p className="spec-label">Moyen de paiement</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                const isSelected = paymentMethod === method.value;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method.value);
                      setPendingStripeCheckout(null);
                    }}
                    disabled={Boolean(pendingStripeCheckout)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 border transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                      isSelected
                        ? "border-neon bg-neon/5 shadow-[0_0_20px_rgba(0,255,209,0.1)]"
                        : "border-border hover:border-text-dim bg-surface-2"
                    )}
                  >
                    <Icon className={cn("w-6 h-6 transition-colors duration-200", isSelected ? "text-neon" : "text-text-dim")} />
                    <span className={cn("font-mono text-xs text-center transition-colors duration-200", isSelected ? "text-neon" : "text-text-muted")}>
                      {method.label}
                    </span>
                    {isSelected && (
                      <div className="w-1.5 h-1.5 bg-neon" style={{ borderRadius: "50%" }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Security badge */}
            <div className="flex items-center gap-3 border border-neon/20 bg-neon/5 px-4 py-3">
              <Lock className="w-4 h-4 text-neon flex-shrink-0" />
              <p className="font-mono text-xs text-text-muted">
                {isStripeFlow
                  ? stripeAvailable
                    ? "Paiement chiffre et securise via Stripe — vos donnees bancaires ne transitent pas par nos serveurs."
                    : "Service de paiement temporairement indisponible, fallback sur flux standard."
                  : "Cette methode finalise la commande immediatement."}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-surface border border-border p-6">
            <p className="spec-label mb-3">Notes (optionnel)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-dark w-full min-h-24"
              placeholder="Instruction de livraison ou remarque"
              disabled={Boolean(pendingStripeCheckout)}
            />
          </div>

          {pendingStripeCheckout && stripePromise && stripeElementsOptions ? (
            <div className="bg-surface border border-neon/30 p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-neon" />
                <p className="spec-label text-neon">Paiement securise Stripe</p>
              </div>
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
                className="font-mono text-xs text-text-muted underline cursor-pointer hover:text-text transition-colors duration-200"
                onClick={() => setPendingStripeCheckout(null)}
              >
                Changer de mode de paiement
              </button>
            </div>
          ) : null}

          {!pendingStripeCheckout ? (
            <label className="flex items-start gap-2 font-mono text-xs text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedCgv}
                onChange={(e) => setAcceptedCgv(e.target.checked)}
                className="mt-0.5 cursor-pointer"
                required
              />
              <span>
                J&apos;accepte les{" "}
                <Link href="/cgv" className="underline text-text hover:text-neon transition-colors duration-200">
                  conditions generales de vente
                </Link>
                .
              </span>
            </label>
          ) : null}

          {error && (
            <div className="border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-sm text-danger flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {!pendingStripeCheckout ? (
            <>
              <button type="submit" disabled={submitting || items.length === 0} className="btn-neon w-full disabled:opacity-50 cursor-pointer">
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
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim">
                  <Lock className="w-3 h-3 text-neon" />
                  <span>Paiement 100% securise</span>
                </div>
                <div className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim">
                  <ShieldCheck className="w-3 h-3 text-neon" />
                  <span>Donnees chiffrees TLS</span>
                </div>
              </div>
            </>
          ) : null}
        </form>

        {/* Order summary sidebar */}
        <aside className="bg-surface border border-border h-fit sticky top-24">
          <div className="p-6">
            <p className="spec-label mb-4">Recapitulatif</p>
            <div className="space-y-4 mb-4">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId ?? "default"}`} className="flex items-start gap-3">
                  {/* Product thumbnail */}
                  <div className="w-14 h-14 bg-surface-2 border border-border flex-shrink-0 overflow-hidden">
                    {item.product.image?.url ? (
                      <Image
                        src={item.product.image.url}
                        alt={item.product.image.alt || item.product.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-text-dim" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-text truncate">{item.product.name}</p>
                    {item.variant?.name && (
                      <p className="font-mono text-[10px] text-text-dim">{item.variant.name}</p>
                    )}
                    <p className="font-mono text-[11px] text-text-dim">Qte: {item.quantity}</p>
                  </div>
                  <p className="font-mono text-xs text-text font-bold flex-shrink-0">{formatPrice(item.lineTotalHt * 1.2)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="divider" />
          <div className="p-6 space-y-2">
            <div className="flex justify-between font-mono text-xs text-text-muted">
              <span>Sous-total HT</span>
              <span>{formatPrice(totalHt)}</span>
            </div>
            <div className="flex justify-between font-mono text-xs text-text-muted">
              <span>TVA (20%)</span>
              <span>{formatPrice(totalTtc - totalHt - shippingCost)}</span>
            </div>
            <div className="flex justify-between font-mono text-xs text-text-muted">
              <span>Livraison</span>
              <span className="text-text-dim">Calculee a la commande</span>
            </div>
            <div className="divider my-3" />
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-text-muted">Total TTC</span>
              <span className="price-main" style={{ fontSize: "1.4rem" }}>
                {formatPrice(totalTtc)}
              </span>
            </div>
          </div>

          {/* Trust signals */}
          <div className="border-t border-border p-6 space-y-2.5">
            <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-neon flex-shrink-0" />
              <span>Garantie legale 2 ans</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
              <RotateCcw className="w-3.5 h-3.5 text-neon flex-shrink-0" />
              <span>Retractation 14 jours</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
              <Truck className="w-3.5 h-3.5 text-neon flex-shrink-0" />
              <span>Livraison France metropolitaine</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
              <Lock className="w-3.5 h-3.5 text-neon flex-shrink-0" />
              <span>Paiement chiffre Stripe</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
