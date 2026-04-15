"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ordersApi, type AdminOrderSummary, type Order } from "@/lib/api";
import { CsvExportButton } from "@/components/admin/CsvExportButton";
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  CreditCard,
  Banknote,
  Filter,
  Search,
  Loader2,
  ArrowRight,
  Package,
  X,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: React.ElementType }> = {
  PENDING: { label: "En attente", badgeClass: "badge badge-warning", icon: Clock },
  CONFIRMED: { label: "Confirmée", badgeClass: "badge badge-neon", icon: CheckCircle2 },
  PREPARING: { label: "En préparation", badgeClass: "badge badge-muted", icon: ShoppingCart },
  SHIPPED: { label: "Expédiée", badgeClass: "badge badge-neon", icon: Truck },
  DELIVERED: { label: "Livrée", badgeClass: "badge badge-neon", icon: PackageCheck },
  CANCELLED: { label: "Annulée", badgeClass: "badge badge-danger", icon: XCircle },
  REFUNDED: { label: "Remboursée", badgeClass: "badge badge-danger", icon: Banknote },
};

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

const PAYMENT_ICONS: Record<string, React.ElementType> = {
  card: CreditCard,
  stripe: CreditCard,
  cash: Banknote,
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value?: string | number | null): string {
  if (value === null || value === undefined) return "0.00 €";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "0.00 €";
  return `${num.toFixed(2)} €`;
}

// Next.js 15 requires useSearchParams to be wrapped in a Suspense boundary
// so static prerendering can bail out to CSR. The actual page body lives in
// AdminCommandesContent; this wrapper just provides the boundary.
export default function AdminCommandesPage() {
  return (
    <Suspense fallback={<div className="font-mono text-xs text-text-muted">Chargement…</div>}>
      <AdminCommandesContent />
    </Suspense>
  );
}

function AdminCommandesContent() {
  const searchParams = useSearchParams();
  const orderQueryParam = searchParams?.get("order") ?? null;

  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [nextStatus, setNextStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingNote, setTrackingNote] = useState("");
  const [markAsShipped, setMarkAsShipped] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await ordersApi.adminList({
        page: 1,
        limit: 100,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setOrders(res.data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrderDetail(orderId: string) {
    // Open the drawer immediately so the click feels responsive and any
    // fetch error stays visible (the drawer is the only place actionError
    // is rendered).
    setSelectedOrderId(orderId);
    setSelectedOrder(null);
    setLoadingDetail(true);
    setActionError(null);
    try {
      const res = await ordersApi.adminGetById(orderId);
      setSelectedOrder(res.data);
      setTrackingNumber(res.data.trackingNumber || "");
      setNextStatus("");
      setStatusNote("");
      setTrackingNote("");
    } catch (err) {
      console.error("loadOrderDetail failed:", err);
      setActionError("Impossible de charger le détail de la commande.");
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadOrders();
    }, 250);
    return () => clearTimeout(id);
  }, [statusFilter, search]);

  // Auto-open drawer if ?order=<id> is in the URL (deep-link from client 360)
  useEffect(() => {
    if (orderQueryParam && orderQueryParam !== selectedOrderId) {
      void loadOrderDetail(orderQueryParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderQueryParam]);

  const allowedTransitions = useMemo(() => {
    if (!selectedOrder) return [];
    return VALID_STATUS_TRANSITIONS[selectedOrder.status] || [];
  }, [selectedOrder]);

  async function handleUpdateStatus() {
    if (!selectedOrder || !nextStatus) return;
    setSavingStatus(true);
    setActionError(null);
    try {
      await ordersApi.adminUpdateStatus(selectedOrder.id, {
        status: nextStatus,
        note: statusNote.trim() || undefined,
      });
      await loadOrderDetail(selectedOrder.id);
      await loadOrders();
      setNextStatus("");
      setStatusNote("");
    } catch {
      setActionError("Échec de la transition de statut.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleUpdateTracking() {
    if (!selectedOrder || !trackingNumber.trim()) return;
    setSavingTracking(true);
    setActionError(null);
    try {
      await ordersApi.adminUpdateTracking(selectedOrder.id, {
        trackingNumber: trackingNumber.trim(),
        note: trackingNote.trim() || undefined,
        markAsShipped,
      });
      await loadOrderDetail(selectedOrder.id);
      await loadOrders();
      setTrackingNote("");
    } catch {
      setActionError("Échec de la mise à jour du suivi colis.");
    } finally {
      setSavingTracking(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="heading-lg">COMMANDES</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            {orders.length} commande{orders.length !== 1 ? "s" : ""} affichée{orders.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CsvExportButton
          path="/api/v1/admin/exports/orders.csv"
          filename="commandes.csv"
          label="Exporter CSV"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Recherche: n° commande, email, tracking"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border pl-10 pr-3 py-2.5 font-mono text-xs text-text"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-text-dim" />
          <button
            onClick={() => setStatusFilter("")}
            className={cn(
              "px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all border",
              !statusFilter
                ? "bg-neon text-void border-neon"
                : "bg-surface text-text-muted border-border hover:border-text-dim"
            )}
          >
            Tous
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
              className={cn(
                "px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all border",
                statusFilter === key
                  ? "bg-neon text-void border-neon"
                  : "bg-surface text-text-muted border-border hover:border-text-dim"
              )}
            >
              {val.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="text-left px-6 py-3.5 spec-label">N°</th>
              <th className="text-left px-6 py-3.5 spec-label">Client</th>
              <th className="text-left px-6 py-3.5 spec-label">Date</th>
              <th className="text-left px-6 py-3.5 spec-label">Statut</th>
              <th className="text-left px-6 py-3.5 spec-label">Suivi colis</th>
              <th className="text-right px-6 py-3.5 spec-label">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-4 bg-surface-2 animate-pulse" />
                  </td>
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <ShoppingCart className="h-10 w-10 text-text-dim mx-auto mb-3" />
                  <p className="font-mono text-text-muted">Aucune commande</p>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const status = STATUS_CONFIG[order.status] || {
                  label: order.status,
                  badgeClass: "badge badge-muted",
                  icon: Clock,
                };
                const StatusIcon = status.icon;
                const PaymentIcon = PAYMENT_ICONS[order.paymentMethod?.toLowerCase()] || CreditCard;
                return (
                  <tr
                    key={order.id}
                    className="hover:bg-surface-2/50 cursor-pointer transition-colors"
                    onClick={() => void loadOrderDetail(order.id)}
                  >
                    <td className="px-6 py-4">
                      <p className="font-mono font-bold text-neon">#{order.orderNumber}</p>
                      <p className="font-mono text-[11px] text-text-dim inline-flex items-center gap-1 mt-1">
                        <PaymentIcon className="h-3 w-3" />
                        {order.paymentMethod}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-xs text-text">{order.customer?.email ?? "—"}</p>
                      <p className="font-mono text-[11px] text-text-dim">
                        {[order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(" ") || "—"}
                      </p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-text-muted">{formatDate(order.createdAt)}</td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center gap-1.5", status.badgeClass)}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-xs text-text">
                        {order.trackingNumber ? order.trackingNumber : "—"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono font-bold text-neon">{formatPrice(order.totalTtc)}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedOrderId && (
        <div className="fixed inset-0 z-50 bg-black/45 flex justify-end">
          <div className="h-full w-full max-w-2xl bg-void border-l border-border overflow-y-auto">
            <div className="sticky top-0 z-10 bg-void/95 backdrop-blur border-b border-border p-5 flex items-center justify-between">
              <div>
                <p className="font-mono text-xs text-text-dim">DÉTAIL COMMANDE</p>
                <h2 className="heading-md">#{selectedOrder?.orderNumber ?? "..."}</h2>
              </div>
              <button
                onClick={() => {
                  setSelectedOrderId(null);
                  setSelectedOrder(null);
                  setActionError(null);
                }}
                className="btn-outline p-2"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-6 flex items-center gap-2 font-mono text-xs text-text-muted">
                <Loader2 className="w-5 h-5 animate-spin text-neon" />
                Chargement du détail…
              </div>
            ) : !selectedOrder ? (
              <div className="p-6">
                <div role="alert" className="border border-danger/40 bg-danger/10 text-danger font-mono text-xs p-3">
                  {actionError ?? "Aucun détail disponible pour cette commande."}
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <section className="bg-surface border border-border p-4">
                  <p className="spec-label mb-2">CLIENT</p>
                  <p className="font-mono text-sm text-text">{selectedOrder.customer?.email ?? "—"}</p>
                  <p className="font-mono text-xs text-text-dim">
                    {[selectedOrder.customer?.firstName, selectedOrder.customer?.lastName].filter(Boolean).join(" ") || "—"}
                  </p>
                </section>

                <section className="bg-surface border border-border p-4">
                  <p className="spec-label mb-3">TRANSITION STATUT</p>
                  <p className="font-mono text-xs text-text-muted mb-2">
                    Statut actuel: <span className="text-text">{selectedOrder.status}</span>
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value)}
                      className="input-dark flex-1"
                      disabled={allowedTransitions.length === 0}
                    >
                      <option value="">Choisir le prochain statut</option>
                      {allowedTransitions.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_CONFIG[status]?.label ?? status}
                        </option>
                      ))}
                    </select>
                    <ArrowRight className="w-4 h-4 text-text-dim" />
                  </div>
                  <textarea
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Note interne (optionnel)"
                    rows={2}
                    className="input-dark w-full resize-none mb-3"
                  />
                  <button
                    onClick={() => void handleUpdateStatus()}
                    disabled={!nextStatus || savingStatus}
                    className="btn-neon disabled:opacity-60"
                  >
                    {savingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    METTRE À JOUR LE STATUT
                  </button>
                </section>

                <section className="bg-surface border border-border p-4">
                  <p className="spec-label mb-3">SUIVI COLIS</p>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Numéro de suivi transporteur"
                    className="input-dark w-full mb-3"
                  />
                  <textarea
                    value={trackingNote}
                    onChange={(e) => setTrackingNote(e.target.value)}
                    placeholder="Note suivi (optionnel)"
                    rows={2}
                    className="input-dark w-full resize-none mb-3"
                  />
                  <label className="flex items-center gap-2 font-mono text-xs text-text-muted mb-3">
                    <input
                      type="checkbox"
                      checked={markAsShipped}
                      onChange={(e) => setMarkAsShipped(e.target.checked)}
                    />
                    Passer automatiquement la commande en EXPÉDIÉE
                  </label>
                  <button
                    onClick={() => void handleUpdateTracking()}
                    disabled={!trackingNumber.trim() || savingTracking}
                    className="btn-outline disabled:opacity-60"
                  >
                    {savingTracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                    ENREGISTRER LE SUIVI
                  </button>
                </section>

                <section className="bg-surface border border-border p-4">
                  <p className="spec-label mb-3">ARTICLES</p>
                  <div className="space-y-3">
                    {selectedOrder.items?.map((item) => (
                      <OrderItemCard
                        key={item.id}
                        orderId={selectedOrder.id}
                        item={item}
                        onSaved={() => void loadOrderDetail(selectedOrder.id)}
                      />
                    ))}
                  </div>
                </section>

                <section className="bg-surface border border-border p-4">
                  <p className="spec-label mb-3">HISTORIQUE STATUT</p>
                  <div className="space-y-2">
                    {(selectedOrder.statusHistory ?? []).map((entry) => (
                      <div key={entry.id} className="border border-border p-3 bg-surface-2">
                        <p className="font-mono text-xs text-text">
                          {entry.fromStatus} → {entry.toStatus}
                        </p>
                        <p className="font-mono text-[11px] text-text-dim">{formatDate(entry.changedAt)}</p>
                        {entry.note ? <p className="font-mono text-[11px] text-text-muted mt-1">{entry.note}</p> : null}
                      </div>
                    ))}
                  </div>
                </section>

                {actionError ? (
                  <div role="alert" className="border border-danger/40 bg-danger/10 text-danger font-mono text-xs p-3">
                    {actionError}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OrderItemCard: item line + serial number editor ──────────────

type OrderItemLite = {
  id: string;
  quantity: number;
  unitPriceHt: string | number | null;
  totalHt?: string | number | null;
  serialNumbers?: string[];
  product?: { name?: string } | null;
};

function OrderItemCard({
  orderId,
  item,
  onSaved,
}: {
  orderId: string;
  item: OrderItemLite;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serials, setSerials] = useState<string[]>(item.serialNumbers ?? []);
  const [draft, setDraft] = useState("");

  function addSn(raw: string) {
    const s = raw.trim();
    if (!s) return;
    if (serials.includes(s)) return;
    if (serials.length >= item.quantity) {
      setError(`Maximum ${item.quantity} numéro(s) de série pour cet article.`);
      return;
    }
    setSerials([...serials, s]);
    setDraft("");
    setError(null);
  }

  function removeSn(s: string) {
    setSerials(serials.filter((x) => x !== s));
    setError(null);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSn(draft);
    } else if (e.key === "Backspace" && draft === "" && serials.length > 0) {
      setSerials(serials.slice(0, -1));
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await ordersApi.adminUpdateItemSerialNumbers(orderId, item.id, serials);
      setEditing(false);
      onSaved();
    } catch {
      setError("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setSerials(item.serialNumbers ?? []);
    setDraft("");
    setEditing(false);
    setError(null);
  }

  const hasSerials = (item.serialNumbers ?? []).length > 0;

  return (
    <div className="border border-border p-3 bg-surface-2 space-y-2">
      <div>
        <p className="font-mono text-xs text-text">{item.product?.name ?? "Produit"}</p>
        <p className="font-mono text-[11px] text-text-dim">
          Qté: {item.quantity} • PU HT: {formatPrice(item.unitPriceHt)} • Total HT:{" "}
          {formatPrice(item.totalHt)}
        </p>
      </div>

      {/* Serial numbers display / editor */}
      {!editing ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {hasSerials ? (
              (item.serialNumbers ?? []).map((sn) => (
                <span
                  key={sn}
                  className="inline-flex items-center gap-1 bg-neon-dim border border-neon/40 text-neon font-mono text-[10px] px-1.5 py-0.5"
                >
                  SN · {sn}
                </span>
              ))
            ) : (
              <span className="font-mono text-[10px] text-text-dim">
                Aucun numéro de série enregistré
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-mono text-[10px] text-text-muted hover:text-neon uppercase tracking-wider border border-border px-2 py-0.5"
          >
            {hasSerials ? "Modifier" : "Ajouter SN"}
          </button>
        </div>
      ) : (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex flex-wrap gap-1 min-h-[24px]">
            {serials.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 bg-neon-dim border border-neon/40 text-neon font-mono text-[10px] px-1.5 py-0.5"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeSn(s)}
                  className="hover:text-text"
                  aria-label={`Retirer ${s}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`N° série ${serials.length + 1}/${item.quantity} (Entrée)`}
              className="input-dark flex-1 text-xs"
              autoFocus
            />
            <button
              type="button"
              onClick={() => addSn(draft)}
              disabled={serials.length >= item.quantity}
              className="btn-outline px-2 disabled:opacity-40"
              aria-label="Ajouter"
            >
              +
            </button>
          </div>
          {error ? (
            <p className="font-mono text-[10px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="btn-neon px-3 py-1 text-[11px] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={cancel}
              className="btn-outline px-3 py-1 text-[11px]"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
