"use client";

import { useEffect, useState } from "react";
import { analyticsApi } from "@/lib/api";
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

type AnalyticsKpisResponse = {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  newCustomers: number;
};

type AnalyticsTopProductsResponse = {
  products: Array<{
    productId: string;
    name: string;
    slug: string;
    totalRevenue: number;
    totalQuantity: number;
  }>;
};

type AnalyticsSalesResponse = {
  data: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDateTick(input: string): string {
  const d = new Date(input);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(d);
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const [kpis, setKpis] = useState<AnalyticsKpisResponse | null>(null);
  const [topProducts, setTopProducts] = useState<AnalyticsTopProductsResponse["products"]>([]);
  const [salesSeries, setSalesSeries] = useState<AnalyticsSalesResponse["data"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const group = period === "365d" ? "month" : period === "90d" ? "week" : "day";
        const [kpiRes, topRes, salesRes] = await Promise.all([
          analyticsApi.kpis(period),
          analyticsApi.topProducts({ period, limit: 10 }),
          analyticsApi.sales({ period, group }),
        ]);

        const normalizedKpis = kpiRes.data as unknown as AnalyticsKpisResponse;
        const normalizedTop = topRes.data as unknown as AnalyticsTopProductsResponse;
        const normalizedSales = salesRes.data as unknown as AnalyticsSalesResponse;

        setKpis(normalizedKpis);
        setTopProducts(normalizedTop?.products || []);
        setSalesSeries(normalizedSales?.data || []);
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
      value: kpis ? formatCurrency(kpis.revenue) : "---",
      icon: TrendingUp,
    },
    {
      label: "Commandes",
      value: kpis ? String(kpis.orders) : "---",
      icon: ShoppingCart,
    },
    {
      label: "Panier moyen",
      value: kpis ? formatCurrency(kpis.averageOrderValue) : "---",
      icon: Receipt,
    },
    {
      label: "Nouveaux clients",
      value: kpis ? String(kpis.newCustomers) : "---",
      icon: UserPlus,
    },
  ];

  const chartWidth = 900;
  const chartHeight = 240;
  const padding = { top: 16, right: 12, bottom: 28, left: 12 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;
  const maxRevenuePoint = Math.max(1, ...salesSeries.map((p) => p.revenue));
  const maxOrdersPoint = Math.max(1, ...salesSeries.map((p) => p.orders));

  const revenuePath = salesSeries
    .map((point, i) => {
      const x = padding.left + (salesSeries.length <= 1 ? innerW / 2 : (i / (salesSeries.length - 1)) * innerW);
      const y = padding.top + innerH - (point.revenue / maxRevenuePoint) * innerH;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-lg">ANALYTICS</h1>
          <p className="font-mono text-sm text-text-muted mt-1">Performances et indicateurs cles</p>
        </div>
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-dark appearance-none pl-4 pr-10 py-2.5 cursor-pointer font-bold"
          >
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="365d">12 derniers mois</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim pointer-events-none" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {KPI_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-surface border border-border p-6 hover:border-neon/30 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <p className="spec-label">{card.label}</p>
                <div className="flex h-10 w-10 items-center justify-center bg-neon-dim">
                  <Icon className="h-5 w-5 text-neon" />
                </div>
              </div>
              <p className="font-mono text-2xl font-bold text-neon">
                {loading ? (
                  <span className="inline-block w-24 h-8 bg-surface-2 animate-pulse" />
                ) : (
                  card.value
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* Sales Trend */}
      <div className="bg-surface border border-border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-bold text-text">Tendance ventes</h2>
            <p className="font-mono text-xs text-text-dim">CA et volume de commandes sur la période</p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="inline-flex items-center gap-1 text-neon">
              <span className="w-2 h-2 bg-neon inline-block" />
              CA
            </span>
            <span className="inline-flex items-center gap-1 text-warning">
              <span className="w-2 h-2 bg-warning inline-block" />
              Commandes
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-60 bg-surface-2 animate-pulse" />
        ) : salesSeries.length === 0 ? (
          <div className="h-60 flex items-center justify-center border border-border bg-surface-2">
            <p className="font-mono text-text-dim">Aucune donnée de tendance</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-60">
              <line
                x1={padding.left}
                y1={padding.top + innerH}
                x2={padding.left + innerW}
                y2={padding.top + innerH}
                stroke="var(--color-border)"
                strokeWidth="1"
              />
              <line
                x1={padding.left}
                y1={padding.top}
                x2={padding.left}
                y2={padding.top + innerH}
                stroke="var(--color-border)"
                strokeWidth="1"
              />

              {salesSeries.map((point, i) => {
                const x = padding.left + (salesSeries.length <= 1 ? innerW / 2 : (i / (salesSeries.length - 1)) * innerW);
                const barH = (point.orders / maxOrdersPoint) * innerH;
                const barY = padding.top + innerH - barH;
                return (
                  <rect
                    key={`order-bar-${point.date}-${i}`}
                    x={x - 4}
                    y={barY}
                    width={8}
                    height={barH}
                    fill="var(--color-warning)"
                    opacity="0.35"
                  />
                );
              })}

              <path d={revenuePath} fill="none" stroke="var(--color-neon)" strokeWidth="2.5" />

              {salesSeries.map((point, i) => {
                const x = padding.left + (salesSeries.length <= 1 ? innerW / 2 : (i / (salesSeries.length - 1)) * innerW);
                const y = padding.top + innerH - (point.revenue / maxRevenuePoint) * innerH;
                const isLabelTick = i === 0 || i === salesSeries.length - 1 || i % Math.max(1, Math.floor(salesSeries.length / 6)) === 0;
                return (
                  <g key={`point-${point.date}-${i}`}>
                    <circle cx={x} cy={y} r={3} fill="var(--color-neon)" />
                    {isLabelTick ? (
                      <text x={x} y={padding.top + innerH + 16} textAnchor="middle" fill="var(--color-text-dim)" fontSize="10">
                        {formatDateTick(point.date)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Top Products */}
      <div className="bg-surface border border-border p-6">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="h-5 w-5 text-neon" />
          <h2 className="font-display font-bold text-text">Top 10 produits par CA</h2>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-6 h-6 bg-surface-2 animate-pulse" />
                <div className="flex-1 h-4 bg-surface-2 animate-pulse" />
                <div className="w-20 h-4 bg-surface-2 animate-pulse" />
              </div>
            ))}
          </div>
        ) : topProducts.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="h-10 w-10 text-text-dim mx-auto mb-3" />
            <p className="font-mono text-text-muted">Pas encore de donnees de vente</p>
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
                        "flex h-7 w-7 items-center justify-center font-mono text-xs font-bold flex-shrink-0",
                        i === 0
                          ? "bg-neon text-void"
                          : i <= 2
                            ? "bg-neon-dim text-neon"
                            : "bg-surface-2 text-text-dim"
                      )}
                    >
                      {i + 1}
                    </div>

                    {/* Product info + bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-mono text-sm text-text truncate">{product.name}</p>
                        <span className="font-mono text-sm font-bold text-neon ml-4 flex-shrink-0">
                          {formatCurrency(product.totalRevenue)}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 bg-surface-2 overflow-hidden">
                        <div
                          className="h-full bg-neon transition-all duration-500"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      <p className="font-mono text-xs text-text-dim mt-1">{product.totalQuantity} vendus</p>
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
