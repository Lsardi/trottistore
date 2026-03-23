"use client";

import { useState } from "react";
import { LogIn, UserPlus, Loader2, Mail, Lock, Phone, User } from "lucide-react";
import { authApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function MonComptePage() {
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
      window.location.href = "/mon-compte";
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
      window.location.href = "/mon-compte";
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
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors relative",
                mode === "login"
                  ? "text-teal-600"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <LogIn className="w-4 h-4" />
              Connexion
              {mode === "login" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
              )}
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors relative",
                mode === "register"
                  ? "text-teal-600"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <UserPlus className="w-4 h-4" />
              Creer un compte
              {mode === "register" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
              )}
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
                {error}
              </div>
            )}

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="votre@email.fr"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      required
                      placeholder="Votre mot de passe"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-500 text-white py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-teal-500/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    "Se connecter"
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Prenom
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="Jean"
                        value={registerForm.firstName}
                        onChange={(e) =>
                          setRegisterForm({ ...registerForm, firstName: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                    <input
                      type="text"
                      required
                      placeholder="Dupont"
                      value={registerForm.lastName}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, lastName: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="votre@email.fr"
                      value={registerForm.email}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, email: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Telephone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="06 12 34 56 78"
                      value={registerForm.phone}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, phone: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="Minimum 8 caracteres"
                      value={registerForm.password}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, password: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Minimum 8 caracteres</p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-500 text-white py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-teal-500/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Inscription...
                    </>
                  ) : (
                    "Creer mon compte"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          En continuant, vous acceptez nos conditions generales de vente.
        </p>
      </div>
    </div>
  );
}
