"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type AggregatedKpis, type TopProduct } from "@/lib/api";
import {
  TrendingUp,
  ShoppingCart,
  Receipt,
  UserPlus,
  ChevronDown,
  Trophy,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
      } catch { /* Analytics non connecte */ }
      finally { setLoading(false); }
    }
    load();
  }, [period]);

  const maxRevenue = topProducts.length > 0
    ? Math.max(...topProducts.map((p) => p.totalRevenue))
    : 1;

  const KPI_CARDS = [
    {
      label: "Chiffre d'affaires",
      value: kpis ? formatCurrency(kpis.totalRevenue) : "---",
      icon: TrendingUp,
      iconBg: "bg-[#28afb1]/10",
      iconColor: "text-[#28afb1]",
    },
    {
      label: "Commandes",
      value: kpis ? String(kpis.totalOrders) : "---",
      icon: ShoppingCart,
      iconBg: "bg-[#28afb1]/10",
      iconColor: "text-[#28afb1]",
    },
    {
      label: "Panier moyen",
      value: kpis ? formatCurrency(kpis.avgOrderValue) : "---",
      icon: Receipt,
      iconBg: "bg-[#28afb1]/10",
      iconColor: "text-[#28afb1]",
    },
    {
      label: "Nouveaux clients",
      value: kpis ? String(kpis.newCustomers) : "---",
      icon: UserPlus,
      iconBg: "bg-[#28afb1]/10",
      iconColor: "text-[#28afb1]",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Performances et indicateurs cles</p>
        </div>
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition-all cursor-pointer"
          >
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="365d">12 derniers mois</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {KPI_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", card.iconBg)}>
                  <Icon className={cn("h-5 w-5", card.iconColor)} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? (
                  <span className="inline-block w-24 h-8 bg-gray-100 rounded-lg animate-pulse" />
                ) : (
                  card.value
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="h-5 w-5 text-[#28afb1]" />
          <h2 className="text-lg font-semibold text-gray-900">Top 10 produits par CA</h2>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-6 h-6 bg-gray-100 rounded-full animate-pulse" />
                <div className="flex-1 h-4 bg-gray-100 rounded-md animate-pulse" />
                <div className="w-20 h-4 bg-gray-100 rounded-md animate-pulse" />
              </div>
            ))}
          </div>
        ) : topProducts.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Pas encore de donnees de vente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {topProducts.map((product, i) => {
              const widthPercent = (product.totalRevenue / maxRevenue) * 100;

              return (
                <div key={product.productId} className="group">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold flex-shrink-0",
                        i === 0
                          ? "bg-yellow-100 text-yellow-700"
                          : i === 1
                            ? "bg-gray-100 text-gray-600"
                            : i === 2
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-50 text-gray-400"
                      )}
                    >
                      {i + 1}
                    </div>

                    {/* Product info + bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        <span className="font-semibold text-gray-900 text-sm ml-4 flex-shrink-0">
                          {formatCurrency(product.totalRevenue)}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#28afb1] rounded-full transition-all duration-500"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{product.totalQuantity} vendus</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
