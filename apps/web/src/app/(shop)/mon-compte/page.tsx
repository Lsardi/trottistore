"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function MonComptePage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/mon-compte";
  const [mode, setMode] = useState<"login" | "register">("login");
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
      // Auto-login apres inscription
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

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-surface border border-border overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={cn(
                "flex-1 py-4 font-mono text-xs uppercase tracking-widest transition-colors relative",
                mode === "login"
                  ? "text-neon"
                  : "text-text-dim hover:text-text-muted"
              )}
            >
              CONNEXION
              {mode === "login" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-neon" />
              )}
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={cn(
                "flex-1 py-4 font-mono text-xs uppercase tracking-widest transition-colors relative",
                mode === "register"
                  ? "text-neon"
                  : "text-text-dim hover:text-text-muted"
              )}
            >
              INSCRIPTION
              {mode === "register" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-neon" />
              )}
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
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-neon w-full mt-2 disabled:opacity-50"
                >
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
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, firstName: e.target.value })
                      }
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
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, lastName: e.target.value })
                      }
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
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, email: e.target.value })
                    }
                    className="input-dark w-full"
                  />
                </div>
                <div>
                  <label className="spec-label block mb-2">Telephone</label>
                  <input
                    type="tel"
                    placeholder="06 12 34 56 78"
                    value={registerForm.phone}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, phone: e.target.value })
                    }
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
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, password: e.target.value })
                    }
                    className="input-dark w-full"
                  />
                  <p className="font-mono text-xs text-text-dim mt-1.5">Minimum 8 caracteres</p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-neon w-full mt-2 disabled:opacity-50"
                >
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

        {/* Footer note */}
        <p className="text-center font-mono text-xs text-text-dim mt-6">
          En continuant, vous acceptez nos conditions generales de vente.
        </p>
      </div>
    </div>
  );
}
