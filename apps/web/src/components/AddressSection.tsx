"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { addressesApi, type Address } from "@/lib/api";

interface AddressSectionProps {
  addresses: Address[];
  onUpdate: () => Promise<void>;
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  street: "",
  street2: "",
  city: "",
  postalCode: "",
  country: "FR",
  phone: "",
  label: "",
  type: "SHIPPING" as "SHIPPING" | "BILLING",
  isDefault: false,
};

type AddressForm = typeof EMPTY_FORM;

export default function AddressSection({ addresses, onUpdate }: AddressSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError("");
  }

  function startEdit(address: Address) {
    setForm({
      firstName: address.firstName,
      lastName: address.lastName,
      street: address.street,
      street2: address.street2 || "",
      city: address.city,
      postalCode: address.postalCode,
      country: address.country || "FR",
      phone: address.phone || "",
      label: address.label || "",
      type: (address.type as "SHIPPING" | "BILLING") || "SHIPPING",
      isDefault: address.isDefault || false,
    });
    setEditingId(address.id);
    setShowForm(true);
    setError("");
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        ...form,
        street2: form.street2 || undefined,
        phone: form.phone || undefined,
        label: form.label || undefined,
      };

      if (editingId) {
        await addressesApi.update(editingId, payload);
      } else {
        await addressesApi.create(payload);
      }

      setShowForm(false);
      setEditingId(null);
      await onUpdate();
    } catch {
      setError("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette adresse ?")) return;
    try {
      await addressesApi.delete(id);
      await onUpdate();
    } catch {
      setError("Erreur lors de la suppression.");
    }
  }

  function updateField(field: keyof AddressForm, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <section className="bg-surface border border-border p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <p className="spec-label">Adresses</p>
        {!showForm && (
          <button onClick={startCreate} className="inline-flex items-center gap-1 font-mono text-xs text-neon hover:underline">
            <Plus className="w-3 h-3" />
            Ajouter
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="font-mono text-xs text-red-400 bg-red-400/10 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-border p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs font-bold">{editingId ? "Modifier l'adresse" : "Nouvelle adresse"}</p>
            <button type="button" onClick={cancel} className="text-text-muted hover:text-text">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="addr-firstName" className="block font-mono text-xs text-text-muted mb-1">Prénom</label>
              <input id="addr-firstName" type="text" required value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} className="input-dark w-full" />
            </div>
            <div>
              <label htmlFor="addr-lastName" className="block font-mono text-xs text-text-muted mb-1">Nom</label>
              <input id="addr-lastName" type="text" required value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} className="input-dark w-full" />
            </div>
          </div>

          <div>
            <label htmlFor="addr-street" className="block font-mono text-xs text-text-muted mb-1">Adresse</label>
            <input id="addr-street" type="text" required value={form.street} onChange={(e) => updateField("street", e.target.value)} className="input-dark w-full" />
          </div>

          <div>
            <label htmlFor="addr-street2" className="block font-mono text-xs text-text-muted mb-1">Complément</label>
            <input id="addr-street2" type="text" value={form.street2} onChange={(e) => updateField("street2", e.target.value)} className="input-dark w-full" placeholder="Bâtiment, étage, etc." />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="addr-postalCode" className="block font-mono text-xs text-text-muted mb-1">Code postal</label>
              <input id="addr-postalCode" type="text" required value={form.postalCode} onChange={(e) => updateField("postalCode", e.target.value)} className="input-dark w-full" />
            </div>
            <div>
              <label htmlFor="addr-city" className="block font-mono text-xs text-text-muted mb-1">Ville</label>
              <input id="addr-city" type="text" required value={form.city} onChange={(e) => updateField("city", e.target.value)} className="input-dark w-full" />
            </div>
            <div>
              <label htmlFor="addr-phone" className="block font-mono text-xs text-text-muted mb-1">Téléphone</label>
              <input id="addr-phone" type="tel" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className="input-dark w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="addr-label" className="block font-mono text-xs text-text-muted mb-1">Libellé</label>
              <input id="addr-label" type="text" value={form.label} onChange={(e) => updateField("label", e.target.value)} className="input-dark w-full" placeholder="Maison, Bureau..." />
            </div>
            <div>
              <label htmlFor="addr-type" className="block font-mono text-xs text-text-muted mb-1">Type</label>
              <select id="addr-type" value={form.type} onChange={(e) => updateField("type", e.target.value)} className="input-dark w-full">
                <option value="SHIPPING">Livraison</option>
                <option value="BILLING">Facturation</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 font-mono text-xs text-text-muted cursor-pointer">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => updateField("isDefault", e.target.checked)} />
            Adresse par défaut
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-neon disabled:opacity-50">
              {saving ? "Enregistrement..." : "ENREGISTRER"}
            </button>
            <button type="button" onClick={cancel} className="btn-outline">
              ANNULER
            </button>
          </div>
        </form>
      )}

      {addresses.length === 0 && !showForm ? (
        <p className="font-mono text-sm text-text-muted">Aucune adresse enregistrée.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div key={address.id} className="border border-border p-4 relative group">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(address)}
                  className="p-1 text-text-muted hover:text-neon"
                  title="Modifier"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(address.id)}
                  className="p-1 text-text-muted hover:text-red-400"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {address.label && (
                <p className="font-mono text-[11px] text-neon mb-1">{address.label}</p>
              )}
              <p className="font-mono text-xs text-text mb-1">
                {address.firstName} {address.lastName}
              </p>
              <p className="font-mono text-xs text-text-dim">{address.street}</p>
              {address.street2 && (
                <p className="font-mono text-xs text-text-dim">{address.street2}</p>
              )}
              <p className="font-mono text-xs text-text-dim">
                {address.postalCode} {address.city}
              </p>
              {address.isDefault && (
                <span className="inline-block mt-2 font-mono text-[10px] text-neon border border-neon/30 px-1.5 py-0.5">
                  PAR DÉFAUT
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
