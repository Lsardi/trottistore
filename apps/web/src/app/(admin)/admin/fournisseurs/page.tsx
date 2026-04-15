"use client";

import { FormEvent, useEffect, useState } from "react";
import { suppliersApi, type Supplier, type SupplierPayload } from "@/lib/api";
import { Loader2, Plus, Save, Search, Truck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminFournisseursPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await suppliersApi.list({
        q: search.trim() || undefined,
        active: activeOnly ? "true" : undefined,
      });
      setSuppliers(res.data || []);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeOnly]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="heading-lg">FOURNISSEURS</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            {suppliers.length} fournisseur{suppliers.length !== 1 ? "s" : ""} · {activeOnly ? "actifs" : "tous"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreatingOpen(true)}
          className="btn-neon inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Nouveau
        </button>
      </div>

      <div className="bg-surface border border-border p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, email…"
            className="input-dark w-full pl-9"
          />
        </div>
        <label className="flex items-center gap-2 font-mono text-xs text-text-muted">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Actifs uniquement
        </label>
      </div>

      <div className="bg-surface border border-border">
        {loading ? (
          <div className="p-6 flex items-center gap-2 font-mono text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-neon" />
            Chargement…
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-8 text-center">
            <Truck className="h-10 w-10 text-text-dim mx-auto mb-3" />
            <p className="font-mono text-sm text-text-muted">Aucun fournisseur.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 spec-label">Nom</th>
                <th className="text-left px-4 py-3 spec-label">Contact</th>
                <th className="text-left px-4 py-3 spec-label">Pays</th>
                <th className="text-left px-4 py-3 spec-label">Conditions</th>
                <th className="text-right px-4 py-3 spec-label">POs</th>
                <th className="text-right px-4 py-3 spec-label">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setEditing(s)}
                  className="hover:bg-surface-2/50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-text">{s.name}</p>
                    <p className="font-mono text-[11px] text-text-dim">{s.slug}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {s.contactEmail || s.contactName || "—"}
                    {s.contactPhone ? <div className="text-text-dim text-[11px]">{s.contactPhone}</div> : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{s.country}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {s.paymentTerms || "—"}
                    {s.leadTimeDays != null ? (
                      <div className="text-text-dim text-[11px]">{s.leadTimeDays}j délai</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-neon">
                    {s._count?.purchaseOrders ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "inline-block font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border",
                        s.isActive
                          ? "text-neon border-neon/40 bg-neon-dim"
                          : "text-text-dim border-border bg-surface-2",
                      )}
                    >
                      {s.isActive ? "Actif" : "Archivé"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(creatingOpen || editing) && (
        <SupplierForm
          supplier={editing}
          onClose={() => {
            setCreatingOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreatingOpen(false);
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ─── Supplier create/edit drawer ─────────────────────────────────

function SupplierForm({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SupplierPayload & { isActive: boolean }>({
    name: supplier?.name ?? "",
    contactName: supplier?.contactName ?? "",
    contactEmail: supplier?.contactEmail ?? "",
    contactPhone: supplier?.contactPhone ?? "",
    website: supplier?.website ?? "",
    country: supplier?.country ?? "FR",
    currency: supplier?.currency ?? "EUR",
    paymentTerms: supplier?.paymentTerms ?? "",
    leadTimeDays: supplier?.leadTimeDays ?? null,
    notes: supplier?.notes ?? "",
    isActive: supplier?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: SupplierPayload = {
        name: form.name.trim(),
        contactName: form.contactName || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        website: form.website || null,
        country: form.country,
        currency: form.currency,
        paymentTerms: form.paymentTerms || null,
        leadTimeDays: form.leadTimeDays,
        notes: form.notes || null,
        isActive: form.isActive,
      };
      if (supplier) {
        await suppliersApi.update(supplier.id, payload);
      } else {
        await suppliersApi.create(payload);
      }
      onSaved();
    } catch {
      setError("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!supplier) return;
    if (!confirm("Supprimer ce fournisseur ?")) return;
    setSaving(true);
    try {
      await suppliersApi.delete(supplier.id);
      onSaved();
    } catch {
      setError("Échec de la suppression.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex justify-end">
      <form
        onSubmit={handleSubmit}
        className="h-full w-full max-w-2xl bg-void border-l border-border overflow-y-auto flex flex-col"
      >
        <div className="sticky top-0 bg-void/95 backdrop-blur border-b border-border p-5 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-text-dim">FOURNISSEUR</p>
            <h2 className="heading-md">{supplier ? supplier.name : "Nouveau fournisseur"}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-outline p-2" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1">
          <Field label="Nom" required>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-dark w-full"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact">
              <input
                type="text"
                value={form.contactName ?? ""}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="input-dark w-full"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.contactEmail ?? ""}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                className="input-dark w-full"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone">
              <input
                type="text"
                value={form.contactPhone ?? ""}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                className="input-dark w-full"
              />
            </Field>
            <Field label="Site web">
              <input
                type="url"
                value={form.website ?? ""}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="input-dark w-full"
                placeholder="https://"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Pays">
              <input
                type="text"
                value={form.country ?? "FR"}
                onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase().slice(0, 2) })}
                className="input-dark w-full"
              />
            </Field>
            <Field label="Devise">
              <input
                type="text"
                value={form.currency ?? "EUR"}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })}
                className="input-dark w-full"
              />
            </Field>
            <Field label="Délai (jours)">
              <input
                type="number"
                min={0}
                value={form.leadTimeDays ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    leadTimeDays: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="input-dark w-full"
              />
            </Field>
          </div>

          <Field label="Conditions de paiement">
            <input
              type="text"
              value={form.paymentTerms ?? ""}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              className="input-dark w-full"
              placeholder="Ex: 30 jours net"
            />
          </Field>

          <Field label="Notes">
            <textarea
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-dark w-full resize-none"
            />
          </Field>

          <label className="flex items-center gap-2 font-mono text-xs text-text-muted">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Actif
          </label>

          {error ? (
            <p className="font-mono text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 bg-void/95 border-t border-border p-4 flex items-center justify-between gap-3">
          {supplier ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={saving}
              className="btn-outline text-danger border-danger/40"
            >
              Supprimer
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={saving || !form.name.trim()} className="btn-neon">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="spec-label block mb-1">
        {label}
        {required && <span className="text-neon ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
