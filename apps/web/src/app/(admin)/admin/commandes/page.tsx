"use client";

import { useEffect, useState } from "react";
import { ordersApi, type Order } from "@/lib/api";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "En attente", color: "bg-yellow-50 text-yellow-700 border border-yellow-200", icon: Clock },
  CONFIRMED: { label: "Confirmee", color: "bg-blue-50 text-blue-700 border border-blue-200", icon: CheckCircle2 },
  PREPARING: { label: "En preparation", color: "bg-indigo-50 text-indigo-700 border border-indigo-200", icon: ShoppingCart },
  SHIPPED: { label: "Expediee", color: "bg-purple-50 text-purple-700 border border-purple-200", icon: Truck },
  DELIVERED: { label: "Livree", color: "bg-green-50 text-green-700 border border-green-200", icon: PackageCheck },
  CANCELLED: { label: "Annulee", color: "bg-red-50 text-red-700 border border-red-200", icon: XCircle },
};

const PAYMENT_ICONS: Record<string, React.ElementType> = {
  card: CreditCard,
  stripe: CreditCard,
  cash: Banknote,
};

export default function AdminCommandesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await ordersApi.list({ page: 1 });
        setOrders(res.data || []);
      } catch { /* services non connectes */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const filteredOrders = statusFilter
    ? orders.filter((o) => o.status === statusFilter)
    : orders;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {orders.length} commande{orders.length !== 1 ? "s" : ""} au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setStatusFilter("")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                !statusFilter
                  ? "bg-[#28afb1] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Tous
            </button>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  statusFilter === key
                    ? "bg-[#28afb1] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">N°</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Statut</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Paiement</th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-6 py-4">
                    <div className="h-4 bg-gray-100 rounded-md animate-pulse" />
                  </td>
                </tr>
              ))
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <ShoppingCart className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">Aucune commande pour le moment</p>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const status = STATUS_CONFIG[order.status] || { label: order.status, color: "bg-gray-100 text-gray-800", icon: Clock };
                const StatusIcon = status.icon;
                const PaymentIcon = PAYMENT_ICONS[order.paymentMethod?.toLowerCase()] || CreditCard;

                return (
                  <tr key={order.id} className="hover:bg-gray-50/50 cursor-pointer transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-gray-900">#{order.orderNumber}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", status.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-500">
                        <PaymentIcon className="h-4 w-4" />
                        <span className="text-sm">{order.paymentMethod}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-gray-900">
                        {parseFloat(order.totalTtc).toFixed(2)} &euro;
                      </span>
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
