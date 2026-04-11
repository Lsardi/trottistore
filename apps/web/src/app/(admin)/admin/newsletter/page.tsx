"use client";

import { useEffect, useState } from "react";
import { Mail, Download, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { newsletterAdminApi, type NewsletterSubscriber, type NewsletterStatus } from "@/lib/api";

const STATUS_BADGE: Record<NewsletterStatus, { label: string; className: string }> = {
  PENDING: { label: "En attente", className: "bg-warning/15 text-warning border-warning/30" },
  CONFIRMED: { label: "Confirmé", className: "bg-neon/15 text-neon border-neon/30" },
  UNSUBSCRIBED: { label: "Désinscrit", className: "bg-text-dim/15 text-text-dim border-border" },
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminNewsletterPage() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<NewsletterStatus | "ALL">("ALL");
  const [counts, setCounts] = useState({ PENDING: 0, CONFIRMED: 0, UNSUBSCRIBED: 0 });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await newsletterAdminApi.list({
          status: statusFilter,
          search: search.trim() || undefined,
          limit: 200,
        });
        if (cancelled) return;
        setSubscribers(res.data || []);
        setCounts({
          PENDING: res.counts?.PENDING ?? 0,
          CONFIRMED: res.counts?.CONFIRMED ?? 0,
          UNSUBSCRIBED: res.counts?.UNSUBSCRIBED ?? 0,
        });
        setTotal(res.pagination?.total ?? 0);
      } catch {
        if (!cancelled) setSubscribers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, search]);

  function handleExport(status: NewsletterStatus | "ALL") {
    const url = `/api/v1/newsletter/admin/export.csv?status=${status}`;
    // Use fetch + blob to inject the auth header (the simple <a download> wouldn't carry it).
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `newsletter-${status.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        alert("Export impossible. Vérifiez vos droits.");
      });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="heading-md flex items-center gap-3">
            <Mail className="w-6 h-6 text-neon" />
            NEWSLETTER
          </h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            {total} {total > 1 ? "abonnés" : "abonné"} (filtre actif)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("CONFIRMED")}
            className="btn-neon text-xs flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            EXPORT CSV (CONFIRMÉS)
          </button>
          <button
            onClick={() => handleExport("ALL")}
            className="btn-outline text-xs flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            EXPORT CSV (TOUS)
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface border border-border p-4">
          <p className="font-mono text-xs text-text-muted uppercase">Confirmés</p>
          <p className="font-display font-bold text-2xl text-neon">{counts.CONFIRMED}</p>
        </div>
        <div className="bg-surface border border-border p-4">
          <p className="font-mono text-xs text-text-muted uppercase">En attente</p>
          <p className="font-display font-bold text-2xl text-warning">{counts.PENDING}</p>
        </div>
        <div className="bg-surface border border-border p-4">
          <p className="font-mono text-xs text-text-muted uppercase">Désinscrits</p>
          <p className="font-display font-bold text-2xl text-text-dim">{counts.UNSUBSCRIBED}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
          <input
            type="text"
            placeholder="Rechercher un email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark w-full pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as NewsletterStatus | "ALL")}
          className="input-dark"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="CONFIRMED">Confirmés</option>
          <option value="PENDING">En attente</option>
          <option value="UNSUBSCRIBED">Désinscrits</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-neon mx-auto" />
          </div>
        ) : subscribers.length === 0 ? (
          <div className="p-12 text-center font-mono text-sm text-text-muted">
            Aucun abonné trouvé
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-3 font-mono text-xs uppercase text-text-muted">Email</th>
                <th className="px-4 py-3 font-mono text-xs uppercase text-text-muted">Statut</th>
                <th className="px-4 py-3 font-mono text-xs uppercase text-text-muted">Source</th>
                <th className="px-4 py-3 font-mono text-xs uppercase text-text-muted">Inscription</th>
                <th className="px-4 py-3 font-mono text-xs uppercase text-text-muted">Confirmé le</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => {
                const badge = STATUS_BADGE[sub.status];
                return (
                  <tr key={sub.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                    <td className="px-4 py-3 font-mono text-text">{sub.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-mono uppercase border", badge.className)}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {sub.source || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {formatDate(sub.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {formatDate(sub.confirmedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
