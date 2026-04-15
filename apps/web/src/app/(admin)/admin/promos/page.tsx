"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  discountCodesApi,
  type DiscountCode,
  type DiscountCodePayload,
} from "@/lib/api";
import { Loader2, Percent, Plus, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export default function AdminPromosPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await discountCodesApi.list();
      setCodes(res.data || []);
    } catch {
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="heading-lg">PROMOS &amp; CODES</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            {codes.length} code{codes.length !== 1 ? "s" : ""} de réduction
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="btn-neon inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Nouveau code
        </button>
      </div>

      <div className="bg-surface border border-border">
        {loading ? (
          <div className="p-6 flex items-center gap-2 font-mono text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-neon" />
            Chargement…
          </div>
        ) : codes.length === 0 ? (
          <div className="p-8 text-center">
            <Percent className="h-10 w-10 text-text-dim mx-auto mb-3" />
            <p className="font-mono text-sm text-text-muted">
              Aucun code de réduction. Crée-en un pour démarrer.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 spec-label">Code</th>
                <th className="text-left px-4 py-3 spec-label">Type</th>
                <th className="text-left px-4 py-3 spec-label">Valeur</th>
                <th className="text-left px-4 py-3 spec-label">Panier min.</th>
                <th className="text-left px-4 py-3 spec-label">Utilisation</th>
                <th className="text-left px-4 py-3 spec-label">Validité</th>
                <th className="text-right px-4 py-3 spec-label">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {codes.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => {
                    setEditing(c);
                    setFormOpen(true);
                  }}
                  className="hover:bg-surface-2/50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-neon">{c.code}</p>
                    {c.label ? <p className="font-mono text-[11px] text-text-dim">{c.label}</p> : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{c.kind}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text">
                    {c.kind === "PERCENT" ? `${Number(c.value).toFixed(0)} %` : `${Number(c.value).toFixed(2)} €`}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {c.minCartHt ? `${Number(c.minCartHt).toFixed(2)} €` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {c.usedCount} {c.maxUses ? `/ ${c.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-text-dim">
                    {formatDate(c.startsAt)} → {formatDate(c.expiresAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "inline-block font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border",
                        c.isActive
                          ? "text-neon border-neon/40 bg-neon-dim"
                          : "text-text-dim border-border bg-surface-2",
                      )}
                    >
                      {c.isActive ? "Actif" : "Inactif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <DiscountCodeForm
          code={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setFormOpen(false);
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function DiscountCodeForm({
  code,
  onClose,
  onSaved,
}: {
  code: DiscountCode | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: code?.code ?? "",
    label: code?.label ?? "",
    kind: (code?.kind ?? "PERCENT") as "PERCENT" | "FIXED",
    value: code?.value ?? "10",
    minCartHt: code?.minCartHt ?? "",
    maxUses: code?.maxUses?.toString() ?? "",
    startsAt: code?.startsAt ? code.startsAt.slice(0, 10) : "",
    expiresAt: code?.expiresAt ? code.expiresAt.slice(0, 10) : "",
    isActive: code?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: DiscountCodePayload = {
        code: form.code.toUpperCase().trim(),
        label: form.label || null,
        kind: form.kind,
        value: Number(form.value),
        minCartHt: form.minCartHt ? Number(form.minCartHt) : null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        isActive: form.isActive,
      };
      if (code) {
        const { code: _ignore, ...rest } = payload;
        void _ignore;
        await discountCodesApi.update(code.id, rest);
      } else {
        await discountCodesApi.create(payload);
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de l'enregistrement.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!code) return;
    if (!confirm(`Supprimer le code ${code.code} ?`)) return;
    setSaving(true);
    try {
      await discountCodesApi.delete(code.id);
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
        className="h-full w-full max-w-xl bg-void border-l border-border overflow-y-auto flex flex-col"
      >
        <div className="sticky top-0 bg-void/95 backdrop-blur border-b border-border p-5 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-text-dim">CODE DE RÉDUCTION</p>
            <h2 className="heading-md">{code ? code.code : "Nouveau code"}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-outline p-2" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1">
          {!code ? (
            <label className="block">
              <span className="spec-label block mb-1">
                Code <span className="text-neon">*</span>
              </span>
              <input
                required
                type="text"
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })
                }
                placeholder="SOLDES2026"
                className="input-dark w-full font-mono tracking-widest"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="spec-label block mb-1">Libellé interne</span>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Ex: Soldes été — -10 %"
              className="input-dark w-full"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="spec-label block mb-1">Type</span>
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as "PERCENT" | "FIXED" })}
                className="input-dark w-full"
              >
                <option value="PERCENT">Pourcentage (%)</option>
                <option value="FIXED">Montant fixe (€)</option>
              </select>
            </label>
            <label className="block">
              <span className="spec-label block mb-1">
                Valeur <span className="text-neon">*</span>
              </span>
              <input
                required
                type="number"
                min={0}
                max={form.kind === "PERCENT" ? 100 : undefined}
                step={form.kind === "PERCENT" ? 1 : 0.01}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="input-dark w-full"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="spec-label block mb-1">Panier min. HT (€)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.minCartHt}
                onChange={(e) => setForm({ ...form, minCartHt: e.target.value })}
                className="input-dark w-full"
              />
            </label>
            <label className="block">
              <span className="spec-label block mb-1">Utilisations max</span>
              <input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="illimité"
                className="input-dark w-full"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="spec-label block mb-1">Début</span>
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="input-dark w-full"
              />
            </label>
            <label className="block">
              <span className="spec-label block mb-1">Fin</span>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="input-dark w-full"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 font-mono text-xs text-text-muted">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Code actif
          </label>

          {error ? (
            <p className="font-mono text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 bg-void/95 border-t border-border p-4 flex items-center justify-between gap-3">
          {code ? (
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
          <button type="submit" disabled={saving} className="btn-neon">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
