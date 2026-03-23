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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NOUVEAU: { label: "Nouveau", color: "bg-blue-50 text-blue-700 border border-blue-200" },
  DIAGNOSTIQUE: { label: "Diagnostique", color: "bg-indigo-50 text-indigo-700 border border-indigo-200" },
  DEVIS_ENVOYE: { label: "Devis envoye", color: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
  DEVIS_ACCEPTE: { label: "Devis accepte", color: "bg-green-50 text-green-700 border border-green-200" },
  EN_REPARATION: { label: "En reparation", color: "bg-purple-50 text-purple-700 border border-purple-200" },
  EN_ATTENTE_PIECE: { label: "Attente piece", color: "bg-orange-50 text-orange-700 border border-orange-200" },
  TERMINE: { label: "Termine", color: "bg-[#28afb1]/10 text-[#28afb1] border border-[#28afb1]/20" },
  LIVRE: { label: "Livre", color: "bg-green-50 text-green-800 border border-green-300" },
  REFUS_CLIENT: { label: "Refuse", color: "bg-red-50 text-red-700 border border-red-200" },
  IRREPARABLE: { label: "Irreparable", color: "bg-gray-100 text-gray-600 border border-gray-200" },
};

const PRIORITY_CONFIG: Record<string, { color: string; dotClass: string }> = {
  LOW: { color: "text-gray-500", dotClass: "bg-gray-400" },
  NORMAL: { color: "text-blue-600", dotClass: "bg-blue-500" },
  HIGH: { color: "text-orange-600", dotClass: "bg-orange-500" },
  URGENT: { color: "text-red-600 font-bold", dotClass: "bg-red-500 animate-pulse" },
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
      count: tickets.filter((t) => !["LIVRE", "REFUS_CLIENT", "IRREPARABLE"].includes(t.status)).length,
      icon: Clock,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "En reparation",
      count: tickets.filter((t) => t.status === "EN_REPARATION").length,
      icon: Cog,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      label: "Attente piece",
      count: tickets.filter((t) => t.status === "EN_ATTENTE_PIECE").length,
      icon: PackageSearch,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      label: "Termines",
      count: tickets.filter((t) => ["TERMINE", "LIVRE"].includes(t.status)).length,
      icon: CheckCircle2,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets SAV</h1>
          <p className="text-sm text-gray-500 mt-1">Suivi des reparations et du service apres-vente</p>
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition-all cursor-pointer"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", s.iconBg)}>
                  <Icon className={cn("h-5 w-5", s.iconColor)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{s.count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">N° Ticket</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Modele</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Priorite</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Statut</th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Cout est.</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-6 py-4">
                    <div className="h-4 bg-gray-100 rounded-md animate-pulse" />
                  </td>
                </tr>
              ))
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <Wrench className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">Aucun ticket SAV</p>
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => {
                const status = STATUS_LABELS[ticket.status] || { label: ticket.status, color: "bg-gray-100 text-gray-600" };
                const priority = PRIORITY_CONFIG[ticket.priority] || { color: "text-gray-500", dotClass: "bg-gray-400" };

                return (
                  <tr key={ticket.id} className="hover:bg-gray-50/50 cursor-pointer transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-gray-900">
                        SAV-{String(ticket.ticketNumber).padStart(4, "0")}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{ticket.productModel}</td>
                    <td className="px-6 py-4 text-gray-500">{ticket.type}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", priority.dotClass)} />
                        <span className={cn("text-sm font-medium", priority.color)}>
                          {ticket.priority}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", status.color)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {ticket.estimatedCost ? `${parseFloat(ticket.estimatedCost).toFixed(2)} \u20AC` : "\u2014"}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
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
