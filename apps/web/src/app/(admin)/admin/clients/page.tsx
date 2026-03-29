"use client";

import { useEffect, useState } from "react";
import { Users, Star, Mail, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  user: { email: string; firstName: string; lastName: string; lastLoginAt?: string };
  loyaltyTier: string;
  loyaltyPoints: number;
  totalOrders: number;
  totalSpent: string;
  source: string;
}

const TIER_CONFIG: Record<string, { label: string; badgeClass: string; showStar: boolean }> = {
  BRONZE: { label: "Bronze", badgeClass: "badge badge-muted", showStar: false },
  SILVER: { label: "Silver", badgeClass: "badge badge-muted", showStar: false },
  GOLD: { label: "Gold", badgeClass: "badge badge-neon", showStar: true },
};

function formatCurrency(amount: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(parseFloat(amount));
}

export default function AdminClientsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://localhost:3002/api/v1/customers?limit=50");
        const json = await res.json();
        setCustomers(json.data || []);
      } catch { /* CRM non connecte */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-lg">CLIENTS</h1>
          <p className="font-mono text-sm text-text-muted mt-1">
            {customers.length} client{customers.length !== 1 ? "s" : ""} enregistre{customers.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Table */}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-4 bg-surface-2 animate-pulse" />
                  </td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <Users className="h-10 w-10 text-text-dim mx-auto mb-3" />
                  <p className="font-mono text-text-muted">Aucun client enregistre</p>
                </td>
              </tr>
            ) : (
              customers.map((c) => {
                const tier = TIER_CONFIG[c.loyaltyTier] || { label: c.loyaltyTier, badgeClass: "badge badge-muted", showStar: false };
                const initials = `${c.user.firstName?.[0] || ""}${c.user.lastName?.[0] || ""}`.toUpperCase();

                return (
                  <tr key={c.id} className="hover:bg-surface-2/50 cursor-pointer transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center bg-neon-dim text-neon font-mono text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <span className="font-mono text-sm text-text">
                          {c.user.firstName} {c.user.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono text-xs text-text-muted">
                        <Mail className="h-3.5 w-3.5 text-text-dim" />
                        <span>{c.user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center gap-1", tier.badgeClass)}>
                        {tier.showStar && <Star className="h-3 w-3 fill-current" />}
                        {tier.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-sm font-bold text-neon">{c.loyaltyPoints}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-mono text-sm text-text-muted">
                        <ShoppingBag className="h-3.5 w-3.5 text-text-dim" />
                        {c.totalOrders}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-sm font-bold text-neon">{formatCurrency(c.totalSpent)}</span>
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
