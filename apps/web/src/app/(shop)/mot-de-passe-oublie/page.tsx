"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { authApi } from "@/lib/api";
import { brand } from "@/lib/brand";
import type { Metadata } from "next";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/mon-compte"
          className="inline-flex items-center gap-2 font-mono text-xs text-text-muted hover:text-text mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la connexion
        </Link>

        <h1 className="font-mono text-2xl font-bold tracking-tighter mb-2">
          MOT DE PASSE OUBLIÉ
        </h1>
        <p className="font-mono text-sm text-text-muted mb-8">
          Entrez votre adresse email, nous vous enverrons un lien de réinitialisation.
        </p>

        {sent ? (
          <div className="card-dark p-6 text-center">
            <Mail className="w-10 h-10 text-neon mx-auto mb-4" />
            <h2 className="font-mono text-lg font-bold mb-2">Email envoyé</h2>
            <p className="font-mono text-sm text-text-muted">
              Si un compte existe avec cette adresse, vous recevrez un email avec un lien
              de réinitialisation. Vérifiez vos spams si vous ne le voyez pas.
            </p>
            <Link
              href="/mon-compte"
              className="btn-neon inline-block mt-6"
            >
              RETOUR À LA CONNEXION
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card-dark p-6 space-y-4">
            {error && (
              <div role="alert" className="font-mono text-xs text-red-400 bg-red-400/10 p-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="reset-email" className="block font-mono text-xs text-text-muted mb-1">
                Adresse email
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-dark w-full"
                placeholder="votre@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-neon w-full disabled:opacity-50"
            >
              {loading ? "ENVOI EN COURS..." : "ENVOYER LE LIEN"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
