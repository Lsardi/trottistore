"use client";

import { useEffect, useState } from "react";
import { repairsApi, type RepairTicket } from "@/lib/api";
import {
  Wrench,
  Clock,
  Cog,
  PackageSearch,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  RECU: { label: "Recu", badgeClass: "badge badge-neon" },
  DIAGNOSTIC: { label: "Diagnostic", badgeClass: "badge badge-muted" },
  DEVIS_ENVOYE: { label: "Devis envoye", badgeClass: "badge badge-warning" },
  DEVIS_ACCEPTE: { label: "Devis accepte", badgeClass: "badge badge-neon" },
  EN_REPARATION: { label: "En reparation", badgeClass: "badge badge-muted" },
  EN_ATTENTE_PIECE: { label: "Attente piece", badgeClass: "badge badge-warning" },
  PRET: { label: "Pret", badgeClass: "badge badge-neon" },
  RECUPERE: { label: "Recupere", badgeClass: "badge badge-neon" },
  REFUS_CLIENT: { label: "Refuse", badgeClass: "badge badge-danger" },
  IRREPARABLE: { label: "Irreparable", badgeClass: "badge badge-muted" },
};

const PRIORITY_CONFIG: Record<string, { color: string; dotClass: string }> = {
  LOW: { color: "text-text-dim", dotClass: "bg-text-dim" },
  NORMAL: { color: "text-text-muted", dotClass: "bg-text-muted" },
  HIGH: { color: "text-warning", dotClass: "bg-warning" },
  URGENT: { color: "text-danger font-bold", dotClass: "bg-danger animate-neon-pulse" },
};

export default function AdminSavPage() {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await repairsApi.list({ status: statusFilter || undefined, page: 1 });
        setTickets(res.data || []);
      } catch { /* SAV non connecte */ }
      finally { setLoading(false); }
    }
    load();
  }, [statusFilter]);

  const STAT_CARDS = [
    {
      label: "Ouverts",
      count: tickets.filter((t) => !["RECUPERE", "REFUS_CLIENT", "IRREPARABLE"].includes(t.status)).length,
      icon: Clock,
    },
    {
      label: "En reparation",
      count: tickets.filter((t) => t.status === "EN_REPARATION").length,
      icon: Cog,
    },
    {
      label: "Attente piece",
      count: tickets.filter((t) => t.status === "EN_ATTENTE_PIECE").length,
      icon: PackageSearch,
    },
    {
      label: "Termines",
      count: tickets.filter((t) => ["PRET", "RECUPERE"].includes(t.status)).length,
      icon: CheckCircle2,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-lg">TICKETS SAV</h1>
          <p className="font-mono text-sm text-text-muted mt-1">Suivi des reparations et du service apres-vente</p>
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-dark appearance-none pl-4 pr-10 py-2.5 cursor-pointer"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim pointer-events-none" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-surface border border-border p-4 hover:border-neon/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center bg-neon-dim">
                  <Icon className="h-5 w-5 text-neon" />
                </div>
                <div>
                  <p className="spec-label">{s.label}</p>
                  <p className="font-mono text-2xl font-bold text-neon">{s.count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="text-left px-6 py-3.5 spec-label">N&deg; Ticket</th>
              <th className="text-left px-6 py-3.5 spec-label">Modele</th>
              <th className="text-left px-6 py-3.5 spec-label">Type</th>
              <th className="text-left px-6 py-3.5 spec-label">Priorite</th>
              <th className="text-left px-6 py-3.5 spec-label">Statut</th>
              <th className="text-right px-6 py-3.5 spec-label">Cout est.</th>
              <th className="text-left px-6 py-3.5 spec-label">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-6 py-4">
                    <div className="h-4 bg-surface-2 animate-pulse" />
                  </td>
                </tr>
              ))
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <Wrench className="h-10 w-10 text-text-dim mx-auto mb-3" />
                  <p className="font-mono text-text-muted">Aucun ticket SAV</p>
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => {
                const status = STATUS_LABELS[ticket.status] || { label: ticket.status, badgeClass: "badge badge-muted" };
                const priority = PRIORITY_CONFIG[ticket.priority] || { color: "text-text-dim", dotClass: "bg-text-dim" };

                return (
                  <tr key={ticket.id} className="hover:bg-surface-2/50 cursor-pointer transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-neon">
                        SAV-{String(ticket.ticketNumber).padStart(4, "0")}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-text">{ticket.productModel}</td>
                    <td className="px-6 py-4 font-mono text-xs text-text-muted">{ticket.type}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 flex-shrink-0", priority.dotClass)} />
                        <span className={cn("font-mono text-xs", priority.color)}>
                          {ticket.priority}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={status.badgeClass}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm font-bold text-neon">
                      {ticket.estimatedCost ? `${parseFloat(ticket.estimatedCost).toFixed(2)} \u20AC` : "\u2014"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-text-muted">
                      {new Date(ticket.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
