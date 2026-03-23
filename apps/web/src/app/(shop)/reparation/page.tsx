"use client";

import { useState } from "react";
import { repairsApi } from "@/lib/api";

const TICKET_TYPES = [
  { value: "REPARATION", label: "Réparation" },
  { value: "GARANTIE", label: "Sous garantie" },
  { value: "RETOUR", label: "Retour produit" },
  { value: "RECLAMATION", label: "Réclamation" },
] as const;

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
      setError("Erreur lors de la soumission. Veuillez réessayer ou nous contacter directement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Réparation & SAV</h1>
      <p className="text-gray-600 mb-8">
        Déposez votre demande de réparation en ligne. Notre atelier à L&apos;Île-Saint-Denis
        répare toutes les marques de trottinettes électriques.
      </p>

      {/* Étapes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        {[
          { step: "1", title: "Décrivez", desc: "Remplissez le formulaire" },
          { step: "2", title: "Diagnostic", desc: "Nous analysons le problème" },
          { step: "3", title: "Devis", desc: "Estimation gratuite envoyée" },
          { step: "4", title: "Réparation", desc: "Intervention et livraison" },
        ].map((s) => (
          <div key={s.step} className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">
              {s.step}
            </div>
            <p className="font-semibold text-gray-900 text-sm">{s.title}</p>
            <p className="text-xs text-gray-500">{s.desc}</p>
          </div>
        ))}
      </div>

      {success ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-2xl font-bold text-green-800 mb-2">
            Ticket créé avec succès !
          </h2>
          <p className="text-green-700 mb-4">
            Votre numéro de ticket : <span className="font-mono font-bold">SAV-{String(success.ticketNumber).padStart(4, "0")}</span>
          </p>
          <p className="text-sm text-green-600">
            Nous vous contacterons sous 24-48h pour le diagnostic.
          </p>
          <button
            onClick={() => setSuccess(null)}
            className="mt-6 text-blue-600 hover:underline text-sm"
          >
            Déposer une autre demande
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Modèle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modèle de trottinette *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Dualtron Thunder 2, Xiaomi Pro 2, Ninebot Max G30..."
              value={formData.productModel}
              onChange={(e) => setFormData({ ...formData, productModel: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Numéro de série */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numéro de série (optionnel)
            </label>
            <input
              type="text"
              placeholder="Visible sous le deck ou sur la colonne de direction"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de demande *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TICKET_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: t.value })}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition ${
                    formData.type === t.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description du problème *
            </label>
            <textarea
              required
              rows={5}
              placeholder="Décrivez le problème en détail : quand est-ce apparu ? Quels symptômes ? La trottinette démarre-t-elle encore ?"
              value={formData.issueDescription}
              onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-500 transition disabled:opacity-50"
          >
            {submitting ? "Envoi en cours..." : "Envoyer ma demande"}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Diagnostic gratuit. Aucun engagement avant acceptation du devis.
          </p>
        </form>
      )}
    </div>
  );
}
