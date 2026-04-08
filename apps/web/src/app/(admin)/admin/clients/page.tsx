"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, Star, Mail, ShoppingBag, ArrowRight, Search } from "lucide-react";
import { customersApi, type CustomerListItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const TIER_CONFIG: Record<string, { label: string; badgeClass: string; showStar: boolean }> = {
  BRONZE: { label: "Bronze", badgeClass: "badge badge-muted", showStar: false },
  SILVER: { label: "Silver", badgeClass: "badge badge-muted", showStar: false },
  GOLD: { label: "Gold", badgeClass: "badge badge-neon", showStar: true },
};

function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(amount));
}

export default function AdminClientsPage() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"" | "BRONZE" | "SILVER" | "GOLD">("");
  const [sort, setSort] = useState<"newest" | "name" | "points_desc" | "last_active" | "total_spent">("newest");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await customersApi.list({
          limit: 50,
          sort,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(tierFilter ? { loyaltyTier: tierFilter } : {}),
        });
        setCustomers(res.data || []);
        setTotal(res.pagination?.total ?? res.data.length);
      } catch {
        setCustomers([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [search, sort, tierFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-lg">CLIENTS</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            {total} client{total !== 1 ? "s" : ""} enregistre{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="spec-label mb-2 block">Recherche</span>
          <div className="relative">
            <Search className="w-4 h-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, email, téléphone..."
              className="input-dark w-full pl-9"
            />
          </div>
        </label>

        <label className="block">
          <span className="spec-label mb-2 block">Niveau fidélité</span>
          <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)} className="input-dark w-full">
            <option value="">Tous</option>
            <option value="BRONZE">Bronze</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
          </select>
        </label>

        <label className="block">
          <span className="spec-label mb-2 block">Tri</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input-dark w-full">
            <option value="newest">Plus récents</option>
            <option value="name">Nom (A-Z)</option>
            <option value="points_desc">Points (desc)</option>
            <option value="last_active">Dernière activité</option>
            <option value="total_spent">CA total (desc)</option>
          </select>
        </label>
      </div>

      <div className="bg-surface border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="text-left px-6 py-3.5 spec-label">Client</th>
              <th className="text-left px-6 py-3.5 spec-label">Email</th>
              <th className="text-left px-6 py-3.5 spec-label">Niveau</th>
              <th className="text-right px-6 py-3.5 spec-label">Points</th>
              <th className="text-right px-6 py-3.5 spec-label">Commandes</th>
              <th className="text-right px-6 py-3.5 spec-label">CA Total</th>
              <th className="text-right px-6 py-3.5 spec-label">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-6 py-4">
                    <div className="h-4 bg-surface-2 animate-pulse" />
                  </td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <Users className="h-10 w-10 text-text-dim mx-auto mb-3" />
                  <p className="font-mono text-text-muted">Aucun client enregistre</p>
                </td>
              </tr>
            ) : (
              customers.map((customer) => {
                const tier = TIER_CONFIG[customer.customerProfile?.loyaltyTier || "BRONZE"] || TIER_CONFIG.BRONZE;
                const initials = `${customer.firstName?.[0] || ""}${customer.lastName?.[0] || ""}`.toUpperCase();

                return (
                  <tr key={customer.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center bg-neon-dim text-neon font-mono text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <span className="font-mono text-sm text-text">
                          {customer.firstName} {customer.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono text-xs text-text-muted">
                        <Mail className="h-3.5 w-3.5 text-text-dim" />
                        <span>{customer.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center gap-1", tier.badgeClass)}>
                        {tier.showStar && <Star className="h-3 w-3 fill-current" />}
                        {tier.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-sm font-bold text-neon">{customer.customerProfile?.loyaltyPoints ?? 0}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-mono text-sm text-text-muted">
                        <ShoppingBag className="h-3.5 w-3.5 text-text-dim" />
                        {customer.customerProfile?.totalOrders ?? 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-sm font-bold text-neon">
                        {formatCurrency(customer.customerProfile?.totalSpent ?? 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/clients/${customer.id}`} className="btn-outline inline-flex items-center gap-1.5 py-1.5 px-2.5">
                        Fiche garage
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
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
