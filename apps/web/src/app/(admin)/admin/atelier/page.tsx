"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  repairsApi,
  adminProductsApi,
  type RepairTicket,
  type RepairPartUsed,
  type Product,
} from "@/lib/api";
import {
  Hammer,
  Loader2,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  Wrench,
  X,
  FileText,
  CheckCircle2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Download the repair quote PDF through a fetch-with-auth flow (the
// endpoint requires a Bearer token, so a plain <a href> would 401).
async function downloadQuotePdf(ticketId: string, ticketNumber: number): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const res = await fetch(`/api/v1/repairs/${ticketId}/quote/pdf`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devis-SAV-${String(ticketNumber).padStart(4, "0")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Atelier-specific workflow: only the statuses where actual work is
// happening on a scooter. The client-facing SAV page handles the rest.
const WORK_STATUSES = new Set([
  "DIAGNOSTIC",
  "DEVIS_ENVOYE",
  "DEVIS_ACCEPTE",
  "EN_REPARATION",
  "EN_ATTENTE_PIECE",
  "PRET",
]);

const STATUS_LABELS: Record<string, string> = {
  RECU: "Reçu",
  DIAGNOSTIC: "Diagnostic",
  DEVIS_ENVOYE: "Devis envoyé",
  DEVIS_ACCEPTE: "Devis accepté",
  EN_REPARATION: "En réparation",
  EN_ATTENTE_PIECE: "Attente pièce",
  PRET: "Prêt",
  RECUPERE: "Récupéré",
};

const STATUS_COLOR: Record<string, string> = {
  DIAGNOSTIC: "text-text-muted border-border bg-surface-2",
  DEVIS_ENVOYE: "text-warning border-warning/40 bg-warning/10",
  DEVIS_ACCEPTE: "text-neon border-neon/40 bg-neon-dim",
  EN_REPARATION: "text-neon border-neon/40 bg-neon-dim",
  EN_ATTENTE_PIECE: "text-warning border-warning/40 bg-warning/10",
  PRET: "text-neon border-neon/40 bg-neon-dim",
};

function formatEuro(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const v = typeof n === "number" ? n : Number(n);
  if (Number.isNaN(v)) return "—";
  return `${v.toFixed(2)} €`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

export default function AdminAtelierPage() {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<RepairTicket | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await repairsApi.list({ limit: 100, sort: "newest" });
      const all = res.data || [];
      // Keep only the work-in-progress side of the SAV pipeline.
      setTickets(all.filter((t) => WORK_STATUSES.has(t.status)));
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setSelected(null);
    setLoadingDetail(true);
    try {
      const res = await repairsApi.getById(id);
      setSelected(res.data);
    } catch {
      setSelected(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const filtered = useMemo(
    () =>
      statusFilter ? tickets.filter((t) => t.status === statusFilter) : tickets,
    [tickets, statusFilter],
  );

  const countByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tickets) map[t.status] = (map[t.status] ?? 0) + 1;
    return map;
  }, [tickets]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="heading-lg">ATELIER</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} en cours · ordres de réparation
            avec pièces, devis, main d&apos;œuvre.
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border p-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setStatusFilter("")}
          className={cn(
            "px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider border",
            !statusFilter
              ? "bg-neon text-void border-neon"
              : "bg-surface text-text-muted border-border hover:border-text-dim",
          )}
        >
          Tous ({tickets.length})
        </button>
        {[...WORK_STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
            className={cn(
              "px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider border",
              statusFilter === s
                ? "bg-neon text-void border-neon"
                : "bg-surface text-text-muted border-border hover:border-text-dim",
            )}
          >
            {STATUS_LABELS[s] ?? s} ({countByStatus[s] ?? 0})
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border">
        {loading ? (
          <div className="p-6 flex items-center gap-2 font-mono text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-neon" />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Hammer className="h-10 w-10 text-text-dim mx-auto mb-3" />
            <p className="font-mono text-sm text-text-muted">
              Aucun ordre de réparation en cours pour ce filtre.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 spec-label">Ticket</th>
                <th className="text-left px-4 py-3 spec-label">Modèle</th>
                <th className="text-left px-4 py-3 spec-label">Client</th>
                <th className="text-left px-4 py-3 spec-label">Statut</th>
                <th className="text-right px-4 py-3 spec-label">Devis</th>
                <th className="text-right px-4 py-3 spec-label">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => void loadDetail(t.id)}
                  className="hover:bg-surface-2/50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <span className="text-neon font-bold">
                      SAV-{String(t.ticketNumber).padStart(4, "0")}
                    </span>
                    <p className="text-text-dim text-[11px]">{t.priority}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text">
                    {t.productModel}
                    {t.serialNumber ? (
                      <p className="text-text-dim text-[11px]">SN · {t.serialNumber}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {t.customerName || "—"}
                    {t.customerEmail ? (
                      <p className="text-text-dim text-[11px]">{t.customerEmail}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border",
                        STATUS_COLOR[t.status] ?? "border-border bg-surface-2 text-text-dim",
                      )}
                    >
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-neon">
                    {formatEuro(t.estimatedCost)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[11px] text-text-dim">
                    {formatDate(t.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId ? (
        <AtelierDrawer
          ticketId={selectedId}
          ticket={selected}
          loading={loadingDetail}
          onClose={() => {
            setSelectedId(null);
            setSelected(null);
          }}
          onReload={() => {
            void loadDetail(selectedId);
            void loadTickets();
          }}
        />
      ) : null}
    </div>
  );
}

// ─── Drawer: OR detail with parts + labor + quote actions ────────

function AtelierDrawer({
  ticketId,
  ticket,
  loading,
  onClose,
  onReload,
}: {
  ticketId: string;
  ticket: RepairTicket | null;
  loading: boolean;
  onClose: () => void;
  onReload: () => void;
}) {
  const [laborCost, setLaborCost] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    // Pre-fill labor from estimated - parts if available, otherwise 0.
    const partsTotal = (ticket.partsUsed ?? []).reduce(
      (sum, p) => sum + Number(p.unitCost) * p.quantity,
      0,
    );
    const estimated = ticket.estimatedCost ? Number(ticket.estimatedCost) : 0;
    const labor = Math.max(0, estimated - partsTotal);
    setLaborCost(labor > 0 ? labor.toFixed(2) : "");
  }, [ticket]);

  const partsTotal = useMemo(
    () =>
      (ticket?.partsUsed ?? []).reduce(
        (sum, p) => sum + Number(p.unitCost) * p.quantity,
        0,
      ),
    [ticket?.partsUsed],
  );

  async function handleCreateQuote() {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      const parts = (ticket.partsUsed ?? []).map((p) => ({
        partName: p.partName,
        partRef: p.partRef ?? undefined,
        variantId: p.variantId ?? undefined,
        quantity: p.quantity,
        unitCost: Number(p.unitCost),
      }));
      await repairsApi.createQuote(ticket.id, {
        parts,
        laborCost: Number(laborCost) || 0,
      });
      onReload();
    } catch (err) {
      setError(
        err instanceof Error && err.message.startsWith("API Error")
          ? "Transition de statut invalide ou requête rejetée."
          : "Impossible de générer le devis.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptQuote() {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      await repairsApi.acceptQuote(ticket.id);
      onReload();
    } catch {
      setError("Impossible d'accepter le devis.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStartRepair() {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      await repairsApi.updateStatus(ticket.id, { status: "EN_REPARATION" });
      onReload();
    } catch {
      setError("Transition impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkReady() {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    try {
      await repairsApi.updateStatus(ticket.id, { status: "PRET" });
      onReload();
    } catch {
      setError("Transition impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex justify-end">
      <div className="h-full w-full max-w-3xl bg-void border-l border-border overflow-y-auto">
        <div className="sticky top-0 bg-void/95 backdrop-blur border-b border-border p-5 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-text-dim">ORDRE DE RÉPARATION</p>
            <h2 className="heading-md">
              {ticket ? `SAV-${String(ticket.ticketNumber).padStart(4, "0")}` : "…"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-outline p-2"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading || !ticket ? (
          <div className="p-6 flex items-center gap-2 font-mono text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-neon" />
            Chargement du détail…
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Context */}
            <section className="bg-surface border border-border p-4">
              <p className="spec-label mb-2">CONTEXTE</p>
              <p className="font-mono text-xs text-text">{ticket.productModel}</p>
              {ticket.serialNumber ? (
                <p className="font-mono text-[11px] text-text-dim">
                  Numéro de série · {ticket.serialNumber}
                </p>
              ) : null}
              <p className="font-mono text-[11px] text-text-muted mt-2 whitespace-pre-wrap">
                {ticket.issueDescription}
              </p>
              {ticket.diagnosis ? (
                <p className="font-mono text-[11px] text-text mt-2 border-t border-border pt-2 whitespace-pre-wrap">
                  <span className="text-text-dim">Diagnostic : </span>
                  {ticket.diagnosis}
                </p>
              ) : null}
            </section>

            {/* Parts consumed */}
            <section className="bg-surface border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="spec-label">PIÈCES CONSOMMÉES</p>
                <span className="font-mono text-xs text-neon">
                  Total {formatEuro(partsTotal)}
                </span>
              </div>

              {(ticket.partsUsed ?? []).length === 0 ? (
                <p className="font-mono text-[11px] text-text-dim mb-3">
                  Aucune pièce ajoutée.
                </p>
              ) : (
                <ul className="space-y-1.5 mb-3">
                  {(ticket.partsUsed ?? []).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 border border-border bg-surface-2 px-3 py-2 font-mono text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-text truncate">{p.partName}</p>
                        <p className="text-text-dim text-[11px]">
                          {p.partRef ?? "—"} · qté {p.quantity} × {formatEuro(p.unitCost)}
                          {p.variantId ? " · stock" : ""}
                        </p>
                      </div>
                      <span className="text-neon">
                        {formatEuro(Number(p.unitCost) * p.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <AddPartForm
                ticketId={ticketId}
                onAdded={onReload}
              />
            </section>

            {/* Labor + quote total */}
            <section className="bg-surface border border-border p-4">
              <p className="spec-label mb-3">MAIN D&apos;ŒUVRE &amp; DEVIS</p>

              <label className="block mb-3">
                <span className="font-mono text-[11px] text-text-dim uppercase tracking-wider">
                  Main d&apos;œuvre (€)
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  placeholder="0.00"
                  className="input-dark w-full mt-1"
                />
              </label>

              <div className="flex items-center justify-between font-mono text-xs border-t border-border pt-3 mb-4">
                <span className="text-text-muted">
                  Pièces {formatEuro(partsTotal)} + M.O. {formatEuro(Number(laborCost) || 0)}
                </span>
                <span className="font-bold text-neon text-sm">
                  {formatEuro(partsTotal + (Number(laborCost) || 0))}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {ticket.estimatedCost ? (
                  <button
                    type="button"
                    onClick={() => {
                      void downloadQuotePdf(ticket.id, ticket.ticketNumber).catch((err) => {
                        console.error("quote pdf download failed:", err);
                        setError("Échec du téléchargement du devis.");
                      });
                    }}
                    className="btn-outline inline-flex items-center gap-1.5 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" /> Devis PDF
                  </button>
                ) : null}
                {["DIAGNOSTIC", "EN_REPARATION"].includes(ticket.status) ? (
                  <button
                    type="button"
                    onClick={() => void handleCreateQuote()}
                    disabled={saving}
                    className="btn-neon inline-flex items-center gap-1.5 text-xs"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    Envoyer le devis
                  </button>
                ) : null}

                {ticket.status === "DEVIS_ENVOYE" ? (
                  <button
                    type="button"
                    onClick={() => void handleAcceptQuote()}
                    disabled={saving}
                    className="btn-outline inline-flex items-center gap-1.5 text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Marquer accepté
                  </button>
                ) : null}

                {ticket.status === "DEVIS_ACCEPTE" ? (
                  <button
                    type="button"
                    onClick={() => void handleStartRepair()}
                    disabled={saving}
                    className="btn-neon inline-flex items-center gap-1.5 text-xs"
                  >
                    <Wrench className="h-3.5 w-3.5" /> Démarrer la réparation
                  </button>
                ) : null}

                {ticket.status === "EN_REPARATION" ? (
                  <button
                    type="button"
                    onClick={() => void handleMarkReady()}
                    disabled={saving}
                    className="btn-neon inline-flex items-center gap-1.5 text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Marquer prêt
                  </button>
                ) : null}
              </div>

              {error ? (
                <p className="font-mono text-[11px] text-danger mt-2" role="alert">
                  {error}
                </p>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add part form ────────────────────────────────────────────────

function AddPartForm({
  ticketId,
  onAdded,
}: {
  ticketId: string;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [partName, setPartName] = useState("");
  const [partRef, setPartRef] = useState("");
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await adminProductsApi.list({
          search: query.trim(),
          limit: 8,
        });
        setResults(res.data || []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function pickProduct(p: Product) {
    setPartName(p.name);
    setPartRef(p.sku);
    const firstVariant = p.variants?.[0];
    setVariantId(firstVariant?.id ?? null);
    setUnitCost(String(p.priceHt));
    setQuery("");
    setShowResults(false);
  }

  async function handleAdd() {
    if (!partName.trim() || !unitCost) {
      setError("Nom de pièce et coût requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await repairsApi.addPart(ticketId, {
        partName: partName.trim(),
        partRef: partRef.trim() || undefined,
        variantId: variantId ?? undefined,
        quantity: Number(quantity) || 1,
        unitCost: Number(unitCost),
      });
      setPartName("");
      setPartRef("");
      setVariantId(null);
      setQuantity("1");
      setUnitCost("");
      onAdded();
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes("409")
          ? "Stock insuffisant pour cette pièce."
          : "Impossible d'ajouter la pièce.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-border pt-3 space-y-2">
      <p className="font-mono text-[10px] text-text-dim uppercase tracking-wider">
        Ajouter une pièce
      </p>

      {/* Product search */}
      <div className="relative">
        <Search className="h-3.5 w-3.5 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          placeholder="Chercher dans le catalogue…"
          className="input-dark w-full pl-8 text-xs"
        />
        {showResults && query.trim() ? (
          <div className="absolute z-10 mt-1 w-full bg-surface border border-border max-h-48 overflow-auto">
            {loading ? (
              <p className="p-2 font-mono text-[11px] text-text-dim">Recherche…</p>
            ) : results.length === 0 ? (
              <p className="p-2 font-mono text-[11px] text-text-dim">Aucun produit.</p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickProduct(p)}
                  className="w-full text-left px-3 py-1.5 font-mono text-[11px] hover:bg-surface-2"
                >
                  <p className="text-text truncate">{p.name}</p>
                  <p className="text-text-dim">
                    {p.sku} · {formatEuro(p.priceHt)}
                  </p>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={partName}
          onChange={(e) => setPartName(e.target.value)}
          placeholder="Nom"
          className="input-dark text-xs"
        />
        <input
          type="text"
          value={partRef}
          onChange={(e) => setPartRef(e.target.value)}
          placeholder="Réf / SKU"
          className="input-dark text-xs"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qté"
          className="input-dark text-xs"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          placeholder="Coût unit. €"
          className="input-dark text-xs col-span-2"
        />
      </div>

      {variantId ? (
        <p className="font-mono text-[10px] text-neon">
          ✓ Lien stock — décrément automatique
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={saving || !partName.trim() || !unitCost}
        className="btn-outline inline-flex items-center gap-1 text-[11px] px-3 py-1 disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Plus className="h-3 w-3" />
        )}
        Ajouter la pièce
      </button>

      {error ? (
        <p className="font-mono text-[10px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
