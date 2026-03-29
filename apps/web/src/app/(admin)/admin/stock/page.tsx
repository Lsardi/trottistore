"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  stockApi,
  type StockAlert,
  type StockMovement,
  type StockMovementSummary,
  type StockMovementType,
} from "@/lib/api";
import { AlertTriangle, Loader2, Package, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const MOVEMENT_TYPES: Array<{ value: StockMovementType; label: string; direction: "IN" | "OUT" }> = [
  { value: "IN_PURCHASE", label: "Entree achat", direction: "IN" },
  { value: "IN_RETURN", label: "Entree retour", direction: "IN" },
  { value: "IN_ADJUSTMENT", label: "Entree ajustement", direction: "IN" },
  { value: "OUT_SALE", label: "Sortie vente", direction: "OUT" },
  { value: "OUT_REPAIR", label: "Sortie reparation", direction: "OUT" },
  { value: "OUT_ADJUSTMENT", label: "Sortie ajustement", direction: "OUT" },
  { value: "OUT_LOSS", label: "Sortie perte", direction: "OUT" },
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

function movementLabel(value: StockMovementType): string {
  return MOVEMENT_TYPES.find((item) => item.value === value)?.label ?? value;
}

export default function AdminStockPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [summary, setSummary] = useState<StockMovementSummary[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [variantId, setVariantId] = useState("");
  const [type, setType] = useState<StockMovementType>("IN_PURCHASE");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [referenceId, setReferenceId] = useState("");

  const variantOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const item of summary) {
      map.set(item.variantId, { id: item.variantId, label: `${item.sku} · ${item.name}` });
    }
    for (const item of alerts) {
      map.set(item.variantId, { id: item.variantId, label: `${item.sku} · ${item.variantName}` });
    }
    for (const item of movements) {
      if (item.variant) {
        map.set(item.variant.id, { id: item.variant.id, label: `${item.variant.sku} · ${item.variant.name}` });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [summary, alerts, movements]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [alertsRes, summaryRes, movementsRes] = await Promise.all([
          stockApi.listAlerts(),
          stockApi.summary(),
          stockApi.listMovements({ page: 1, limit: 20 }),
        ]);
        setAlerts(alertsRes.data || []);
        setSummary(summaryRes.data || []);
        setMovements(movementsRes.data || []);
        setPage(movementsRes.pagination?.page || 1);
        setTotalPages(movementsRes.pagination?.totalPages || 1);
      } catch {
        setError("Impossible de charger les donnees stock.");
      } finally {
        setLoading(false);
      }
    }
    void loadAll();
  }, []);

  async function loadMovements(targetPage: number) {
    setLoadingMovements(true);
    try {
      const res = await stockApi.listMovements({ page: targetPage, limit: 20 });
      setMovements(res.data || []);
      setPage(res.pagination?.page || targetPage);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch {
      setToast({ type: "error", message: "Impossible de charger l'historique." });
    } finally {
      setLoadingMovements(false);
    }
  }

  async function refreshData() {
    setLoading(true);
    try {
      const [alertsRes, summaryRes] = await Promise.all([stockApi.listAlerts(), stockApi.summary()]);
      setAlerts(alertsRes.data || []);
      setSummary(summaryRes.data || []);
      await loadMovements(page);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateMovement(e: FormEvent) {
    e.preventDefault();
    const parsedQty = Number.parseInt(quantity, 10);
    if (!variantId || Number.isNaN(parsedQty) || parsedQty <= 0) {
      setToast({ type: "error", message: "Variante et quantite (>0) obligatoires." });
      return;
    }
    setCreating(true);
    try {
      const res = await stockApi.createMovement({
        variantId,
        type,
        quantity: parsedQty,
        reason: reason.trim() || undefined,
        referenceId: referenceId.trim() || undefined,
        referenceType: referenceId.trim() ? "MANUAL" : undefined,
      });
      setReason("");
      setReferenceId("");
      setQuantity("1");
      await refreshData();

      const alertMessage = res.data.alert?.message ? ` · ${res.data.alert.message}` : "";
      setToast({ type: "success", message: `Mouvement enregistre. Stock: ${res.data.stockAfter}${alertMessage}` });
    } catch {
      setToast({ type: "error", message: "Erreur lors de l'enregistrement du mouvement." });
    } finally {
      setCreating(false);
    }
  }

  const outOfStockCount = alerts.filter((a) => a.severity === "OUT_OF_STOCK").length;
  const lowStockCount = alerts.filter((a) => a.severity === "LOW_STOCK").length;
  const movementTotal = summary.reduce((acc, item) => acc + item.movementCount, 0);

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          className={cn(
            "fixed right-4 top-4 z-50 border px-4 py-2 font-mono text-xs",
            toast.type === "success" ? "border-neon/40 bg-neon-dim text-neon" : "border-danger/40 bg-danger/10 text-danger",
          )}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="heading-lg">GESTION STOCK</h1>
          <p className="font-mono text-sm text-text-muted mt-1">Mouvements atomiques, alertes et supervision des variantes.</p>
        </div>
        <button type="button" onClick={() => void refreshData()} className="btn-outline inline-flex items-center gap-2">
          <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
          Rafraichir
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border p-4">
          <p className="spec-label">Alertes total</p>
          <p className="font-mono text-2xl font-bold text-warning mt-1">{alerts.length}</p>
        </div>
        <div className="bg-surface border border-border p-4">
          <p className="spec-label">Ruptures</p>
          <p className="font-mono text-2xl font-bold text-danger mt-1">{outOfStockCount}</p>
        </div>
        <div className="bg-surface border border-border p-4">
          <p className="spec-label">Mouvements traces</p>
          <p className="font-mono text-2xl font-bold text-neon mt-1">{movementTotal}</p>
        </div>
      </div>

      {error ? <div className="border border-danger/40 bg-danger/10 p-3 font-mono text-xs text-danger">{error}</div> : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 bg-surface border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="h-4 w-4 text-neon" />
            <h2 className="font-display font-bold text-text">Nouveau mouvement</h2>
          </div>

          <form onSubmit={handleCreateMovement} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="spec-label block mb-1.5">Variante</label>
              <input
                list="variant-options"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                placeholder="ID variante (UUID)"
                className="input-dark w-full"
                required
              />
              <datalist id="variant-options">
                {variantOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="spec-label block mb-1.5">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as StockMovementType)} className="input-dark w-full">
                {MOVEMENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="spec-label block mb-1.5">Quantite</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input-dark w-full"
                required
              />
            </div>

            <div>
              <label className="spec-label block mb-1.5">Reference (optionnel)</label>
              <input
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="ORDER-123 / SAV-0012"
                className="input-dark w-full"
              />
            </div>

            <div>
              <label className="spec-label block mb-1.5">Raison (optionnel)</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: inventaire hebdo"
                className="input-dark w-full"
              />
            </div>

            <div className="md:col-span-2">
              <button type="submit" disabled={creating} className="btn-neon inline-flex items-center gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                Enregistrer
              </button>
            </div>
          </form>
        </section>

        <section className="bg-surface border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h2 className="font-display font-bold text-text">Alertes stock</h2>
          </div>
          {loading ? (
            <div className="h-28 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-neon" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="font-mono text-sm text-text-muted">Aucune alerte active.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-auto">
              {alerts.slice(0, 20).map((item) => (
                <div key={item.variantId} className="border border-border bg-surface-2 p-2">
                  <p className="font-mono text-xs text-text">{item.productName}</p>
                  <p className="font-mono text-[11px] text-text-dim">
                    {item.sku} · {item.variantName}
                  </p>
                  <p className={cn("font-mono text-[11px] mt-1", item.severity === "OUT_OF_STOCK" ? "text-danger" : "text-warning")}>
                    {item.stockQuantity}/{item.lowStockThreshold} · {item.severity === "OUT_OF_STOCK" ? "Rupture" : "Stock faible"}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-border font-mono text-xs text-text-dim">
            Ruptures: {outOfStockCount} · Faibles: {lowStockCount}
          </div>
        </section>
      </div>

      <section className="bg-surface border border-border p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display font-bold text-text">Historique des mouvements</h2>
          <div className="font-mono text-xs text-text-dim">Page {page}/{Math.max(totalPages, 1)}</div>
        </div>
        {loadingMovements ? (
          <div className="h-28 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-neon" />
          </div>
        ) : movements.length === 0 ? (
          <p className="font-mono text-sm text-text-muted">Aucun mouvement trace.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="px-3 py-2 text-left spec-label">Date</th>
                  <th className="px-3 py-2 text-left spec-label">Variante</th>
                  <th className="px-3 py-2 text-left spec-label">Type</th>
                  <th className="px-3 py-2 text-right spec-label">Qte</th>
                  <th className="px-3 py-2 text-right spec-label">Avant</th>
                  <th className="px-3 py-2 text-right spec-label">Apres</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((item) => {
                  const direction = MOVEMENT_TYPES.find((entry) => entry.value === item.type)?.direction;
                  const quantityClass = direction === "IN" ? "text-neon" : "text-warning";
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-mono text-[11px] text-text-dim">{formatDate(item.createdAt)}</td>
                      <td className="px-3 py-2">
                        <p className="font-mono text-xs text-text">{item.variant?.name ?? item.variantId}</p>
                        <p className="font-mono text-[11px] text-text-dim">{item.variant?.sku ?? ""}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-text-dim">{movementLabel(item.type)}</td>
                      <td className={cn("px-3 py-2 text-right font-mono text-xs font-bold", quantityClass)}>
                        {item.quantity > 0 ? `+${item.quantity}` : item.quantity}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-text-dim">{item.stockBefore}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-text">{item.stockAfter}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1 || loadingMovements}
            onClick={() => void loadMovements(page - 1)}
            className="btn-outline disabled:opacity-50"
          >
            Precedent
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loadingMovements}
            onClick={() => void loadMovements(page + 1)}
            className="btn-outline disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      </section>
    </div>
  );
}
