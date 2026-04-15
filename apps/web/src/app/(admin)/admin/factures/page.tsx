"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  invoicesApi,
  type InvoiceRegistryEntry,
} from "@/lib/api";
import {
  Download,
  FileText,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { CsvExportButton } from "@/components/admin/CsvExportButton";
import { cn } from "@/lib/utils";

function formatEuro(n: string | number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const v = typeof n === "number" ? n : Number(n);
  if (Number.isNaN(v)) return "—";
  return `${v.toFixed(2)} €`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

// The invoice PDF endpoint requires a Bearer token → fetch + blob
// instead of a plain <a href>. Same pattern as CsvExportButton.
async function downloadInvoice(orderId: string, orderNumber: number): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const res = await fetch(`/api/v1/admin/orders/${orderId}/invoice`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `facture-commande-${orderNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminFacturesPage() {
  const [entries, setEntries] = useState<InvoiceRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await invoicesApi.list({
          search: search.trim() || undefined,
          from: from || undefined,
          to: to || undefined,
          limit: 100,
        });
        if (cancelled) return;
        setEntries(res.data || []);
        setTotal(res.pagination?.total ?? res.data.length);
      } catch {
        if (!cancelled) {
          setEntries([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const t = setTimeout(() => void load(), 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, from, to]);

  const stats = useMemo(() => {
    const withPdf = entries.filter((e) => e.invoiceNumber != null).length;
    const total = entries.reduce((sum, e) => sum + Number(e.totalTtc || 0), 0);
    return { withPdf, total };
  }, [entries]);

  async function handleDownload(orderId: string, orderNumber: number) {
    setDownloadingId(orderId);
    try {
      await downloadInvoice(orderId, orderNumber);
      // Re-fetch the list to pick up the freshly-created invoiceNumber
      // (the endpoint upserts the Invoice row on first call).
      const res = await invoicesApi.list({
        search: search.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 100,
      });
      setEntries(res.data || []);
    } catch (err) {
      console.error("invoice download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="heading-lg">FACTURES</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            Registre des factures générées — numérotation séquentielle non modifiable
          </p>
        </div>
        <CsvExportButton
          path="/api/v1/admin/exports/orders.csv"
          filename="factures-commandes.csv"
          label="Exporter commandes CSV"
        />
      </div>

      {/* Warning band — accountant should still validate */}
      <div className="bg-surface border border-warning/40 p-3 flex items-start gap-2 font-mono text-xs">
        <Sparkles className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <div className="text-text-muted">
          <p>
            <span className="text-warning">MVP</span> — la page liste les
            commandes facturables et permet de générer / télécharger le PDF
            conforme FR. L&apos;export <strong>FEC</strong> (pour ton expert-comptable)
            et la gestion des <strong>avoirs</strong> viendront après validation
            par un comptable. Ne remplace pas un logiciel de compta.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° commande ou email client"
            className="input-dark w-full pl-9"
          />
        </div>
        <label className="block">
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">
            Du
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input-dark w-full"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">
            Au
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input-dark w-full"
          />
        </label>
      </div>

      {/* Summary */}
      <div className="bg-surface border border-border p-4 grid grid-cols-3 gap-4">
        <div>
          <p className="spec-label mb-1">TOTAL COMMANDES</p>
          <p className="font-display text-2xl text-neon">{total}</p>
        </div>
        <div>
          <p className="spec-label mb-1">PDF GÉNÉRÉS</p>
          <p className="font-display text-2xl text-neon">{stats.withPdf}</p>
        </div>
        <div>
          <p className="spec-label mb-1">CA TTC FILTRÉ</p>
          <p className="font-display text-2xl text-neon">{formatEuro(stats.total)}</p>
        </div>
      </div>

      {/* Registry */}
      <div className="bg-surface border border-border">
        {loading ? (
          <div className="p-6 flex items-center gap-2 font-mono text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-neon" />
            Chargement…
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-10 w-10 text-text-dim mx-auto mb-3" />
            <p className="font-mono text-sm text-text-muted">
              Aucune commande facturable pour ces filtres.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 spec-label">N° Facture</th>
                <th className="text-left px-4 py-3 spec-label">Commande</th>
                <th className="text-left px-4 py-3 spec-label">Client</th>
                <th className="text-left px-4 py-3 spec-label">Date</th>
                <th className="text-left px-4 py-3 spec-label">Paiement</th>
                <th className="text-right px-4 py-3 spec-label">HT</th>
                <th className="text-right px-4 py-3 spec-label">TVA</th>
                <th className="text-right px-4 py-3 spec-label">TTC</th>
                <th className="text-right px-4 py-3 spec-label">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.orderId} className="hover:bg-surface-2/50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {e.invoiceRef ? (
                      <span className="text-neon font-bold">{e.invoiceRef}</span>
                    ) : (
                      <span className="text-text-dim italic">non émise</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/admin/commandes?order=${e.orderId}`}
                      className="text-text hover:text-neon"
                    >
                      #{e.orderNumber}
                    </Link>
                    <p className="text-text-dim text-[10px] uppercase">{e.status}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {e.customer?.email ?? "—"}
                    {(e.customer?.firstName || e.customer?.lastName) ? (
                      <p className="text-text-dim text-[10px]">
                        {[e.customer.firstName, e.customer.lastName].filter(Boolean).join(" ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {formatDate(e.invoiceIssuedAt ?? e.orderCreatedAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <span
                      className={cn(
                        "inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                        e.paymentStatus === "PAID"
                          ? "text-neon border-neon/40 bg-neon-dim"
                          : "text-warning border-warning/40 bg-warning/10",
                      )}
                    >
                      {e.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-text-muted">
                    {formatEuro(e.subtotalHt)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-text-muted">
                    {formatEuro(e.tvaAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-neon font-bold">
                    {formatEuro(e.totalTtc)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDownload(e.orderId, e.orderNumber)}
                      disabled={downloadingId === e.orderId}
                      className="btn-outline inline-flex items-center gap-1 text-[11px] px-2 py-1 disabled:opacity-60"
                      title={e.invoiceRef ? "Télécharger" : "Générer et télécharger"}
                    >
                      {downloadingId === e.orderId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      {e.invoiceRef ? "PDF" : "Générer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
