"use client";

import { useEffect, useState } from "react";
import { repairsApi, type RepairTicket } from "@/lib/api";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NOUVEAU: { label: "Nouveau", color: "bg-blue-100 text-blue-800" },
  DIAGNOSTIQUE: { label: "Diagnostiqué", color: "bg-indigo-100 text-indigo-800" },
  DEVIS_ENVOYE: { label: "Devis envoyé", color: "bg-yellow-100 text-yellow-800" },
  DEVIS_ACCEPTE: { label: "Devis accepté", color: "bg-green-100 text-green-800" },
  EN_REPARATION: { label: "En réparation", color: "bg-purple-100 text-purple-800" },
  EN_ATTENTE_PIECE: { label: "Attente pièce", color: "bg-orange-100 text-orange-800" },
  TERMINE: { label: "Terminé", color: "bg-teal-100 text-teal-800" },
  LIVRE: { label: "Livré", color: "bg-green-200 text-green-900" },
  REFUS_CLIENT: { label: "Refusé", color: "bg-red-100 text-red-800" },
  IRREPARABLE: { label: "Irréparable", color: "bg-gray-200 text-gray-800" },
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-gray-400",
  NORMAL: "text-blue-500",
  HIGH: "text-orange-500",
  URGENT: "text-red-600 font-bold",
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
      } catch { /* SAV non connecté */ }
      finally { setLoading(false); }
    }
    load();
  }, [statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tickets SAV</h1>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Ouverts", count: tickets.filter((t) => !["LIVRE", "REFUS_CLIENT", "IRREPARABLE"].includes(t.status)).length, color: "text-blue-600" },
          { label: "En réparation", count: tickets.filter((t) => t.status === "EN_REPARATION").length, color: "text-purple-600" },
          { label: "Attente pièce", count: tickets.filter((t) => t.status === "EN_ATTENTE_PIECE").length, color: "text-orange-600" },
          { label: "Terminés", count: tickets.filter((t) => ["TERMINE", "LIVRE"].includes(t.status)).length, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg p-4 border border-gray-100">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">N° Ticket</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Modèle</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Type</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Priorité</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Statut</th>
              <th className="text-right px-6 py-3 text-gray-500 font-medium">Coût est.</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={7} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  Aucun ticket SAV
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => {
                const status = STATUS_LABELS[ticket.status] || { label: ticket.status, color: "bg-gray-100" };
                return (
                  <tr key={ticket.id} className="border-b hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 font-mono font-medium">
                      SAV-{String(ticket.ticketNumber).padStart(4, "0")}
                    </td>
                    <td className="px-6 py-4 text-gray-900">{ticket.productModel}</td>
                    <td className="px-6 py-4 text-gray-500">{ticket.type}</td>
                    <td className={`px-6 py-4 ${PRIORITY_COLORS[ticket.priority] || ""}`}>
                      {ticket.priority}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {ticket.estimatedCost ? `${parseFloat(ticket.estimatedCost).toFixed(2)} €` : "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}
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
