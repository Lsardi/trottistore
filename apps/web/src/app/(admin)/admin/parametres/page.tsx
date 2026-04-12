"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, CheckCircle } from "lucide-react";

interface SiteSettings {
  legal?: {
    siret?: string;
    rcs?: string;
    capital?: string;
    legalForm?: string;
    director?: string;
    tvaIntracom?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
    dpoEmail?: string;
  };
}

export default function AdminParametresPage() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/admin/settings")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setSettings(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  function updateLegal(field: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      legal: { ...prev.legal, [field]: value },
    }));
    setSaved(false);
  }

  function updateContact(field: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      contact: { ...prev.contact, [field]: value },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/v1/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error?.message || "Erreur lors de la sauvegarde");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-neon" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-md">Paramètres du site</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Ces informations apparaissent sur les mentions légales et les factures.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-neon disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "ENREGISTRÉ" : "ENREGISTRER"}
        </button>
      </div>

      {error && (
        <div role="alert" className="font-mono text-xs text-red-400 bg-red-400/10 p-3 rounded">
          {error}
        </div>
      )}

      {/* Informations légales */}
      <section className="bg-surface border border-border p-6">
        <p className="spec-label mb-4">Informations légales</p>
        <p className="font-mono text-[11px] text-text-dim mb-4">
          Obligatoires pour la vente en ligne (LCEN art. 6-III). Apparaissent sur la page Mentions légales et les factures PDF.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="legal-siret" className="block font-mono text-xs text-text-muted mb-1">
              SIRET
            </label>
            <input
              id="legal-siret"
              type="text"
              value={settings.legal?.siret || ""}
              onChange={(e) => updateLegal("siret", e.target.value)}
              className="input-dark w-full"
              placeholder="123 456 789 00012"
            />
          </div>
          <div>
            <label htmlFor="legal-rcs" className="block font-mono text-xs text-text-muted mb-1">
              RCS
            </label>
            <input
              id="legal-rcs"
              type="text"
              value={settings.legal?.rcs || ""}
              onChange={(e) => updateLegal("rcs", e.target.value)}
              className="input-dark w-full"
              placeholder="RCS Bobigny B 123 456 789"
            />
          </div>
          <div>
            <label htmlFor="legal-form" className="block font-mono text-xs text-text-muted mb-1">
              Forme juridique
            </label>
            <select
              id="legal-form"
              value={settings.legal?.legalForm || ""}
              onChange={(e) => updateLegal("legalForm", e.target.value)}
              className="input-dark w-full"
            >
              <option value="">Sélectionner...</option>
              <option value="Auto-entrepreneur">Auto-entrepreneur</option>
              <option value="EIRL">EIRL</option>
              <option value="SARL">SARL</option>
              <option value="SAS">SAS</option>
              <option value="SASU">SASU</option>
              <option value="SA">SA</option>
            </select>
          </div>
          <div>
            <label htmlFor="legal-capital" className="block font-mono text-xs text-text-muted mb-1">
              Capital social
            </label>
            <input
              id="legal-capital"
              type="text"
              value={settings.legal?.capital || ""}
              onChange={(e) => updateLegal("capital", e.target.value)}
              className="input-dark w-full"
              placeholder="10 000 €"
            />
          </div>
          <div>
            <label htmlFor="legal-director" className="block font-mono text-xs text-text-muted mb-1">
              Directeur de publication
            </label>
            <input
              id="legal-director"
              type="text"
              value={settings.legal?.director || ""}
              onChange={(e) => updateLegal("director", e.target.value)}
              className="input-dark w-full"
              placeholder="Prénom Nom"
            />
          </div>
          <div>
            <label htmlFor="legal-tva" className="block font-mono text-xs text-text-muted mb-1">
              TVA intracommunautaire
            </label>
            <input
              id="legal-tva"
              type="text"
              value={settings.legal?.tvaIntracom || ""}
              onChange={(e) => updateLegal("tvaIntracom", e.target.value)}
              className="input-dark w-full"
              placeholder="FR XX XXX XXX XXX"
            />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-surface border border-border p-6">
        <p className="spec-label mb-4">Contact</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="contact-email" className="block font-mono text-xs text-text-muted mb-1">
              Email principal
            </label>
            <input
              id="contact-email"
              type="email"
              value={settings.contact?.email || ""}
              onChange={(e) => updateContact("email", e.target.value)}
              className="input-dark w-full"
              placeholder="contact@trottistore.fr"
            />
          </div>
          <div>
            <label htmlFor="contact-phone" className="block font-mono text-xs text-text-muted mb-1">
              Téléphone
            </label>
            <input
              id="contact-phone"
              type="tel"
              value={settings.contact?.phone || ""}
              onChange={(e) => updateContact("phone", e.target.value)}
              className="input-dark w-full"
              placeholder="06 04 46 30 55"
            />
          </div>
          <div>
            <label htmlFor="contact-dpo" className="block font-mono text-xs text-text-muted mb-1">
              Email DPO (RGPD)
            </label>
            <input
              id="contact-dpo"
              type="email"
              value={settings.contact?.dpoEmail || ""}
              onChange={(e) => updateContact("dpoEmail", e.target.value)}
              className="input-dark w-full"
              placeholder="dpo@trottistore.fr"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
