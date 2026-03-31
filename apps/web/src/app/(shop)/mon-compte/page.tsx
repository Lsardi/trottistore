"use client";

import { useState, Suspense } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Loader2, Wrench } from "lucide-react";
import GarageSection from "@/components/GarageSection";
import LoyaltyCard from "@/components/LoyaltyCard";
import {
  ApiError,
  addressesApi,
  authApi,
  ordersApi,
  repairsApi,
  type Address,
  type Order,
  type RepairTicket,
  type User,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type AddressFormState = {
  firstName: string;
  lastName: string;
  street: string;
  street2: string;
  postalCode: string;
  city: string;
  phone: string;
  label: string;
  type: "SHIPPING" | "BILLING";
  isDefault: boolean;
};

const EMPTY_ADDRESS_FORM: AddressFormState = {
  firstName: "",
  lastName: "",
  street: "",
  street2: "",
  postalCode: "",
  city: "",
  phone: "",
  label: "",
  type: "SHIPPING",
  isDefault: false,
};

export default function MonCompteWrapper() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neon" /></div>}>
      <MonComptePage />
    </Suspense>
  );
}

function MonComptePage() {
function formatPrice(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
  function isBackofficeRole(role?: string): boolean {
    return role === "SUPERADMIN" || role === "MANAGER" || role === "TECHNICIAN";
  }
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/mon-compte";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressFormState>(EMPTY_ADDRESS_FORM);
  const [addressError, setAddressError] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  useEffect(() => {
    async function loadAccount() {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setBooting(false);
        return;
      }

      try {
        const meRes = await authApi.me();
        const currentUser = meRes.data;
        setUser(currentUser);

        if (isBackofficeRole(currentUser.role)) {
          window.location.href = "/admin";
          return;
        }

        if (currentUser.role === "CLIENT") {
          const [ordersRes, repairsRes, addressesRes] = await Promise.all([
            ordersApi.list({ page: 1 }),
            repairsApi.list({
              page: 1,
              limit: 10,
              customerId: currentUser.id,
              sort: "newest",
            }),
            addressesApi.list(),
          ]);

          setOrders(ordersRes.data || []);
          setTickets(repairsRes.data || []);
          setAddresses(addressesRes.data || []);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem("accessToken");
        } else {
          setError("Impossible de charger votre espace client.");
        }
      } finally {
        setBooting(false);
      }
    }

    loadAccount();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(loginForm);
      localStorage.setItem("accessToken", res.accessToken);
      window.location.href = isBackofficeRole(res.user?.role) ? "/admin" : nextPath;
    } catch {
      setError("Email ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.register(registerForm);
      const res = await authApi.login({
        email: registerForm.email,
        password: registerForm.password,
      });
      localStorage.setItem("accessToken", res.accessToken);
      window.location.href = isBackofficeRole(res.user?.role) ? "/admin" : nextPath;
    } catch {
      setError("Erreur lors de l'inscription. Cet email est peut-etre deja utilise.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("accessToken");
    window.location.href = "/mon-compte";
  }

  function resetAddressForm() {
    setAddressForm(EMPTY_ADDRESS_FORM);
    setEditingAddressId(null);
    setAddressError("");
  }

  function openCreateAddressForm() {
    resetAddressForm();
    setAddressFormOpen(true);
  }

  function startEditAddress(address: Address) {
    setAddressForm({
      firstName: address.firstName || "",
      lastName: address.lastName || "",
      street: address.street || "",
      street2: address.street2 || "",
      postalCode: address.postalCode || "",
      city: address.city || "",
      phone: address.phone || "",
      label: address.label || "",
      type: address.type,
      isDefault: address.isDefault,
    });
    setEditingAddressId(address.id);
    setAddressError("");
    setAddressFormOpen(true);
  }

  async function submitAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddressSaving(true);
    setAddressError("");

    if (
      !addressForm.firstName.trim() ||
      !addressForm.lastName.trim() ||
      !addressForm.street.trim() ||
      !addressForm.postalCode.trim() ||
      !addressForm.city.trim()
    ) {
      setAddressError("Merci de remplir tous les champs obligatoires.");
      setAddressSaving(false);
      return;
    }

    try {
      if (editingAddressId) {
        const updated = await addressesApi.update(editingAddressId, {
          firstName: addressForm.firstName.trim(),
          lastName: addressForm.lastName.trim(),
          street: addressForm.street.trim(),
          street2: addressForm.street2.trim() || undefined,
          postalCode: addressForm.postalCode.trim(),
          city: addressForm.city.trim(),
          phone: addressForm.phone.trim() || undefined,
          label: addressForm.label.trim() || undefined,
          type: addressForm.type,
          isDefault: addressForm.isDefault,
          country: "FR",
        });
        setAddresses((prev) => prev.map((a) => (a.id === updated.data.id ? updated.data : a)));
      } else {
        const created = await addressesApi.create({
          firstName: addressForm.firstName.trim(),
          lastName: addressForm.lastName.trim(),
          street: addressForm.street.trim(),
          street2: addressForm.street2.trim() || undefined,
          postalCode: addressForm.postalCode.trim(),
          city: addressForm.city.trim(),
          phone: addressForm.phone.trim() || undefined,
          label: addressForm.label.trim() || undefined,
          type: addressForm.type,
          isDefault: addressForm.isDefault,
          country: "FR",
        });
        setAddresses((prev) => [created.data, ...prev]);
      }

      resetAddressForm();
      setAddressFormOpen(false);
    } catch {
      setAddressError("Impossible d'enregistrer l'adresse.");
    } finally {
      setAddressSaving(false);
    }
  }

  async function deleteAddress(id: string) {
    try {
      await addressesApi.delete(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setAddressError("Impossible de supprimer l'adresse.");
    }
  }

  async function markAddressAsDefault(address: Address) {
    try {
      const updated = await addressesApi.update(address.id, {
        isDefault: true,
        type: address.type,
      });
      setAddresses((prev) =>
        prev.map((item) => {
          if (item.type !== updated.data.type) return item;
          if (item.id === updated.data.id) return { ...item, isDefault: true };
          return { ...item, isDefault: false };
        }),
      );
    } catch {
      setAddressError("Impossible de mettre cette adresse par défaut.");
    }
  }

  if (booting) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-sm text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement du compte...
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="spec-label mb-2">ESPACE CLIENT</p>
            <h1 className="heading-lg">
              {user.firstName} {user.lastName}
            </h1>
            <p className="font-mono text-xs text-text-muted mt-2">{user.email}</p>
          </div>
          <button onClick={handleLogout} className="btn-outline">
            DECONNEXION
          </button>
        </div>

        <div className="mb-8">
          <LoyaltyCard
            tier={user.customerProfile?.loyaltyTier || "BRONZE"}
            points={user.customerProfile?.loyaltyPoints ?? 0}
            totalSpent={user.customerProfile?.totalSpent ?? 0}
            totalOrders={user.customerProfile?.totalOrders ?? orders.length}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-surface border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-neon" />
              <p className="spec-label">Dernières commandes</p>
            </div>
            {orders.length === 0 ? (
              <p className="font-mono text-sm text-text-muted">Aucune commande pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 6).map((order) => (
                  <div
                    key={order.id}
                    className="border border-border p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-mono text-xs text-text">#{order.orderNumber}</p>
                      <p className="font-mono text-[11px] text-text-dim">{order.status}</p>
                    </div>
                    <p className="font-mono text-sm text-neon">{formatPrice(order.totalTtc)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-surface border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-4 h-4 text-neon" />
              <p className="spec-label">Tickets SAV</p>
            </div>
            {tickets.length === 0 ? (
              <p className="font-mono text-sm text-text-muted">Aucun ticket SAV en cours.</p>
            ) : (
              <div className="space-y-3">
                {tickets.slice(0, 6).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="border border-border p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-mono text-xs text-text">{ticket.productModel}</p>
                      <p className="font-mono text-[11px] text-text-dim">{ticket.status}</p>
                      {ticket.trackingToken ? (
                        <Link
                          href={`/mon-compte/suivi/${ticket.trackingToken}`}
                          className="font-mono text-[11px] text-neon hover:underline"
                        >
                          Suivi en temps réel
                        </Link>
                      ) : null}
                    </div>
                    <p className="font-mono text-xs text-text-muted">#{ticket.ticketNumber}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mt-6">
          <GarageSection />
        </div>

        <section className="bg-surface border border-border p-5 mt-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="spec-label">Mes adresses</p>
            <button type="button" className="btn-outline" onClick={openCreateAddressForm}>
              Ajouter une adresse
            </button>
          </div>

          {addressError ? (
            <div className="border border-danger/30 bg-danger/10 text-danger px-3 py-2 font-mono text-xs mb-4">
              {addressError}
            </div>
          ) : null}

          {addressFormOpen ? (
            <form onSubmit={submitAddress} className="border border-border p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="spec-label block mb-2">Prénom</label>
                <input
                  className="input-dark w-full"
                  value={addressForm.firstName}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div>
                <label className="spec-label block mb-2">Nom</label>
                <input
                  className="input-dark w-full"
                  value={addressForm.lastName}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="spec-label block mb-2">Adresse</label>
                <input
                  className="input-dark w-full"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, street: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="spec-label block mb-2">Complément</label>
                <input
                  className="input-dark w-full"
                  value={addressForm.street2}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, street2: e.target.value }))}
                />
              </div>
              <div>
                <label className="spec-label block mb-2">Code postal</label>
                <input
                  className="input-dark w-full"
                  value={addressForm.postalCode}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                />
              </div>
              <div>
                <label className="spec-label block mb-2">Ville</label>
                <input
                  className="input-dark w-full"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="spec-label block mb-2">Téléphone</label>
                <input
                  className="input-dark w-full"
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="spec-label block mb-2">Label</label>
                <input
                  className="input-dark w-full"
                  value={addressForm.label}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="Maison, Bureau..."
                />
              </div>
              <div>
                <label className="spec-label block mb-2">Type</label>
                <select
                  className="input-dark w-full"
                  value={addressForm.type}
                  onChange={(e) =>
                    setAddressForm((prev) => ({
                      ...prev,
                      type: e.target.value as "SHIPPING" | "BILLING",
                    }))
                  }
                >
                  <option value="SHIPPING">Livraison</option>
                  <option value="BILLING">Facturation</option>
                </select>
              </div>
              <label className="inline-flex items-center gap-2 font-mono text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                />
                Adresse par défaut
              </label>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button type="submit" disabled={addressSaving} className="btn-neon disabled:opacity-50">
                  {addressSaving ? "ENREGISTREMENT..." : editingAddressId ? "Mettre à jour" : "Ajouter"}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    resetAddressForm();
                    setAddressFormOpen(false);
                  }}
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : null}

          {addresses.length === 0 ? (
            <p className="font-mono text-sm text-text-muted">Aucune adresse enregistrée.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((address) => (
                <div key={address.id} className="border border-border p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-mono text-xs text-text">
                      {address.firstName} {address.lastName}
                    </p>
                    {address.isDefault ? (
                      <span className="font-mono text-[10px] px-2 py-1 border border-neon text-neon">PAR DÉFAUT</span>
                    ) : null}
                  </div>
                  <p className="font-mono text-xs text-text-dim">{address.street}</p>
                  {address.street2 ? <p className="font-mono text-xs text-text-dim">{address.street2}</p> : null}
                  <p className="font-mono text-xs text-text-dim">
                    {address.postalCode} {address.city}
                  </p>
                  <p className="font-mono text-xs text-text-dim mb-3">{address.country}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-outline" onClick={() => startEditAddress(address)}>
                      Modifier
                    </button>
                    <button type="button" className="btn-outline" onClick={() => deleteAddress(address.id)}>
                      Supprimer
                    </button>
                    {!address.isDefault ? (
                      <button type="button" className="btn-outline" onClick={() => markAddressAsDefault(address)}>
                        Mettre par défaut
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-border overflow-hidden">
          <div className="flex border-b border-border">
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={cn(
                "flex-1 py-4 font-mono text-xs uppercase tracking-widest transition-colors relative",
                mode === "login" ? "text-neon" : "text-text-dim hover:text-text-muted"
              )}
            >
              CONNEXION
              {mode === "login" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-neon" />}
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={cn(
                "flex-1 py-4 font-mono text-xs uppercase tracking-widest transition-colors relative",
                mode === "register" ? "text-neon" : "text-text-dim hover:text-text-muted"
              )}
            >
              INSCRIPTION
              {mode === "register" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-neon" />}
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <div className="border border-danger/30 bg-danger/10 text-danger px-4 py-3 font-mono text-sm mb-6">
                {error}
              </div>
            )}

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="spec-label block mb-2">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="votre@email.fr"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="input-dark w-full"
                  />
                </div>
                <div>
                  <label className="spec-label block mb-2">Mot de passe</label>
                  <input
                    type="password"
                    required
                    placeholder="Votre mot de passe"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="input-dark w-full"
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-neon w-full mt-2 disabled:opacity-50">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      CONNEXION...
                    </>
                  ) : (
                    "SE CONNECTER"
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="spec-label block mb-2">Prenom</label>
                    <input
                      type="text"
                      required
                      placeholder="Jean"
                      value={registerForm.firstName}
                      onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                      className="input-dark w-full"
                    />
                  </div>
                  <div>
                    <label className="spec-label block mb-2">Nom</label>
                    <input
                      type="text"
                      required
                      placeholder="Dupont"
                      value={registerForm.lastName}
                      onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                      className="input-dark w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="spec-label block mb-2">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="votre@email.fr"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    className="input-dark w-full"
                  />
                </div>
                <div>
                  <label className="spec-label block mb-2">Telephone</label>
                  <input
                    type="tel"
                    placeholder="06 12 34 56 78"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    className="input-dark w-full"
                  />
                </div>
                <div>
                  <label className="spec-label block mb-2">Mot de passe</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Minimum 8 caracteres"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="input-dark w-full"
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-neon w-full mt-2 disabled:opacity-50">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      INSCRIPTION...
                    </>
                  ) : (
                    "CREER MON COMPTE"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center font-mono text-xs text-text-dim mt-6">
          En continuant, vous acceptez nos conditions generales de vente.
        </p>
      </div>
    </div>
  );
}
