"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="card-dark p-6 text-center">
        <p className="font-mono text-sm text-red-400">
          Lien invalide. Veuillez refaire une demande de réinitialisation.
        </p>
        <Link href="/mot-de-passe-oublie" className="btn-neon inline-block mt-4">
          NOUVELLE DEMANDE
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.resetPassword({ token: token!, newPassword: password });
      if (res.success) {
        setSuccess(true);
      } else {
        setError("Ce lien est invalide ou a expiré.");
      }
    } catch {
      setError("Ce lien est invalide ou a expiré. Veuillez refaire une demande.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="card-dark p-6 text-center">
        <CheckCircle className="w-10 h-10 text-neon mx-auto mb-4" />
        <h2 className="font-mono text-lg font-bold mb-2">Mot de passe mis à jour</h2>
        <p className="font-mono text-sm text-text-muted">
          Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
        </p>
        <Link href="/mon-compte" className="btn-neon inline-block mt-6">
          SE CONNECTER
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-dark p-6 space-y-4">
      {error && (
        <div role="alert" className="font-mono text-xs text-red-400 bg-red-400/10 p-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="new-password" className="block font-mono text-xs text-text-muted mb-1">
          Nouveau mot de passe
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-dark w-full"
          placeholder="Minimum 8 caractères"
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="block font-mono text-xs text-text-muted mb-1">
          Confirmer le mot de passe
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input-dark w-full"
          placeholder="Répétez le mot de passe"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-neon w-full disabled:opacity-50"
      >
        {loading ? "MISE À JOUR..." : "METTRE À JOUR LE MOT DE PASSE"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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

        <h1 className="font-mono text-2xl font-bold tracking-tighter mb-8">
          NOUVEAU MOT DE PASSE
        </h1>

        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-neon" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
