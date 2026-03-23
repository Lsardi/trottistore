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
  ArrowRight,
} from "lucide-react";
import { repairsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const TICKET_TYPES = [
  { value: "REPARATION", label: "Reparation", desc: "Panne ou dysfonctionnement" },
  { value: "GARANTIE", label: "Sous garantie", desc: "Produit encore garanti" },
  { value: "RETOUR", label: "Retour produit", desc: "Retour ou echange" },
  { value: "RECLAMATION", label: "Reclamation", desc: "Probleme de commande" },
] as const;

const STEPS = [
  { icon: FileText, title: "Decrivez", desc: "Remplissez le formulaire" },
  { icon: Search, title: "Diagnostic", desc: "Nous analysons le probleme" },
  { icon: Receipt, title: "Devis", desc: "Estimation gratuite envoyee" },
  { icon: Wrench, title: "Reparation", desc: "Intervention et livraison" },
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
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Reparation & SAV</h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Deposez votre demande de reparation en ligne. Notre atelier a L&apos;Ile-Saint-Denis
          repare toutes les marques de trottinettes electriques.
        </p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className="relative text-center p-5 bg-white rounded-2xl border border-gray-100 shadow-sm"
          >
            <div className="w-10 h-10 bg-teal-500 text-white rounded-xl flex items-center justify-center mx-auto mb-3">
              <s.icon className="w-5 h-5" />
            </div>
            <p className="font-semibold text-gray-900 text-sm mb-0.5">{s.title}</p>
            <p className="text-xs text-gray-400">{s.desc}</p>
            {i < STEPS.length - 1 && (
              <ArrowRight className="hidden md:block absolute top-1/2 -right-3.5 -translate-y-1/2 w-4 h-4 text-gray-300" />
            )}
          </div>
        ))}
      </div>

      {success ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">
            Ticket cree avec succes !
          </h2>
          <p className="text-green-700 mb-4">
            Votre numero de ticket :{" "}
            <span className="font-mono font-bold bg-green-100 px-2 py-0.5 rounded">
              SAV-{String(success.ticketNumber).padStart(4, "0")}
            </span>
          </p>
          <p className="text-sm text-green-600 mb-6">
            Nous vous contacterons sous 24-48h pour le diagnostic.
          </p>
          <button
            onClick={() => setSuccess(null)}
            className="text-teal-600 hover:text-teal-700 font-medium text-sm transition-colors"
          >
            Deposer une autre demande
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Modele de trottinette <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Dualtron Thunder 2, Xiaomi Pro 2, Ninebot Max G30..."
              value={formData.productModel}
              onChange={(e) => setFormData({ ...formData, productModel: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow text-sm"
            />
          </div>

          {/* Serial number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Numero de serie <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              placeholder="Visible sous le deck ou sur la colonne de direction"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow text-sm"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de demande <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TICKET_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: t.value })}
                  className={cn(
                    "px-4 py-3.5 rounded-xl border-2 text-left transition-all",
                    formData.type === t.value
                      ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/20"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      formData.type === t.value ? "text-teal-700" : "text-gray-900"
                    )}
                  >
                    {t.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description du probleme <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={5}
              placeholder="Decrivez le probleme en detail : quand est-ce apparu ? Quels symptomes ? La trottinette demarre-t-elle encore ?"
              value={formData.issueDescription}
              onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow resize-none text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Envoyer ma demande
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Diagnostic gratuit. Aucun engagement avant acceptation du devis.
          </p>
        </form>
      )}
    </div>
  );
}
