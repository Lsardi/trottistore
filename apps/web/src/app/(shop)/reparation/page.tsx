"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Search,
  Receipt,
  Wrench,
  CheckCircle2,
  Send,
  Loader2,
} from "lucide-react";
import { repairsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";

const TICKET_TYPES = [
  { value: "REPARATION", label: "Réparation", desc: "Panne ou dysfonctionnement" },
  { value: "GARANTIE", label: "Sous garantie", desc: "Produit encore garanti" },
  { value: "RETOUR", label: "Retour produit", desc: "Retour ou échange" },
  { value: "RECLAMATION", label: "Réclamation", desc: "Problème de commande" },
] as const;

const STEPS = [
  { icon: FileText, title: "Décrivez" },
  { icon: Search, title: "Diagnostic" },
  { icon: Receipt, title: "Devis" },
  { icon: Wrench, title: "Réparation" },
];

const SEO_ISSUE_LINKS = [
  { label: "Trottinette ne démarre plus", slug: "trottinette-ne-demarre-plus" },
  { label: "Pneu crevé trottinette", slug: "pneu-creve-trottinette" },
  { label: "Frein trottinette ne freine plus", slug: "frein-trottinette-ne-freine-plus" },
  { label: "Batterie ne charge plus", slug: "batterie-trottinette-ne-charge-plus" },
  { label: "Guidon qui bouge", slug: "guidon-trottinette-qui-bouge" },
] as const;

export default function ReparationPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neon" /></div>}>
      <ReparationPage />
    </Suspense>
  );
}

function ReparationPage() {
  const searchParams = useSearchParams();

  // Diagnostic data passed from /diagnostic
  const diagInfo = {
    issue: searchParams.get("issue") || "",
    diagnosis: searchParams.get("diag") || "",
    cost: searchParams.get("cost") || "",
    duration: searchParams.get("duration") || "",
    category: searchParams.get("category") || "",
  };
  const hasDiag = !!diagInfo.diagnosis;

  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    productModel: "",
    serialNumber: "",
    type: "REPARATION",
    issueDescription: diagInfo.issue
      ? `${diagInfo.issue}${diagInfo.diagnosis ? ` — Diagnostic en ligne : ${diagInfo.diagnosis}` : ""}`
      : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ ticketNumber: number; trackingUrl?: string } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await repairsApi.create(formData);
      setSuccess({ ticketNumber: res.data.ticketNumber, trackingUrl: res.data.trackingUrl });
      setFormData({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        productModel: "",
        serialNumber: "",
        type: "REPARATION",
        issueDescription: "",
      });
    } catch {
      setError("Erreur lors de la soumission. Veuillez réessayer ou nous contacter directement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="text-center mb-10">
        <h1 className="heading-lg mb-3">RÉPARATION SAV</h1>
        <p className="font-mono text-sm text-text-muted max-w-lg mx-auto">
          Déposez votre demande de réparation en ligne. Notre atelier à {brand.address.city}{" "}
          répare toutes les marques.
        </p>
      </div>

      <section className="bg-surface border border-border p-5 mb-8">
        <p className="spec-label mb-3">PANNES COURANTES</p>
        <div className="flex flex-wrap gap-2">
          {SEO_ISSUE_LINKS.map((item) => (
            <Link
              key={item.slug}
              href={`/reparation/${item.slug}`}
              className="font-mono text-xs px-3 py-1.5 border border-border hover:border-neon text-text-muted hover:text-neon transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Steps */}
      <div className="flex items-center justify-center gap-0 mb-12">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex items-center">
            <div className="text-center px-4">
              <span
                className={cn(
                  "font-mono text-xs uppercase tracking-widest",
                  i === 0 ? "text-neon" : "text-text-dim"
                )}
              >
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="font-mono text-text-dim">&mdash;</span>
            )}
          </div>
        ))}
      </div>

      {/* Diagnostic summary banner */}
      {hasDiag && !success && (
        <div className="mb-8 border border-neon/30 bg-neon-dim/50 overflow-hidden">
          <div className="px-5 py-3 bg-neon/10 border-b border-neon/20 flex items-center gap-2">
            <Search className="w-4 h-4 text-neon" />
            <span className="font-display font-bold text-neon text-sm uppercase">Diagnostic en ligne</span>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="spec-label mb-1">Symptôme</p>
              <p className="font-mono text-sm text-text">{diagInfo.issue}</p>
            </div>
            <div>
              <p className="spec-label mb-1">Diagnostic</p>
              <p className="font-mono text-sm text-text">{diagInfo.diagnosis}</p>
            </div>
            <div>
              <p className="spec-label mb-1">Coût estimé</p>
              <p className="font-mono text-sm font-bold text-neon">{diagInfo.cost}</p>
            </div>
            <div>
              <p className="spec-label mb-1">Durée estimée</p>
              <p className="font-mono text-sm text-text">{diagInfo.duration}</p>
            </div>
          </div>
          <div className="px-5 pb-3">
            <p className="font-mono text-xs text-text-dim">
              Prix indicatif. Le devis final sera établi après examen en atelier.
            </p>
          </div>
        </div>
      )}

      {success ? (
        <div className="bg-surface border border-border p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-neon" />
          </div>
          <h2 className="heading-md text-neon mb-2">
            Ticket cree avec succes
          </h2>
          <p className="font-mono text-sm text-text-muted mb-4">
            Votre numero de ticket :{" "}
            <span className="font-mono font-bold text-neon bg-neon-dim px-2 py-0.5">
              SAV-{String(success.ticketNumber).padStart(4, "0")}
            </span>
          </p>
          {success.trackingUrl ? (
            <p className="font-mono text-xs text-text mb-6">
              Suivi en temps reel :{" "}
              <Link href={success.trackingUrl} className="text-neon hover:underline">
                ouvrir le suivi
              </Link>
            </p>
          ) : null}
          <p className="font-mono text-xs text-text-dim mb-6">
            Nous vous contacterons sous 24-48h pour le diagnostic.
          </p>
          <button
            onClick={() => setSuccess(null)}
            className="font-mono text-sm text-neon hover:underline transition-colors"
          >
            Deposer une autre demande
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="repair-name" className="spec-label block mb-2">
                Nom complet <span className="text-danger">*</span>
              </label>
              <input
                id="repair-name"
                type="text"
                required
                placeholder="Nom Prénom"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="input-dark w-full"
              />
            </div>
            <div>
              <label htmlFor="repair-phone" className="spec-label block mb-2">
                Téléphone <span className="text-danger">*</span>
              </label>
              <input
                id="repair-phone"
                type="tel"
                required
                placeholder="06 XX XX XX XX"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="input-dark w-full"
              />
            </div>
          </div>

          <div>
            <label htmlFor="repair-email" className="spec-label block mb-2">
              Email <span className="text-text-dim font-normal">(optionnel)</span>
            </label>
            <input
              id="repair-email"
              type="email"
              placeholder="votre@email.fr"
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
              className="input-dark w-full"
            />
          </div>

          {/* Product model */}
          <div>
            <label htmlFor="repair-model" className="spec-label block mb-2">
              Modèle de trottinette <span className="text-danger">*</span>
            </label>
            <input
              id="repair-model"
              type="text"
              required
              placeholder="Ex: Dualtron Thunder 2, Xiaomi Pro 2, Ninebot Max G30..."
              value={formData.productModel}
              onChange={(e) => setFormData({ ...formData, productModel: e.target.value })}
              className="input-dark w-full"
            />
          </div>

          {/* Serial number */}
          <div>
            <label htmlFor="repair-serial" className="spec-label block mb-2">
              Numéro de série <span className="text-text-dim font-normal">(optionnel)</span>
            </label>
            <input
              id="repair-serial"
              type="text"
              placeholder="Visible sous le deck ou sur la colonne de direction"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="input-dark w-full"
            />
          </div>

          {/* Type */}
          <div>
            <p id="repair-request-type-label" className="spec-label block mb-3">
              Type de demande <span className="text-danger">*</span>
            </p>
            <div role="group" aria-labelledby="repair-request-type-label" className="grid grid-cols-2 gap-3">
              {TICKET_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: t.value })}
                  className={cn(
                    "px-4 py-3.5 border text-left transition-all bg-surface-2",
                    formData.type === t.value
                      ? "border-neon"
                      : "border-border hover:border-text-dim"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "font-mono text-sm font-bold",
                        formData.type === t.value ? "text-neon" : "text-text"
                      )}
                    >
                      {t.label}
                    </p>
                    {formData.type === t.value && (
                      <span className="badge badge-neon">Sélectionné</span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-text-dim mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="repair-description" className="spec-label block mb-2">
              Description du problème <span className="text-danger">*</span>
            </label>
            <textarea
              id="repair-description"
              required
              rows={5}
              placeholder="Décrivez le problème en détail : quand est-ce apparu ? Quels symptômes ? La trottinette démarre-t-elle encore ?"
              value={formData.issueDescription}
              onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
              className="input-dark w-full resize-none"
            />
          </div>

          {error && (
            <div role="alert" className="border border-danger/30 bg-danger/10 text-danger px-4 py-3 font-mono text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-neon w-full py-4 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                ENVOI EN COURS...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                ENVOYER
              </>
            )}
          </button>

          <p className="font-mono text-xs text-text-dim text-center">
            Diagnostic gratuit. Aucun engagement avant acceptation du devis.
          </p>
        </form>
      )}
    </div>
  );
}
