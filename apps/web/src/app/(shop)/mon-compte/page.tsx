"use client";

import { useState, Suspense, useMemo } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Award,
  ClipboardList,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  MapPin,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Ticket,
  Wrench,
} from "lucide-react";
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

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "En attente", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  CONFIRMED: { label: "Confirmee", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  PREPARING: { label: "En preparation", color: "text-blue-300", bg: "bg-blue-300/10 border-blue-300/30" },
  SHIPPED: { label: "Expediee", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30" },
  DELIVERED: { label: "Livree", color: "text-neon", bg: "bg-neon/10 border-neon/30" },
  CANCELLED: { label: "Annulee", color: "text-text-dim", bg: "bg-surface-2 border-border" },
  REFUNDED: { label: "Remboursee", color: "text-warning", bg: "bg-warning/10 border-warning/30" },
};

const TIER_GRADIENTS: Record<string, string> = {
  BRONZE: "from-amber-700/30 via-amber-600/10 to-transparent",
  SILVER: "from-gray-400/30 via-gray-300/10 to-transparent",
  GOLD: "from-yellow-500/30 via-yellow-400/10 to-transparent",
};

const TIER_ICONS: Record<string, typeof Award> = {
  BRONZE: Award,
  SILVER: Star,
  GOLD: Crown,
};

const TIER_COLORS: Record<string, string> = {
  BRONZE: "#CD7F32",
  SILVER: "#C0C0C0",
  GOLD: "#FFD700",
};

function PasswordStrengthIndicator({ password }: { password: string }) {
  const strength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4);
  }, [password]);

  if (!password) return null;

  const labels = ["Tres faible", "Faible", "Moyen", "Bon", "Excellent"];
  const colors = ["bg-danger", "bg-warning", "bg-yellow-400", "bg-neon-muted", "bg-neon"];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 transition-all duration-300",
              i < strength ? colors[strength] : "bg-border"
            )}
          />
        ))}
      </div>
      <p className={cn("font-mono text-[10px] uppercase tracking-wider", strength <= 1 ? "text-danger" : strength <= 2 ? "text-yellow-400" : "text-neon")}>
        {labels[strength]}
      </p>
    </div>
  );
}

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
    return role === "SUPERADMIN" || role === "ADMIN" || role === "MANAGER" || role === "TECHNICIAN" || role === "STAFF";
  }
  const searchParams = useSearchParams();
  // Sanitize redirect to prevent open redirect attacks
  const rawNext = searchParams.get("next") || "/mon-compte";
  const nextPath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/mon-compte";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionFeedback, setActionFeedback] = useState("");
  const [pendingVerification, setPendingVerification] = useState<{ userId: string; email: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

        // Sync the garage (localStorage <-> CustomerProfile.scooterModels) so
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
      document.cookie = `accessToken=${res.accessToken}; path=/; max-age=${15 * 60}; SameSite=Strict`;
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
      const regResult = await authApi.register(registerForm);
      // Show email verification step instead of auto-login
      setPendingVerification({ userId: regResult.user.id, email: registerForm.email });
    } catch {
      setError("Erreur lors de l'inscription. Cet email est peut-etre deja utilise.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* best effort */ }
    localStorage.removeItem("accessToken");
    document.cookie = "accessToken=; path=/; max-age=0; SameSite=Strict";
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
    const tierKey = (user.customerProfile?.loyaltyTier || "BRONZE").toUpperCase();
    const TierIcon = TIER_ICONS[tierKey] || Award;
    const tierColor = TIER_COLORS[tierKey] || "#CD7F32";
    const tierGradient = TIER_GRADIENTS[tierKey] || TIER_GRADIENTS.BRONZE;

    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Welcome banner with loyalty tier */}
        <div className={cn("relative border border-border overflow-hidden mb-8 bg-gradient-to-r", tierGradient)}>
          <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 flex items-center justify-center border"
                style={{ borderColor: tierColor + "60", backgroundColor: tierColor + "15" }}
              >
                <TierIcon className="w-7 h-7" style={{ color: tierColor }} />
              </div>
              <div>
                <p className="spec-label mb-1">ESPACE CLIENT</p>
                <h1 className="heading-lg mb-0">
                  {user.firstName} {user.lastName}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 border"
                    style={{ color: tierColor, borderColor: tierColor + "40", backgroundColor: tierColor + "10" }}
                  >
                    {tierKey}
                  </span>
                  <span className="font-mono text-xs text-text-muted">{user.email}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleLogout} className="btn-outline cursor-pointer">
                DECONNEXION
              </button>
            </div>
          </div>
        </div>

        {/* Quick actions row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <Link
            href="/produits"
            className="flex items-center gap-3 bg-surface border border-border p-4 hover:border-neon transition-all duration-200 cursor-pointer group"
          >
            <div className="w-10 h-10 bg-neon/10 border border-neon/20 flex items-center justify-center group-hover:bg-neon/20 transition-colors duration-200">
              <ShoppingBag className="w-5 h-5 text-neon" />
            </div>
            <div>
              <p className="font-mono text-xs text-text font-bold">Nouvelle commande</p>
              <p className="font-mono text-[10px] text-text-dim">Parcourir la boutique</p>
            </div>
          </Link>
          <Link
            href="/reparation"
            className="flex items-center gap-3 bg-surface border border-border p-4 hover:border-neon transition-all duration-200 cursor-pointer group"
          >
            <div className="w-10 h-10 bg-neon/10 border border-neon/20 flex items-center justify-center group-hover:bg-neon/20 transition-colors duration-200">
              <Ticket className="w-5 h-5 text-neon" />
            </div>
            <div>
              <p className="font-mono text-xs text-text font-bold">Deposer ticket SAV</p>
              <p className="font-mono text-[10px] text-text-dim">Reparation en atelier</p>
            </div>
          </Link>
          <Link
            href="#addresses"
            className="flex items-center gap-3 bg-surface border border-border p-4 hover:border-neon transition-all duration-200 cursor-pointer group"
          >
            <div className="w-10 h-10 bg-neon/10 border border-neon/20 flex items-center justify-center group-hover:bg-neon/20 transition-colors duration-200">
              <MapPin className="w-5 h-5 text-neon" />
            </div>
            <div>
              <p className="font-mono text-xs text-text font-bold">Mes adresses</p>
              <p className="font-mono text-[10px] text-text-dim">Gerer mes adresses</p>
            </div>
          </Link>
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
                className="font-mono text-xs text-neon underline cursor-pointer hover:text-neon-muted transition-colors duration-200"
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
                    setProfileMsg("Profil mis a jour.");
                  }
                } catch {
                  setProfileMsg("Erreur lors de la mise a jour.");
                } finally {
                  setProfileSaving(false);
                }
              }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div>
                <label htmlFor="profile-firstName" className="block font-mono text-xs text-text-muted mb-1">Prenom</label>
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
                <label htmlFor="profile-phone" className="block font-mono text-xs text-text-muted mb-1">Telephone</label>
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
                <button type="submit" disabled={profileSaving} className="btn-neon disabled:opacity-50 cursor-pointer">
                  {profileSaving ? "Enregistrement..." : "ENREGISTRER"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="btn-outline cursor-pointer"
                >
                  ANNULER
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="font-mono text-xs text-text-muted">Prenom</p>
                <p className="font-mono text-sm text-text">{user.firstName}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-text-muted">Nom</p>
                <p className="font-mono text-sm text-text">{user.lastName}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-text-muted">Telephone</p>
                <p className="font-mono text-sm text-text">{user.phone || "Non renseigne"}</p>
              </div>
              {profileMsg && (
                <p className="md:col-span-3 font-mono text-xs text-neon">{profileMsg}</p>
              )}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-surface border border-border p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-neon" />
                <p className="spec-label">Dernieres commandes</p>
              </div>
              {orders.length > 0 && (
                <Link
                  href="/mon-compte/commandes"
                  className="font-mono text-[11px] text-neon hover:underline cursor-pointer transition-colors duration-200"
                >
                  Voir tout
                </Link>
              )}
            </div>
            {orders.length === 0 ? (
              <p className="font-mono text-sm text-text-muted">Aucune commande pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 6).map((order) => {
                  const statusKey = order.status as string;
                  const statusConf = ORDER_STATUS_CONFIG[statusKey] || { label: statusKey, color: "text-text-dim", bg: "bg-surface-2 border-border" };
                  return (
                    <Link
                      key={order.id}
                      href="/mon-compte/commandes"
                      className="block border border-border p-3 hover:border-neon transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-mono text-xs text-text font-bold">#{order.orderNumber}</p>
                            <span className={cn("inline-block mt-1 font-mono text-[10px] px-2 py-0.5 border", statusConf.bg, statusConf.color)}>
                              {statusConf.label}
                            </span>
                          </div>
                        </div>
                        <p className="font-mono text-sm text-neon font-bold">{formatPrice(order.totalTtc)}</p>
                      </div>
                    </Link>
                  );
                })}
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
                      <p className="font-mono text-[11px] text-text-dim">{{ RECU: "Recu", DIAGNOSTIC: "Diagnostic", DEVIS_ENVOYE: "Devis envoye", DEVIS_ACCEPTE: "Devis accepte", EN_REPARATION: "En reparation", EN_ATTENTE_PIECE: "En attente piece", PRET: "Pret", RECUPERE: "Recupere" }[ticket.status as string] || ticket.status}</p>
                      {ticket.trackingToken ? (
                        <Link
                          href={`/mon-compte/suivi/${ticket.trackingToken}`}
                          className="font-mono text-[11px] text-neon hover:underline cursor-pointer transition-colors duration-200"
                        >
                          Suivi en temps reel
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

        <div id="addresses">
          <AddressSection
            addresses={user.addresses || []}
            onUpdate={async () => {
              const meRes = await authApi.me();
              setUser(meRes.data);
            }}
          />
        </div>

        {/* Account management — bottom section */}
        <div className="mt-8 border-t border-border pt-6 flex flex-wrap items-center gap-4">
          <button
            onClick={async () => {
              setActionFeedback("");
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
                setActionFeedback("Erreur lors de l'export. Reessayez.");
              }
            }}
            className="font-mono text-xs text-text-dim underline cursor-pointer hover:text-text-muted transition-colors duration-200"
          >
            Exporter mes donnees
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="font-mono text-xs text-red-400 underline cursor-pointer hover:text-red-300 transition-colors duration-200"
          >
            Supprimer mon compte
          </button>
          {actionFeedback && (
            <p className="font-mono text-xs text-red-400" role="alert">{actionFeedback}</p>
          )}
        </div>
        {showDeleteConfirm && (
          <div className="mt-4 border border-red-400/30 bg-red-400/5 p-4 space-y-3">
            <p className="font-mono text-xs text-text">
              Etes-vous sur de vouloir supprimer votre compte ? Cette action est irreversible.
              Toutes vos donnees personnelles seront effacees.
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await fetch("/api/v1/auth/account", {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
                    });
                    localStorage.removeItem("accessToken");
                    window.location.href = "/";
                  } catch {
                    setActionFeedback("Erreur lors de la suppression. Contactez-nous.");
                  }
                  setShowDeleteConfirm(false);
                }}
                className="btn-outline text-red-400 border-red-400/30 font-mono text-xs cursor-pointer"
              >
                CONFIRMER LA SUPPRESSION
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-outline font-mono text-xs cursor-pointer"
              >
                ANNULER
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Email verification step after registration
  if (pendingVerification) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-surface border border-border p-8 space-y-6">
            <div className="text-center">
              <h1 className="heading-lg mb-2">VERIFICATION EMAIL</h1>
              <p className="font-mono text-sm text-text-muted">
                Un code a 6 chiffres a ete envoye a <span className="text-neon">{pendingVerification.email}</span>
              </p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setVerifyError("");
                try {
                  await fetch("/api/v1/auth/verify-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: pendingVerification.userId, code: verifyCode }),
                  }).then(async (r) => {
                    if (!r.ok) throw new Error((await r.json()).error?.message || "Code invalide");
                  });
                  // Verified — now login
                  const res = await authApi.login({
                    email: pendingVerification.email,
                    password: registerForm.password,
                  });
                  localStorage.setItem("accessToken", res.accessToken);
      document.cookie = `accessToken=${res.accessToken}; path=/; max-age=${15 * 60}; SameSite=Strict`;
                  window.location.href = isBackofficeRole(res.user?.role) ? "/admin" : nextPath;
                } catch (err) {
                  setVerifyError(err instanceof Error ? err.message : "Code invalide ou expire");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="verify-code" className="spec-label mb-2 block">Code de verification</label>
                <input
                  id="verify-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  className="input-dark w-full text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  autoFocus
                />
              </div>
              {verifyError && <p className="font-mono text-xs text-danger" role="alert">{verifyError}</p>}
              <button type="submit" disabled={verifyCode.length !== 6} className="btn-neon w-full disabled:opacity-50 cursor-pointer">
                VERIFIER
              </button>
            </form>
            <div className="text-center space-y-2">
              <button
                onClick={async () => {
                  await fetch("/api/v1/auth/resend-verification", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: pendingVerification.userId }),
                  });
                  setVerifyError("Nouveau code envoye !");
                }}
                className="font-mono text-xs text-neon underline cursor-pointer"
              >
                Renvoyer le code
              </button>
              <br />
              <button
                onClick={() => setPendingVerification(null)}
                className="font-mono text-xs text-text-dim underline cursor-pointer"
              >
                Retour a l&apos;inscription
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Login icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-neon/10 border border-neon/20 flex items-center justify-center">
            <LogIn className="w-7 h-7 text-neon" />
          </div>
        </div>

        <div className="bg-surface border border-border overflow-hidden">
          {/* Tab design with neon underline */}
          <div className="flex border-b border-border">
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={cn(
                "flex-1 py-4 font-mono text-xs uppercase tracking-widest transition-all duration-200 relative cursor-pointer",
                mode === "login" ? "text-neon" : "text-text-dim hover:text-text-muted"
              )}
            >
              CONNEXION
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-300",
                  mode === "login" ? "bg-neon shadow-[0_0_10px_rgba(0,255,209,0.5)]" : "bg-transparent"
                )}
              />
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={cn(
                "flex-1 py-4 font-mono text-xs uppercase tracking-widest transition-all duration-200 relative cursor-pointer",
                mode === "register" ? "text-neon" : "text-text-dim hover:text-text-muted"
              )}
            >
              INSCRIPTION
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-300",
                  mode === "register" ? "bg-neon shadow-[0_0_10px_rgba(0,255,209,0.5)]" : "bg-transparent"
                )}
              />
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <div role="alert" className="flex items-center gap-2 border border-danger/30 bg-danger/10 text-danger px-4 py-3 font-mono text-sm mb-6">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Votre mot de passe"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="input-dark w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors duration-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <a
                    href="/mot-de-passe-oublie"
                    className="mt-2 inline-block font-mono text-xs text-text-muted underline hover:text-neon transition-colors duration-200"
                  >
                    Mot de passe oublie ?
                  </a>
                </div>
                <button type="submit" disabled={loading} className="btn-neon w-full mt-2 disabled:opacity-50 cursor-pointer">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      CONNEXION...
                    </>
                  ) : (
                    "SE CONNECTER"
                  )}
                </button>

                {/* Social-style divider */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">Acces securise</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="flex items-center justify-center gap-2 font-mono text-[11px] text-text-dim">
                  <ShieldCheck className="w-3.5 h-3.5 text-neon" />
                  <span>Connexion chiffree TLS</span>
                </div>
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
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Minimum 8 caracteres"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="input-dark w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors duration-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrengthIndicator password={registerForm.password} />
                </div>
                <button type="submit" disabled={loading} className="btn-neon w-full mt-2 disabled:opacity-50 cursor-pointer">
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
