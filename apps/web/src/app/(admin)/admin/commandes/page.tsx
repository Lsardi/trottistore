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

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: React.ElementType }> = {
  PENDING: { label: "En attente", badgeClass: "badge badge-warning", icon: Clock },
  CONFIRMED: { label: "Confirmee", badgeClass: "badge badge-neon", icon: CheckCircle2 },
  PREPARING: { label: "En preparation", badgeClass: "badge badge-muted", icon: ShoppingCart },
  SHIPPED: { label: "Expediee", badgeClass: "badge badge-neon", icon: Truck },
  DELIVERED: { label: "Livree", badgeClass: "badge badge-neon", icon: PackageCheck },
  CANCELLED: { label: "Annulee", badgeClass: "badge badge-danger", icon: XCircle },
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
          <h1 className="heading-lg">COMMANDES</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            {orders.length} commande{orders.length !== 1 ? "s" : ""} au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-text-dim" />
          <div className="flex gap-1.5 flex-wrap">
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
      </div>

      {/* Table */}
      <div className="bg-surface border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="text-left px-6 py-3.5 spec-label">N&deg;</th>
              <th className="text-left px-6 py-3.5 spec-label">Date</th>
              <th className="text-left px-6 py-3.5 spec-label">Statut</th>
              <th className="text-left px-6 py-3.5 spec-label">Paiement</th>
              <th className="text-right px-6 py-3.5 spec-label">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-6 py-4">
                    <div className="h-4 bg-surface-2 animate-pulse" />
                  </td>
                </tr>
              ))
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <ShoppingCart className="h-10 w-10 text-text-dim mx-auto mb-3" />
                  <p className="font-mono text-text-muted">Aucune commande pour le moment</p>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const status = STATUS_CONFIG[order.status] || { label: order.status, badgeClass: "badge badge-muted", icon: Clock };
                const StatusIcon = status.icon;
                const PaymentIcon = PAYMENT_ICONS[order.paymentMethod?.toLowerCase()] || CreditCard;

                return (
                  <tr key={order.id} className="hover:bg-surface-2/50 cursor-pointer transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-neon">#{order.orderNumber}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-text-muted text-xs">
                      {new Date(order.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center gap-1.5", status.badgeClass)}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono text-text-muted text-xs">
                        <PaymentIcon className="h-4 w-4 text-text-dim" />
                        <span>{order.paymentMethod}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono font-bold text-neon">
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
