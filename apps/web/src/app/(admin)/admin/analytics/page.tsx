"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type AggregatedKpis, type TopProduct } from "@/lib/api";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const [kpis, setKpis] = useState<AggregatedKpis | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [kpiRes, topRes] = await Promise.all([
          analyticsApi.kpis(period),
          analyticsApi.topProducts({ period, limit: 10 }),
        ]);
        setKpis(kpiRes.data);
        setTopProducts(topRes.data || []);
      } catch { /* Analytics non connecté */ }
      finally { setLoading(false); }
    }
    load();
  }, [period]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
          <option value="90d">90 derniers jours</option>
          <option value="365d">12 derniers mois</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Chiffre d'affaires", value: kpis ? formatCurrency(kpis.totalRevenue) : "---" },
          { label: "Commandes", value: kpis ? String(kpis.totalOrders) : "---" },
          { label: "Panier moyen", value: kpis ? formatCurrency(kpis.avgOrderValue) : "---" },
          { label: "Nouveaux clients", value: kpis ? String(kpis.newCustomers) : "---" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? (
                <span className="inline-block w-24 h-8 bg-gray-200 rounded animate-pulse" />
              ) : (
                card.value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Top produits */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 produits par CA</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : topProducts.length === 0 ? (
          <p className="text-center py-8 text-gray-400">Pas encore de données de vente</p>
        ) : (
          <div className="space-y-3">
            {topProducts.map((product, i) => (
              <div key={product.productId} className="flex items-center gap-4">
                <span className="w-6 text-sm text-gray-400 text-right">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.totalQuantity} vendus</p>
                </div>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(product.totalRevenue)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
