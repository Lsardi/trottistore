"use client";

import { useEffect, useState } from "react";
import { ordersApi, type Order } from "@/lib/api";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "En attente", color: "bg-yellow-100 text-yellow-800" },
  CONFIRMED: { label: "Confirmée", color: "bg-blue-100 text-blue-800" },
  PREPARING: { label: "En préparation", color: "bg-indigo-100 text-indigo-800" },
  SHIPPED: { label: "Expédiée", color: "bg-purple-100 text-purple-800" },
  DELIVERED: { label: "Livrée", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Annulée", color: "bg-red-100 text-red-800" },
};

export default function AdminCommandesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await ordersApi.list({ page: 1 });
        setOrders(res.data || []);
      } catch { /* services non connectés */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">N°</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Date</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Statut</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Paiement</th>
              <th className="text-right px-6 py-3 text-gray-500 font-medium">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={5} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  Aucune commande pour le moment
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const status = STATUS_LABELS[order.status] || { label: order.status, color: "bg-gray-100 text-gray-800" };
                return (
                  <tr key={order.id} className="border-b hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 font-mono font-medium">#{order.orderNumber}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{order.paymentMethod}</td>
                    <td className="px-6 py-4 text-right font-semibold">
                      {parseFloat(order.totalTtc).toFixed(2)} €
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
