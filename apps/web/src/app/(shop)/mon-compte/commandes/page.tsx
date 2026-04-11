"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
  ExternalLink,
} from "lucide-react";
import { ordersApi, type Order } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  PREPARING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

const STATUS_ICON: Record<string, typeof Clock> = {
  PENDING: Clock,
  CONFIRMED: CheckCircle,
  PREPARING: Package,
  SHIPPED: Truck,
  DELIVERED: CheckCircle,
  CANCELLED: XCircle,
  REFUNDED: XCircle,
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-warning/15 text-warning border-warning/30",
  CONFIRMED: "bg-neon/15 text-neon border-neon/30",
  PREPARING: "bg-neon/15 text-neon border-neon/30",
  SHIPPED: "bg-neon/15 text-neon border-neon/30",
  DELIVERED: "bg-neon/15 text-neon border-neon/30",
  CANCELLED: "bg-text-dim/15 text-text-dim border-border",
  REFUNDED: "bg-text-dim/15 text-text-dim border-border",
};

type Filter = "ALL" | "IN_PROGRESS" | "DELIVERED" | "CANCELLED";

const FILTER_GROUPS: Record<Filter, string[]> = {
  ALL: [],
  IN_PROGRESS: ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"],
  DELIVERED: ["DELIVERED"],
  CANCELLED: ["CANCELLED", "REFUNDED"],
};

function formatPrice(amount: string | number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(amount));
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function downloadInvoice(orderId: string, orderNumber: number) {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (!token) return;
  fetch(`/api/v1/orders/${orderId}/invoice`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("invoice_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `facture-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch(() => {
      alert("Téléchargement impossible. Réessayez plus tard.");
    });
}

export default function MesCommandesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) {
      window.location.href = "/mon-compte";
      return;
    }
    let cancelled = false;
    setLoading(true);
    ordersApi
      .list({ page: 1 })
      .then((res) => {
        if (cancelled) return;
        setOrders(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger vos commandes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleOrders = filter === "ALL"
    ? orders
    : orders.filter((o) => FILTER_GROUPS[filter].includes(o.status));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/mon-compte"
        className="font-mono text-xs text-neon hover:underline mb-6 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-3 h-3" />
        Mon compte
      </Link>

      <div className="mb-6">
        <h1 className="heading-md">MES COMMANDES</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          {orders.length} {orders.length > 1 ? "commandes" : "commande"} au total
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["ALL", "IN_PROGRESS", "DELIVERED", "CANCELLED"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 font-mono text-xs uppercase border transition-colors",
              filter === f
                ? "bg-neon text-void border-neon"
                : "bg-surface text-text-muted border-border hover:border-neon",
            )}
          >
            {f === "ALL" && "Toutes"}
            {f === "IN_PROGRESS" && "En cours"}
            {f === "DELIVERED" && "Livrées"}
            {f === "CANCELLED" && "Annulées / Remboursées"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-surface border border-border p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-neon mx-auto" />
        </div>
      ) : error ? (
        <div className="bg-surface border border-danger/30 p-6 text-center">
          <p className="font-mono text-sm text-danger">{error}</p>
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="bg-surface border border-border p-12 text-center">
          <Package className="w-12 h-12 text-text-dim mx-auto mb-4" />
          <p className="font-mono text-sm text-text-muted mb-4">
            {filter === "ALL"
              ? "Vous n'avez encore passé aucune commande."
              : "Aucune commande ne correspond à ce filtre."}
          </p>
          {filter === "ALL" && (
            <Link href="/produits" className="btn-neon inline-flex">
              VOIR LE CATALOGUE
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order) => {
            const StatusIcon = STATUS_ICON[order.status] || Clock;
            const badgeClass = STATUS_BADGE[order.status] || STATUS_BADGE.PENDING;
            const itemsCount = order.itemsCount ?? order.items?.length ?? 0;
            return (
              <div
                key={order.id}
                className="bg-surface border border-border p-5"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-display font-bold text-text">Commande #{order.orderNumber}</p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono uppercase border",
                          badgeClass,
                        )}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-text-muted">
                      Passée le {formatDate(order.createdAt)}
                      {itemsCount > 0 && ` · ${itemsCount} article${itemsCount > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <p className="font-display font-bold text-neon text-lg">
                    {formatPrice(order.totalTtc)}
                  </p>
                </div>

                {/* Tracking + invoice actions */}
                <div className="flex gap-2 flex-wrap pt-3 border-t border-border">
                  {order.trackingNumber && (
                    <span className="font-mono text-[11px] text-text-muted inline-flex items-center gap-1">
                      <Truck className="w-3 h-3 text-neon" />
                      Tracking: <span className="text-text">{order.trackingNumber}</span>
                    </span>
                  )}
                  {(order.status === "DELIVERED" ||
                    order.status === "SHIPPED" ||
                    order.status === "CONFIRMED" ||
                    order.status === "PREPARING") && (
                    <button
                      onClick={() => downloadInvoice(order.id, order.orderNumber)}
                      className="font-mono text-xs text-neon hover:underline inline-flex items-center gap-1"
                    >
                      <Receipt className="w-3 h-3" />
                      Télécharger la facture
                    </button>
                  )}
                  <Link
                    href={`/produits`}
                    className="font-mono text-xs text-text-muted hover:text-neon inline-flex items-center gap-1 ml-auto"
                  >
                    Recommander
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
