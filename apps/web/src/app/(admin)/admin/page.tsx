"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  analyticsApi,
  customersApi,
  ordersApi,
  repairsApi,
  stockApi,
  type AdminOrderSummary,
  type CustomerListItem,
  type RepairTicket,
  type StockAlert,
} from "@/lib/api";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

function isToday(iso: string): boolean {
  const value = new Date(iso);
  const now = new Date();
  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  );
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmee",
  PREPARING: "Preparation",
  SHIPPED: "Expediee",
  DELIVERED: "Livree",
  CANCELLED: "Annulee",
  REFUNDED: "Remboursee",
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  RECU: "Recu",
  EN_ATTENTE_PIECE: "Attente piece",
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revenueDay, setRevenueDay] = useState(0);
  const [revenueWeek, setRevenueWeek] = useState(0);
  const [revenueMonth, setRevenueMonth] = useState(0);

  const [ordersToday, setOrdersToday] = useState<AdminOrderSummary[]>([]);
  const [ordersToShip, setOrdersToShip] = useState<AdminOrderSummary[]>([]);
  const [pendingTickets, setPendingTickets] = useState<RepairTicket[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<CustomerListItem[]>([]);

  useEffect(() => {
    void loadDashboard();
    const interval = setInterval(() => {
      void loadDashboard();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    const [
      cockpitRes,
      kpisWeekRes,
      kpisMonthRes,
      ordersRes,
      pendingReceivedRes,
      pendingPartRes,
      stockRes,
      customersRes,
    ] = await Promise.allSettled([
      analyticsApi.cockpit(),
      analyticsApi.kpis("7d"),
      analyticsApi.kpis("30d"),
      ordersApi.adminList({ page: 1, limit: 150 }),
      repairsApi.list({ page: 1, limit: 20, status: "RECU" }),
      repairsApi.list({ page: 1, limit: 20, status: "EN_ATTENTE_PIECE" }),
      stockApi.listAlerts({ threshold: 5 }),
      customersApi.list({ page: 1, limit: 8, sort: "newest" }),
    ]);

    if (cockpitRes.status === "fulfilled") {
      setRevenueDay(cockpitRes.value.data.revenue.today || 0);
    }
    if (kpisWeekRes.status === "fulfilled") {
      setRevenueWeek(kpisWeekRes.value.data.totalRevenue || 0);
    }
    if (kpisMonthRes.status === "fulfilled") {
      setRevenueMonth(kpisMonthRes.value.data.totalRevenue || 0);
    }

    if (ordersRes.status === "fulfilled") {
      const orders = ordersRes.value.data || [];
      setOrdersToday(orders.filter((o) => isToday(o.createdAt)).slice(0, 8));
      setOrdersToShip(
        orders
          .filter((o) => o.status === "CONFIRMED" || o.status === "PREPARING")
          .slice(0, 8),
      );
    } else {
      setOrdersToday([]);
      setOrdersToShip([]);
    }

    const tickets: RepairTicket[] = [];
    if (pendingReceivedRes.status === "fulfilled") {
      tickets.push(...(pendingReceivedRes.value.data || []));
    }
    if (pendingPartRes.status === "fulfilled") {
      tickets.push(...(pendingPartRes.value.data || []));
    }
    tickets.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    setPendingTickets(tickets.slice(0, 8));

    if (stockRes.status === "fulfilled") {
      setStockAlerts(stockRes.value.data || []);
    } else {
      setStockAlerts([]);
    }

    if (customersRes.status === "fulfilled") {
      setRecentCustomers(customersRes.value.data || []);
    } else {
      setRecentCustomers([]);
    }

    const failedCount = [
      cockpitRes,
      kpisWeekRes,
      kpisMonthRes,
      ordersRes,
      pendingReceivedRes,
      pendingPartRes,
      stockRes,
      customersRes,
    ].filter((entry) => entry.status === "rejected").length;

    if (failedCount >= 4) {
      setError("Certaines donnees n'ont pas pu etre chargees. Verifie les services.");
    }

    setLoading(false);
  }

  const todayOrdersValue = useMemo(() => ordersToday.length, [ordersToday]);

  const cards = [
    {
      label: "CA du jour",
      value: formatCurrency(revenueDay),
      icon: DollarSign,
      hint: "Mise a jour toutes les 60s",
    },
    {
      label: "CA 7 jours",
      value: formatCurrency(revenueWeek),
      icon: CalendarDays,
      hint: "Fenetre glissante 7d",
    },
    {
      label: "CA 30 jours",
      value: formatCurrency(revenueMonth),
      icon: CalendarDays,
      hint: "Fenetre glissante 30d",
    },
    {
      label: "Nouvelles commandes (jour)",
      value: String(todayOrdersValue),
      icon: ShoppingCart,
      hint: "Commandes creees aujourd'hui",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="heading-lg">DASHBOARD OPERATIONS</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            Vue quotidienne: commandes, expedition, SAV, stock, clients.
          </p>
        </div>
        <button type="button" onClick={() => void loadDashboard()} className="btn-outline">
          Rafraichir
        </button>
      </div>

      {error ? (
        <div className="border border-warning/40 bg-warning/10 p-3 font-mono text-xs text-warning">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-surface border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="spec-label">{card.label}</p>
                <div className="h-9 w-9 bg-neon-dim flex items-center justify-center">
                  <Icon className="h-4 w-4 text-neon" />
                </div>
              </div>
              <p className="font-mono text-2xl font-bold text-neon mt-3">
                {loading ? <span className="inline-block w-24 h-8 bg-surface-2 animate-pulse" /> : card.value}
              </p>
              <p className="font-mono text-[11px] text-text-dim mt-1">{card.hint}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-surface border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-text">Nouvelles commandes du jour</h2>
            <Link href="/admin/commandes" className="btn-outline inline-flex items-center gap-1.5 py-1.5 px-2.5">
              Ouvrir <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {ordersToday.length === 0 ? (
              <p className="font-mono text-sm text-text-muted">Aucune nouvelle commande aujourd'hui.</p>
            ) : (
              ordersToday.map((order) => (
                <Link
                  key={order.id}
                  href="/admin/commandes"
                  className="block border border-border bg-surface-2 px-3 py-2 hover:border-neon/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-neon font-bold">#{order.orderNumber}</p>
                      <p className="font-mono text-[11px] text-text-dim">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs text-text">{formatCurrency(Number(order.totalTtc || 0))}</p>
                      <p className="font-mono text-[10px] text-text-dim">{STATUS_LABELS[order.status] || order.status}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="bg-surface border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-text">Commandes a expedier</h2>
            <Link href="/admin/commandes" className="btn-outline inline-flex items-center gap-1.5 py-1.5 px-2.5">
              Workflow <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {ordersToShip.length === 0 ? (
              <p className="font-mono text-sm text-text-muted">Rien a expedier actuellement.</p>
            ) : (
              ordersToShip.map((order) => (
                <Link
                  key={order.id}
                  href="/admin/commandes"
                  className="block border border-border bg-surface-2 px-3 py-2 hover:border-neon/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-neon font-bold">#{order.orderNumber}</p>
                      <p className="font-mono text-[11px] text-text-dim">{STATUS_LABELS[order.status] || order.status}</p>
                    </div>
                    <p className="font-mono text-xs text-text">{formatCurrency(Number(order.totalTtc || 0))}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="bg-surface border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-text inline-flex items-center gap-2">
              <Wrench className="h-4 w-4 text-neon" /> Tickets SAV en attente
            </h2>
            <Link href="/admin/sav" className="btn-outline inline-flex items-center gap-1.5 py-1.5 px-2.5">
              Voir <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {pendingTickets.length === 0 ? (
              <p className="font-mono text-sm text-text-muted">Aucun ticket en attente.</p>
            ) : (
              pendingTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href="/admin/sav"
                  className="block border border-border bg-surface-2 px-3 py-2 hover:border-neon/40"
                >
                  <p className="font-mono text-xs text-neon font-bold">SAV-{String(ticket.ticketNumber).padStart(4, "0")}</p>
                  <p className="font-mono text-[11px] text-text-dim">
                    {ticket.customerName || "Client inconnu"} · {ticket.productModel}
                  </p>
                  <p className="font-mono text-[10px] text-warning mt-1">
                    {TICKET_STATUS_LABELS[ticket.status] || ticket.status} · {ticket.priority}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="bg-surface border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-text inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Stock en alerte
            </h2>
            <Link href="/admin/stock" className="btn-outline inline-flex items-center gap-1.5 py-1.5 px-2.5">
              Voir <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {stockAlerts.length === 0 ? (
              <p className="font-mono text-sm text-text-muted">Aucune alerte stock.</p>
            ) : (
              stockAlerts.slice(0, 8).map((alert) => (
                <Link
                  key={`${alert.variantId}-${alert.severity}`}
                  href="/admin/stock"
                  className="block border border-border bg-surface-2 px-3 py-2 hover:border-neon/40"
                >
                  <p className="font-mono text-xs text-text">{alert.productName}</p>
                  <p className="font-mono text-[11px] text-text-dim">{alert.sku}</p>
                  <p
                    className={cn(
                      "font-mono text-[10px] mt-1",
                      alert.severity === "OUT_OF_STOCK" ? "text-danger" : "text-warning",
                    )}
                  >
                    {alert.severity === "OUT_OF_STOCK" ? "Rupture" : "Bas stock"} · {alert.stockQuantity}/
                    {alert.lowStockThreshold}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="bg-surface border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-text inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-neon" /> Derniers clients
            </h2>
            <Link href="/admin/clients" className="btn-outline inline-flex items-center gap-1.5 py-1.5 px-2.5">
              Voir <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentCustomers.length === 0 ? (
              <p className="font-mono text-sm text-text-muted">Aucun client recent.</p>
            ) : (
              recentCustomers.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/admin/clients/${customer.id}`}
                  className="block border border-border bg-surface-2 px-3 py-2 hover:border-neon/40"
                >
                  <p className="font-mono text-xs text-text">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="font-mono text-[11px] text-text-dim">{customer.email}</p>
                  <p className="font-mono text-[10px] text-neon mt-1">
                    {customer.customerProfile?.totalOrders || 0} commandes · {formatCurrency(Number(customer.customerProfile?.totalSpent || 0))}
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="bg-surface border border-border p-3">
        <Link href="/admin/analytics" className="inline-flex items-center gap-2 font-mono text-xs text-text-muted hover:text-neon">
          <Package className="h-4 w-4" />
          Ouvrir les analytics detaillees
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
