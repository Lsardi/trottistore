"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type RealtimeKpis } from "@/lib/api";

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
        // Services pas encore connectés
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
      color: "text-green-600",
    },
    {
      label: "Commandes aujourd'hui",
      value: kpis ? String(kpis.ordersToday) : "---",
      comparison: "",
      color: "text-blue-600",
    },
    {
      label: "Tickets SAV ouverts",
      value: kpis ? String(kpis.openSavTickets) : "---",
      comparison: "",
      color: "text-orange-600",
    },
    {
      label: "Alertes stock",
      value: kpis ? String(kpis.lowStockAlerts) : "---",
      comparison: "Produits sous seuil critique",
      color: "text-red-600",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Vue temps réel de votre activité</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${kpis ? "bg-green-500" : "bg-gray-400"}`} />
          <span className="text-xs text-gray-500">{kpis ? "Services connectés" : "En attente..."}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {KPI_CARDS.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>
              {loading ? (
                <span className="inline-block w-20 h-8 bg-gray-200 rounded animate-pulse" />
              ) : (
                card.value
              )}
            </p>
            {card.comparison && (
              <p className="text-xs text-gray-400 mt-2">{card.comparison}</p>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <a
          href="/admin/commandes"
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-blue-300 transition group"
        >
          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600">
            📦 Commandes
          </h3>
          <p className="text-sm text-gray-500">Gérer les commandes en cours</p>
        </a>
        <a
          href="/admin/sav"
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-blue-300 transition group"
        >
          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600">
            🔧 Tickets SAV
          </h3>
          <p className="text-sm text-gray-500">Suivre les réparations en cours</p>
        </a>
        <a
          href="/admin/produits"
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-blue-300 transition group"
        >
          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600">
            🛴 Catalogue
          </h3>
          <p className="text-sm text-gray-500">Gérer les produits et le stock</p>
        </a>
      </div>

      {/* Placeholder charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Ventes cette semaine</h3>
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            Graphique disponible après connexion aux services
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Dernières commandes</h3>
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            Liste des commandes récentes
          </div>
        </div>
      </div>
    </div>
  );
}
