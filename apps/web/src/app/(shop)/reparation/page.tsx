"use client";

import { useState } from "react";
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
  { value: "REPARATION", label: "Reparation", desc: "Panne ou dysfonctionnement" },
  { value: "GARANTIE", label: "Sous garantie", desc: "Produit encore garanti" },
  { value: "RETOUR", label: "Retour produit", desc: "Retour ou echange" },
  { value: "RECLAMATION", label: "Reclamation", desc: "Probleme de commande" },
] as const;

const STEPS = [
  { icon: FileText, title: "Decrivez" },
  { icon: Search, title: "Diagnostic" },
  { icon: Receipt, title: "Devis" },
  { icon: Wrench, title: "Reparation" },
];

export default function ReparationPage() {
  const [formData, setFormData] = useState({
    productModel: "",
    serialNumber: "",
    type: "REPARATION",
    issueDescription: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ ticketNumber: number } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await repairsApi.create(formData);
      setSuccess({ ticketNumber: res.data.ticketNumber });
      setFormData({ productModel: "", serialNumber: "", type: "REPARATION", issueDescription: "" });
    } catch {
      setError("Erreur lors de la soumission. Veuillez reessayer ou nous contacter directement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="text-center mb-10">
        <h1 className="heading-lg mb-3">REPARATION SAV</h1>
        <p className="font-mono text-sm text-text-muted max-w-lg mx-auto">
          Deposez votre demande de reparation en ligne. Notre atelier a {brand.address.city}{" "}
          repare toutes les marques.
        </p>
      </div>

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
          {/* Product model */}
          <div>
            <label className="spec-label block mb-2">
              Modele de trottinette <span className="text-danger">*</span>
            </label>
            <input
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
            <label className="spec-label block mb-2">
              Numero de serie <span className="text-text-dim font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              placeholder="Visible sous le deck ou sur la colonne de direction"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="input-dark w-full"
            />
          </div>

          {/* Type */}
          <div>
            <label className="spec-label block mb-3">
              Type de demande <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
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
                      <span className="badge badge-neon">Selectionne</span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-text-dim mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="spec-label block mb-2">
              Description du probleme <span className="text-danger">*</span>
            </label>
            <textarea
              required
              rows={5}
              placeholder="Decrivez le probleme en detail : quand est-ce apparu ? Quels symptomes ? La trottinette demarre-t-elle encore ?"
              value={formData.issueDescription}
              onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
              className="input-dark w-full resize-none"
            />
          </div>

          {error && (
            <div className="border border-danger/30 bg-danger/10 text-danger px-4 py-3 font-mono text-sm">
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
