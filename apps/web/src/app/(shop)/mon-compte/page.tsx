"use client";

import { useState, Suspense } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Loader2, Wrench } from "lucide-react";
import AddressSection from "@/components/AddressSection";
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
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { syncGarageWithServer } from "@/lib/garage";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
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

        // Sync the garage (localStorage ↔ CustomerProfile.scooterModels) so
        // the user retrieves their saved scooters across devices.
        syncGarageWithServer(token).catch(() => undefined);

        if (isBackofficeRole(currentUser.role)) {
          window.location.href = "/admin";
          return;
        }

        if (currentUser.role === "CLIENT") {
          const [ordersRes, repairsRes] = await Promise.all([
            ordersApi.list({ page: 1 }),
            repairsApi.list({
              page: 1,
              limit: 10,
              customerId: currentUser.id,
              sort: "newest",
            }),
          ]);

          setOrders(ordersRes.data || []);
          setTickets(repairsRes.data || []);
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
      // Best-effort: sync the garage before redirecting so the user lands
      // on a page where their saved scooters are already merged in.
      await syncGarageWithServer(res.accessToken).catch(() => undefined);
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
      // First-time login: push any anonymously-built garage to the new account.
      await syncGarageWithServer(res.accessToken).catch(() => undefined);
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
          <div className="flex flex-col gap-2">
            <button onClick={handleLogout} className="btn-outline">
              DÉCONNEXION
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/v1/auth/export", {
                    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
                  });
                  const data = await res.json();
                  const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "mes-donnees-trottistore.json";
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  alert("Erreur lors de l'export. Réessayez.");
                }
              }}
              className="font-mono text-xs text-text-dim underline"
            >
              Exporter mes données
            </button>
            <button
              onClick={async () => {
                if (!confirm("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.")) return;
                if (!confirm("Dernière confirmation : toutes vos données personnelles seront effacées.")) return;
                try {
                  await fetch("/api/v1/auth/account", {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
                  });
                  localStorage.removeItem("accessToken");
                  window.location.href = "/";
                } catch {
                  alert("Erreur lors de la suppression. Contactez-nous.");
                }
              }}
              className="font-mono text-xs text-danger underline"
            >
              Supprimer mon compte
            </button>
          </div>
        </div>

        <div className="mb-8">
          <LoyaltyCard
            tier={user.customerProfile?.loyaltyTier || "BRONZE"}
            points={user.customerProfile?.loyaltyPoints ?? 0}
            totalSpent={user.customerProfile?.totalSpent ?? 0}
            totalOrders={user.customerProfile?.totalOrders ?? orders.length}
          />
        </div>

        <section className="bg-surface border border-border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="spec-label">Mon profil</p>
            {!editingProfile && (
              <button
                onClick={() => {
                  setProfileForm({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone || "",
                  });
                  setEditingProfile(true);
                  setProfileMsg("");
                }}
                className="font-mono text-xs text-neon underline"
              >
                Modifier
              </button>
            )}
          </div>
          {editingProfile ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setProfileSaving(true);
                setProfileMsg("");
                try {
                  const res = await authApi.updateProfile({
                    firstName: profileForm.firstName,
                    lastName: profileForm.lastName,
                    phone: profileForm.phone || null,
                  });
                  if (res.success && res.data?.user) {
                    setUser({ ...user, ...res.data.user });
                    setEditingProfile(false);
                    setProfileMsg("Profil mis à jour.");
                  }
                } catch {
                  setProfileMsg("Erreur lors de la mise à jour.");
                } finally {
                  setProfileSaving(false);
                }
              }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div>
                <label htmlFor="profile-firstName" className="block font-mono text-xs text-text-muted mb-1">Prénom</label>
                <input
                  id="profile-firstName"
                  type="text"
                  required
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  className="input-dark w-full"
                />
              </div>
              <div>
                <label htmlFor="profile-lastName" className="block font-mono text-xs text-text-muted mb-1">Nom</label>
                <input
                  id="profile-lastName"
                  type="text"
                  required
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  className="input-dark w-full"
                />
              </div>
              <div>
                <label htmlFor="profile-phone" className="block font-mono text-xs text-text-muted mb-1">Téléphone</label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="input-dark w-full"
                  placeholder="06 12 34 56 78"
                />
              </div>
              <div className="md:col-span-3 flex gap-3">
                <button type="submit" disabled={profileSaving} className="btn-neon disabled:opacity-50">
                  {profileSaving ? "Enregistrement..." : "ENREGISTRER"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="btn-outline"
                >
                  ANNULER
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="font-mono text-xs text-text-muted">Prénom</p>
                <p className="font-mono text-sm text-text">{user.firstName}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-text-muted">Nom</p>
                <p className="font-mono text-sm text-text">{user.lastName}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-text-muted">Téléphone</p>
                <p className="font-mono text-sm text-text">{user.phone || "Non renseigné"}</p>
              </div>
              {profileMsg && (
                <p className="md:col-span-3 font-mono text-xs text-neon">{profileMsg}</p>
              )}
            </div>
          )}
        </section>

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
                      <p className="font-mono text-[11px] text-text-dim">{{ PENDING: "En attente", CONFIRMED: "Confirmée", PREPARING: "En préparation", SHIPPED: "Expédiée", DELIVERED: "Livrée", CANCELLED: "Annulée", REFUNDED: "Remboursée" }[order.status as string] || order.status}</p>
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
                      <p className="font-mono text-[11px] text-text-dim">{{ RECU: "Reçu", DIAGNOSTIC: "Diagnostic", DEVIS_ENVOYE: "Devis envoyé", DEVIS_ACCEPTE: "Devis accepté", EN_REPARATION: "En réparation", EN_ATTENTE_PIECE: "En attente pièce", PRET: "Prêt", RECUPERE: "Récupéré" }[ticket.status as string] || ticket.status}</p>
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

        <AddressSection
          addresses={user.addresses || []}
          onUpdate={async () => {
            const meRes = await authApi.me();
            setUser(meRes.data);
          }}
        />
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
              <div role="alert" className="border border-danger/30 bg-danger/10 text-danger px-4 py-3 font-mono text-sm mb-6">
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
                  <a
                    href="/mot-de-passe-oublie"
                    className="mt-2 inline-block font-mono text-xs text-text-muted underline hover:text-text"
                  >
                    Mot de passe oublié ?
                  </a>
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
                  <label className="spec-label block mb-2">Téléphone</label>
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
