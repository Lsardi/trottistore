"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, Star, Mail, ShoppingBag, ArrowRight } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await customersApi.list({ limit: 50, sort: "newest" });
        setCustomers(res.data || []);
      } catch {
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-lg">CLIENTS</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            {customers.length} client{customers.length !== 1 ? "s" : ""} enregistre{customers.length !== 1 ? "s" : ""}
          </p>
        </div>
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
