"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type RealtimeKpis } from "@/lib/api";
import {
  DollarSign,
  ShoppingCart,
  Wrench,
  AlertTriangle,
  ArrowRight,
  Package,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

export default function AdminDashboard() {
  const [kpis, setKpis] = useState<RealtimeKpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await analyticsApi.realtime();
        setKpis(res.data);
      } catch {
        // Services pas encore connectes
      } finally {
        setLoading(false);
      }
    }
    load();
    // Refresh toutes les 30 secondes
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const KPI_CARDS = [
    {
      label: "CA Aujourd'hui",
      value: kpis ? formatCurrency(kpis.revenueToday) : "---",
      comparison: kpis ? `Hier : ${formatCurrency(kpis.revenueYesterday)}` : "",
      icon: DollarSign,
    },
    {
      label: "Commandes aujourd'hui",
      value: kpis ? String(kpis.ordersToday) : "---",
      comparison: "",
      icon: ShoppingCart,
    },
    {
      label: "Tickets SAV ouverts",
      value: kpis ? String(kpis.openSavTickets) : "---",
      comparison: "",
      icon: Wrench,
    },
    {
      label: "Alertes stock",
      value: kpis ? String(kpis.lowStockAlerts) : "---",
      comparison: "Produits sous seuil critique",
      icon: AlertTriangle,
      isDanger: true,
    },
  ];

  const QUICK_ACTIONS = [
    {
      title: "Commandes",
      description: "Gerer les commandes en cours",
      href: "/admin/commandes",
      icon: ShoppingCart,
    },
    {
      title: "Tickets SAV",
      description: "Suivre les reparations en cours",
      href: "/admin/sav",
      icon: Wrench,
    },
    {
      title: "Catalogue",
      description: "Gerer les produits et le stock",
      href: "/admin/produits",
      icon: Package,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-lg">DASHBOARD</h1>
          <p className="font-mono text-sm text-text-muted mt-1">Vue d&apos;ensemble de votre activite</p>
        </div>
        <div className="flex items-center gap-2 bg-surface border border-border px-4 py-2">
          <span
            className={cn(
              "h-2 w-2",
              kpis ? "bg-neon animate-neon-pulse" : "bg-text-dim"
            )}
          />
          <span className="font-mono text-xs text-text-muted">
            {kpis ? "Temps reel" : "En attente..."}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPI_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-surface border border-border p-6 hover:border-neon/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="spec-label">{card.label}</p>
                <div className={cn("flex h-10 w-10 items-center justify-center", card.isDanger ? "bg-danger/10" : "bg-neon-dim")}>
                  <Icon className={cn("h-5 w-5", card.isDanger ? "text-danger" : "text-neon")} />
                </div>
              </div>
              <p className="font-mono text-3xl font-bold text-neon">
                {loading ? (
                  <span className="inline-block w-24 h-9 bg-surface-2 animate-pulse" />
                ) : (
                  card.value
                )}
              </p>
              {card.comparison && (
                <p className="font-mono text-xs text-text-dim mt-2">{card.comparison}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <a
              key={action.title}
              href={action.href}
              className="group bg-surface border border-border p-6 hover:border-neon/40 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center bg-surface-2 border border-border group-hover:border-neon/30 transition-colors">
                  <Icon className="h-5 w-5 text-text-dim group-hover:text-neon transition-colors" />
                </div>
                <ArrowRight className="h-4 w-4 text-text-dim group-hover:text-neon transition-colors" />
              </div>
              <h3 className="font-display font-bold text-text mt-4 group-hover:text-neon transition-colors">
                {action.title}
              </h3>
              <p className="font-mono text-xs text-text-muted mt-1">{action.description}</p>
            </a>
          );
        })}
      </div>

      {/* Placeholder Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-neon" />
            <h3 className="font-display font-bold text-text">Ventes cette semaine</h3>
          </div>
          <div className="h-48 flex items-center justify-center bg-surface-2 border border-border text-text-dim font-mono text-sm">
            <div className="text-center">
              <BarChart3 className="h-10 w-10 text-text-dim mx-auto mb-2" />
              <p>Graphique disponible apres connexion aux services</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-5 w-5 text-neon" />
            <h3 className="font-display font-bold text-text">Dernieres commandes</h3>
          </div>
          <div className="h-48 flex items-center justify-center bg-surface-2 border border-border text-text-dim font-mono text-sm">
            <div className="text-center">
              <Package className="h-10 w-10 text-text-dim mx-auto mb-2" />
              <p>Liste des commandes recentes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
