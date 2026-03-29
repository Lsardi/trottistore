"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type CockpitSnapshot } from "@/lib/api";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  DollarSign,
  MessageSquare,
  Package,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

function formatShortDate(input: string): string {
  return new Date(input).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SAV_STATUS_LABELS: Record<string, string> = {
  RECU: "Recu",
  EN_ATTENTE_PIECE: "Attente piece",
};

export default function AdminDashboard() {
  const [cockpit, setCockpit] = useState<CockpitSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await analyticsApi.cockpit();
        setCockpit(res.data);
      } catch {
        setCockpit(null);
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  const kpiCards = [
    {
      label: "CA Aujourd'hui",
      value: cockpit ? formatCurrency(cockpit.revenue.today) : "---",
      comparison: cockpit ? `Hier: ${formatCurrency(cockpit.revenue.yesterday)}` : "",
      icon: DollarSign,
    },
    {
      label: "Commandes à préparer",
      value: cockpit ? String(cockpit.ordersToPrepare.length) : "---",
      comparison: "Statut CONFIRMED",
      icon: ShoppingCart,
    },
    {
      label: "SAV en attente",
      value: cockpit ? String(cockpit.savWaiting.length) : "---",
      comparison: "Recu + attente piece",
      icon: Wrench,
    },
    {
      label: "Stock critique",
      value: cockpit ? String(cockpit.lowStock.length) : "---",
      comparison: "Sous seuil mini",
      icon: AlertTriangle,
      isDanger: true,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-lg">DASHBOARD</h1>
          <p className="font-mono text-sm text-text-muted mt-1">Vue 360 du magasin: ventes, SAV, RDV, stock, CRM</p>
        </div>
        <div className="flex items-center gap-2 bg-surface border border-border px-4 py-2">
          <span className={cn("h-2 w-2", cockpit ? "bg-neon animate-neon-pulse" : "bg-text-dim")} />
          <span className="font-mono text-xs text-text-muted">
            {cockpit ? `Maj ${formatShortDate(cockpit.updatedAt)}` : "En attente..."}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-surface border border-border p-6 hover:border-neon/30 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <p className="spec-label">{card.label}</p>
                <div className={cn("flex h-10 w-10 items-center justify-center", card.isDanger ? "bg-danger/10" : "bg-neon-dim")}>
                  <Icon className={cn("h-5 w-5", card.isDanger ? "text-danger" : "text-neon")} />
                </div>
              </div>
              <p className="font-mono text-3xl font-bold text-neon">
                {loading ? <span className="inline-block w-20 h-8 bg-surface-2 animate-pulse" /> : card.value}
              </p>
              <p className="font-mono text-xs text-text-dim mt-2">{card.comparison}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <a href="/admin/commandes" className="group bg-surface border border-border p-5 hover:border-neon/40 transition-all">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold text-text">Commandes à préparer</p>
            <ArrowRight className="h-4 w-4 text-text-dim group-hover:text-neon transition-colors" />
          </div>
          <p className="font-mono text-xs text-text-muted mt-2">Voir et traiter les confirmations</p>
        </a>
        <a href="/admin/sav" className="group bg-surface border border-border p-5 hover:border-neon/40 transition-all">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold text-text">SAV en attente</p>
            <ArrowRight className="h-4 w-4 text-text-dim group-hover:text-neon transition-colors" />
          </div>
          <p className="font-mono text-xs text-text-muted mt-2">Prioriser les tickets bloquants</p>
        </a>
        <a href="/admin/stock" className="group bg-surface border border-border p-5 hover:border-neon/40 transition-all">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold text-text">Stock critique</p>
            <ArrowRight className="h-4 w-4 text-text-dim group-hover:text-neon transition-colors" />
          </div>
          <p className="font-mono text-xs text-text-muted mt-2">Réappro à déclencher</p>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-surface border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-5 w-5 text-neon" />
            <h3 className="font-display font-bold text-text">Commandes à préparer</h3>
          </div>
          {cockpit?.ordersToPrepare.length ? (
            <div className="space-y-3">
              {cockpit.ordersToPrepare.slice(0, 6).map((order) => (
                <div key={order.id} className="flex items-center justify-between border border-border bg-surface-2 px-3 py-2">
                  <div>
                    <p className="font-mono text-xs text-neon font-bold">#{order.orderNumber}</p>
                    <p className="font-mono text-[11px] text-text-dim">{formatShortDate(order.createdAt)}</p>
                  </div>
                  <p className="font-mono text-xs text-text">{formatCurrency(parseFloat(order.totalTtc))}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-mono text-sm text-text-muted">Aucune commande à préparer</p>
          )}
        </div>

        <div className="bg-surface border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-5 w-5 text-neon" />
            <h3 className="font-display font-bold text-text">RDV du jour</h3>
          </div>
          {cockpit?.appointmentsToday.length ? (
            <div className="space-y-3">
              {cockpit.appointmentsToday.slice(0, 6).map((rdv) => (
                <div key={rdv.id} className="flex items-center justify-between border border-border bg-surface-2 px-3 py-2">
                  <div>
                    <p className="font-mono text-xs text-text">{rdv.customerName}</p>
                    <p className="font-mono text-[11px] text-text-dim">
                      {formatShortDate(rdv.startsAt)} - {rdv.serviceType}
                    </p>
                  </div>
                  <span className={cn("font-mono text-[10px]", rdv.isExpress ? "text-warning" : "text-text-dim")}>
                    {rdv.isExpress ? "EXPRESS" : rdv.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-mono text-sm text-text-muted">Aucun RDV aujourd'hui</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-5 w-5 text-neon" />
            <h3 className="font-display font-bold text-text">SAV en attente</h3>
          </div>
          {cockpit?.savWaiting.length ? (
            <div className="space-y-3">
              {cockpit.savWaiting.slice(0, 6).map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between border border-border bg-surface-2 px-3 py-2">
                  <div>
                    <p className="font-mono text-xs text-neon font-bold">SAV-{String(ticket.ticketNumber).padStart(4, "0")}</p>
                    <p className="font-mono text-[11px] text-text-dim">{ticket.productModel}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[11px] text-text">{SAV_STATUS_LABELS[ticket.status] ?? ticket.status}</p>
                    <p className={cn("font-mono text-[10px]", ticket.priority === "URGENT" ? "text-danger" : "text-text-dim")}>
                      {ticket.priority}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-mono text-sm text-text-muted">Aucun ticket en attente</p>
          )}
        </div>

        <div className="bg-surface border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-neon" />
            <h3 className="font-display font-bold text-text">Stock critique</h3>
          </div>
          {cockpit?.lowStock.length ? (
            <div className="space-y-3">
              {cockpit.lowStock.slice(0, 6).map((variant) => (
                <div key={variant.id} className="flex items-center justify-between border border-border bg-surface-2 px-3 py-2">
                  <div>
                    <p className="font-mono text-xs text-text">{variant.product.name}</p>
                    <p className="font-mono text-[11px] text-text-dim">{variant.sku}</p>
                  </div>
                  <p className="font-mono text-xs text-warning">
                    {variant.stockQuantity}/{variant.lowStockThreshold}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-mono text-sm text-text-muted">Aucun produit sous seuil</p>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border p-6 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-neon" />
          <h3 className="font-display font-bold text-text">Dernieres interactions CRM</h3>
        </div>
        {cockpit?.crmInteractions.length ? (
          <div className="space-y-3">
            {cockpit.crmInteractions.map((interaction) => (
              <div key={interaction.id} className="flex items-center justify-between border border-border bg-surface-2 px-3 py-2">
                <div>
                  <p className="font-mono text-xs text-text">
                    {interaction.customer.firstName} {interaction.customer.lastName}
                  </p>
                  <p className="font-mono text-[11px] text-text-dim">
                    {interaction.type} · {interaction.channel} · {interaction.subject ?? "Sans sujet"}
                  </p>
                </div>
                <p className="font-mono text-[11px] text-text-dim">{formatShortDate(interaction.createdAt)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-mono text-sm text-text-muted">Aucune interaction CRM recente</p>
        )}
      </div>
    </div>
  );
}
