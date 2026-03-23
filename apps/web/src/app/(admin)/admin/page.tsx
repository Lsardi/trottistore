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
      iconBg: "bg-[#28afb1]/10",
      iconColor: "text-[#28afb1]",
    },
    {
      label: "Commandes aujourd'hui",
      value: kpis ? String(kpis.ordersToday) : "---",
      comparison: "",
      icon: ShoppingCart,
      iconBg: "bg-[#28afb1]/10",
      iconColor: "text-[#28afb1]",
    },
    {
      label: "Tickets SAV ouverts",
      value: kpis ? String(kpis.openSavTickets) : "---",
      comparison: "",
      icon: Wrench,
      iconBg: "bg-[#28afb1]/10",
      iconColor: "text-[#28afb1]",
    },
    {
      label: "Alertes stock",
      value: kpis ? String(kpis.lowStockAlerts) : "---",
      comparison: "Produits sous seuil critique",
      icon: AlertTriangle,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de votre activite</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm border border-gray-100">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              kpis ? "bg-green-500 animate-pulse" : "bg-gray-400"
            )}
          />
          <span className="text-xs font-medium text-gray-600">
            {kpis ? "Temps reel" : "En attente..."}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {KPI_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", card.iconBg)}>
                  <Icon className={cn("h-5 w-5", card.iconColor)} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? (
                  <span className="inline-block w-24 h-9 bg-gray-100 rounded-lg animate-pulse" />
                ) : (
                  card.value
                )}
              </p>
              {card.comparison && (
                <p className="text-xs text-gray-400 mt-2">{card.comparison}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <a
              key={action.title}
              href={action.href}
              className="group relative bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-[#28afb1]/40 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-50 group-hover:bg-[#28afb1]/10 transition-colors">
                  <Icon className="h-5 w-5 text-gray-500 group-hover:text-[#28afb1] transition-colors" />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-[#28afb1] transition-colors group-hover:translate-x-0.5 transform" />
              </div>
              <h3 className="font-semibold text-gray-900 mt-4 group-hover:text-[#28afb1] transition-colors">
                {action.title}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{action.description}</p>
            </a>
          );
        })}
      </div>

      {/* Placeholder Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-[#28afb1]" />
            <h3 className="font-semibold text-gray-900">Ventes cette semaine</h3>
          </div>
          <div className="h-48 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 text-sm">
            <div className="text-center">
              <BarChart3 className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p>Graphique disponible apres connexion aux services</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-5 w-5 text-[#28afb1]" />
            <h3 className="font-semibold text-gray-900">Dernieres commandes</h3>
          </div>
          <div className="h-48 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 text-sm">
            <div className="text-center">
              <Package className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p>Liste des commandes recentes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
