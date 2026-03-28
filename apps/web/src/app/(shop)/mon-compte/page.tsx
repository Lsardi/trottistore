"use client";

import { useState, Suspense } from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Loader2, Wrench } from "lucide-react";
import {
  ApiError,
  authApi,
  ordersApi,
  repairsApi,
  type Order,
  type RepairTicket,
  type User,
} from "@/lib/api";
import { cn } from "@/lib/utils";

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
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/mon-compte";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
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
      } catch (err) {
        localStorage.removeItem("accessToken");
        if (err instanceof ApiError && err.status !== 401) {
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
      window.location.href = nextPath;
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
      window.location.href = nextPath;
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
          <button onClick={handleLogout} className="btn-outline">
            DECONNEXION
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-surface border border-border p-5">
            <p className="spec-label mb-2">FIDELITE</p>
            <p className="heading-md">{user.customerProfile?.loyaltyTier || "BRONZE"}</p>
            <p className="font-mono text-sm text-neon mt-2">
              {user.customerProfile?.loyaltyPoints ?? 0} points
            </p>
          </div>
          <div className="bg-surface border border-border p-5">
            <p className="spec-label mb-2">COMMANDES</p>
            <p className="heading-md">{user.customerProfile?.totalOrders ?? orders.length}</p>
            <p className="font-mono text-sm text-text-muted mt-2">Total historique</p>
          </div>
          <div className="bg-surface border border-border p-5">
            <p className="spec-label mb-2">DEPENSE CUMULEE</p>
            <p className="heading-md">{formatPrice(user.customerProfile?.totalSpent ?? 0)}</p>
            <p className="font-mono text-sm text-text-muted mt-2">Tous achats confondus</p>
          </div>
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
                    </div>
                    <p className="font-mono text-xs text-text-muted">#{ticket.ticketNumber}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="bg-surface border border-border p-5 mt-6">
          <p className="spec-label mb-4">Adresses</p>
          {!user.addresses || user.addresses.length === 0 ? (
            <p className="font-mono text-sm text-text-muted">Aucune adresse enregistrée.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user.addresses.map((address) => (
                <div key={address.id} className="border border-border p-4">
                  <p className="font-mono text-xs text-text mb-1">
                    {address.firstName} {address.lastName}
                  </p>
                  <p className="font-mono text-xs text-text-dim">{address.street}</p>
                  {address.street2 ? (
                    <p className="font-mono text-xs text-text-dim">{address.street2}</p>
                  ) : null}
                  <p className="font-mono text-xs text-text-dim">
                    {address.postalCode} {address.city}
                  </p>
                  <p className="font-mono text-xs text-text-dim">{address.country}</p>
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
