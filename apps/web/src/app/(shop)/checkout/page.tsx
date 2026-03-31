"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  ApiError,
  addressesApi,
  authApi,
  cartApi,
  ordersApi,
  type Address,
  type CartItem,
} from "@/lib/api";

const PAYMENT_METHODS = [
  { value: "CARD", label: "Carte bancaire" },
  { value: "APPLE_PAY", label: "Apple Pay" },
  { value: "GOOGLE_PAY", label: "Google Pay" },
  { value: "LINK", label: "Link" },
  { value: "INSTALLMENT_3X", label: "Paiement en 3x sans frais" },
  { value: "BANK_TRANSFER", label: "Virement bancaire" },
] as const;
// TODO(checkout): réintégrer le flux Stripe PaymentElement une fois le tunnel de conversion stabilisé.

const SHIPPING_METHODS = [
  { value: "DELIVERY", label: "Livraison" },
  { value: "STORE_PICKUP", label: "Retrait boutique" },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];
type ShippingMethod = (typeof SHIPPING_METHODS)[number]["value"];

type AddressForm = {
  firstName: string;
  lastName: string;
  street: string;
  street2: string;
  postalCode: string;
  city: string;
  phone: string;
  label: string;
};

const EMPTY_ADDRESS_FORM: AddressForm = {
  firstName: "",
  lastName: "",
  street: "",
  street2: "",
  postalCode: "",
  city: "",
  phone: "",
  label: "",
};

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

function validateAddress(form: AddressForm): Partial<Record<keyof AddressForm, string>> {
  const errors: Partial<Record<keyof AddressForm, string>> = {};
  if (!form.firstName.trim()) errors.firstName = "Le prénom est requis.";
  if (!form.lastName.trim()) errors.lastName = "Le nom est requis.";
  if (!form.street.trim()) errors.street = "L'adresse est requise.";
  if (!form.postalCode.trim()) errors.postalCode = "Le code postal est requis.";
  if (!form.city.trim()) errors.city = "La ville est requise.";
  if (!form.phone.trim()) errors.phone = "Le téléphone est requis.";
  return errors;
}

export default function CheckoutPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [billingAddressId, setBillingAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("DELIVERY");
  const [notes, setNotes] = useState("");

  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [addressForm, setAddressForm] = useState<AddressForm>(EMPTY_ADDRESS_FORM);
  const [addressErrors, setAddressErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCheckout() {
      try {
        await authApi.me();
        const [cartRes, addressesRes] = await Promise.all([cartApi.get(), addressesApi.list()]);
        setItems(cartRes.data.items || []);

        const saved = addressesRes.data || [];
        setAddresses(saved);
        const defaultShipping = saved.find((a) => a.type === "SHIPPING" && a.isDefault) ?? saved[0];
        if (defaultShipping) {
          setShippingAddressId(defaultShipping.id);
          setBillingAddressId(defaultShipping.id);
        }

        if (saved.length === 0) {
          setShowNewAddressForm(true);
          setSaveAddress(false);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
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

  const subtotalHt = useMemo(() => items.reduce((sum, item) => sum + item.lineTotalHt, 0), [items]);
  const subtotalTtc = useMemo(() => subtotalHt * 1.2, [subtotalHt]);
  const shippingCost = useMemo(() => (subtotalHt >= 100 ? 0 : 6.9), [subtotalHt]);
  const totalTtc = useMemo(() => subtotalTtc + shippingCost, [subtotalTtc, shippingCost]);

  function updateAddressField<K extends keyof AddressForm>(field: K, value: AddressForm[K]) {
    setAddressForm((prev) => ({ ...prev, [field]: value }));
    if (addressErrors[field]) {
      setAddressErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function createInlineAddress(): Promise<{ id: string; temporary: boolean } | null> {
    const errors = validateAddress(addressForm);
    setAddressErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Merci de corriger les champs d'adresse en rouge.");
      return null;
    }

    const created = await addressesApi.create({
      type: "SHIPPING",
      firstName: addressForm.firstName.trim(),
      lastName: addressForm.lastName.trim(),
      street: addressForm.street.trim(),
      street2: addressForm.street2.trim() || undefined,
      city: addressForm.city.trim(),
      postalCode: addressForm.postalCode.trim(),
      country: "FR",
      phone: addressForm.phone.trim(),
      label: addressForm.label.trim() || undefined,
      isDefault: saveAddress,
    });

    if (saveAddress) {
      setAddresses((prev) => [created.data, ...prev.filter((a) => a.id !== created.data.id)]);
      setShippingAddressId(created.data.id);
      setBillingAddressId(created.data.id);
      setShowNewAddressForm(false);
      setAddressForm(EMPTY_ADDRESS_FORM);
      return { id: created.data.id, temporary: false };
    }

    return { id: created.data.id, temporary: true };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    let tempAddressId: string | null = null;

    try {
      let selectedShippingId = shippingAddressId;

      if (showNewAddressForm || !selectedShippingId) {
        const inlineAddress = await createInlineAddress();
        if (!inlineAddress) {
          setSubmitting(false);
          return;
        }
        selectedShippingId = inlineAddress.id;
        if (inlineAddress.temporary) tempAddressId = inlineAddress.id;
      }

      const orderRes = await ordersApi.create({
        shippingAddressId: selectedShippingId,
        billingAddressId: billingAddressId || selectedShippingId,
        paymentMethod,
        shippingMethod,
        notes: notes.trim() || undefined,
      });

      if (tempAddressId) {
        await addressesApi.delete(tempAddressId).catch(() => null);
      }

      setItems([]);
      window.dispatchEvent(new Event("trottistore:cart-updated"));
      router.push(`/checkout/confirmation?orderId=${orderRes.data.id}&orderNumber=${orderRes.data.orderNumber}`);
    } catch (err) {
      if (tempAddressId) {
        await addressesApi.delete(tempAddressId).catch(() => null);
      }

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

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-28 md:pb-12">
      <Link href="/panier" className="font-mono text-xs uppercase tracking-wider text-text-muted inline-flex items-center gap-2 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Retour panier
      </Link>

      <h1 className="heading-lg mb-6">CHECKOUT</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-surface border border-border p-4 sm:p-6 space-y-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="spec-label">Adresse de livraison</p>
              <button
                type="button"
                onClick={() => setShowNewAddressForm((prev) => !prev)}
                className="font-mono text-xs text-neon hover:underline"
              >
                {showNewAddressForm ? "Utiliser une adresse existante" : "Nouvelle adresse"}
              </button>
            </div>

            {!showNewAddressForm && addresses.length > 0 ? (
              <select
                value={shippingAddressId}
                onChange={(e) => setShippingAddressId(e.target.value)}
                className="input-dark w-full"
              >
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {(address.label || `${address.firstName} ${address.lastName}`)} - {address.street}, {address.postalCode} {address.city}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="checkout-first-name" className="spec-label block mb-2">Prénom</label>
                  <input
                    id="checkout-first-name"
                    name="shipping_firstName"
                    value={addressForm.firstName}
                    onChange={(e) => updateAddressField("firstName", e.target.value)}
                    className={`input-dark w-full ${addressErrors.firstName ? "border-danger" : ""}`}
                    autoComplete="given-name"
                  />
                  {addressErrors.firstName ? <p className="text-danger font-mono text-xs mt-1">{addressErrors.firstName}</p> : null}
                </div>

                <div>
                  <label htmlFor="checkout-last-name" className="spec-label block mb-2">Nom</label>
                  <input
                    id="checkout-last-name"
                    name="shipping_lastName"
                    value={addressForm.lastName}
                    onChange={(e) => updateAddressField("lastName", e.target.value)}
                    className={`input-dark w-full ${addressErrors.lastName ? "border-danger" : ""}`}
                    autoComplete="family-name"
                  />
                  {addressErrors.lastName ? <p className="text-danger font-mono text-xs mt-1">{addressErrors.lastName}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="checkout-street" className="spec-label block mb-2">Adresse</label>
                  <input
                    id="checkout-street"
                    name="shipping_street"
                    value={addressForm.street}
                    onChange={(e) => updateAddressField("street", e.target.value)}
                    className={`input-dark w-full ${addressErrors.street ? "border-danger" : ""}`}
                    autoComplete="address-line1"
                  />
                  {addressErrors.street ? <p className="text-danger font-mono text-xs mt-1">{addressErrors.street}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="checkout-street2" className="spec-label block mb-2">Complément</label>
                  <input
                    id="checkout-street2"
                    name="shipping_street2"
                    value={addressForm.street2}
                    onChange={(e) => updateAddressField("street2", e.target.value)}
                    className="input-dark w-full"
                    autoComplete="address-line2"
                  />
                </div>

                <div>
                  <label htmlFor="checkout-postal-code" className="spec-label block mb-2">Code postal</label>
                  <input
                    id="checkout-postal-code"
                    name="shipping_postalCode"
                    value={addressForm.postalCode}
                    onChange={(e) => updateAddressField("postalCode", e.target.value)}
                    className={`input-dark w-full ${addressErrors.postalCode ? "border-danger" : ""}`}
                    autoComplete="postal-code"
                  />
                  {addressErrors.postalCode ? <p className="text-danger font-mono text-xs mt-1">{addressErrors.postalCode}</p> : null}
                </div>

                <div>
                  <label htmlFor="checkout-city" className="spec-label block mb-2">Ville</label>
                  <input
                    id="checkout-city"
                    name="shipping_city"
                    value={addressForm.city}
                    onChange={(e) => updateAddressField("city", e.target.value)}
                    className={`input-dark w-full ${addressErrors.city ? "border-danger" : ""}`}
                    autoComplete="address-level2"
                  />
                  {addressErrors.city ? <p className="text-danger font-mono text-xs mt-1">{addressErrors.city}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="checkout-phone" className="spec-label block mb-2">Téléphone</label>
                  <input
                    id="checkout-phone"
                    name="shipping_phone"
                    value={addressForm.phone}
                    onChange={(e) => updateAddressField("phone", e.target.value)}
                    className={`input-dark w-full ${addressErrors.phone ? "border-danger" : ""}`}
                    autoComplete="tel"
                  />
                  {addressErrors.phone ? <p className="text-danger font-mono text-xs mt-1">{addressErrors.phone}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="checkout-label" className="spec-label block mb-2">Label (optionnel)</label>
                  <input
                    id="checkout-label"
                    name="shipping_label"
                    value={addressForm.label}
                    onChange={(e) => updateAddressField("label", e.target.value)}
                    className="input-dark w-full"
                    placeholder="Maison, Bureau..."
                  />
                </div>

                <label className="sm:col-span-2 inline-flex items-center gap-2 font-mono text-xs text-text-muted">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                  />
                  Sauvegarder cette adresse
                </label>
              </div>
            )}
          </section>

          <section>
            <p className="spec-label mb-2">Adresse de facturation</p>
            <select value={billingAddressId} onChange={(e) => setBillingAddressId(e.target.value)} className="input-dark w-full">
              <option value="">Identique à la livraison</option>
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {(address.label || `${address.firstName} ${address.lastName}`)} - {address.street}, {address.postalCode} {address.city}
                </option>
              ))}
            </select>
          </section>

          <section>
            <p className="spec-label mb-2">Mode de livraison</p>
            <select
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
              className="input-dark w-full"
            >
              {SHIPPING_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </section>

          <section>
            <p className="spec-label mb-2">Mode de paiement</p>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="input-dark w-full"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </section>

          <section>
            <p className="spec-label mb-2">Notes (optionnel)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-dark w-full min-h-24"
              placeholder="Instructions de livraison"
            />
          </section>

          {error ? (
            <div className="border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-sm text-danger">{error}</div>
          ) : null}

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

        <aside className="bg-surface border border-border p-5 h-fit lg:sticky lg:top-24">
          <p className="spec-label mb-4">Récapitulatif</p>
          <div className="space-y-3 mb-4 max-h-[45vh] overflow-auto pr-1">
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
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-text-muted">Sous-total TTC</span>
              <span className="font-mono text-sm text-text">{formatPrice(subtotalTtc)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-text-muted">Livraison</span>
              <span className="font-mono text-sm text-text">
                {shippingCost === 0 ? "Gratuit" : formatPrice(shippingCost)}
              </span>
            </div>
            <div className="divider" />
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-text-muted">Total</span>
              <span className="price-main" style={{ fontSize: "1.3rem" }}>
                {formatPrice(totalTtc)}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
