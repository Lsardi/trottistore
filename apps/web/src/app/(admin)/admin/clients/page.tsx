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

const TIER_CONFIG: Record<string, { label: string; color: string; showStar: boolean }> = {
  BRONZE: { label: "Bronze", color: "bg-amber-50 text-amber-700 border border-amber-200", showStar: false },
  SILVER: { label: "Silver", color: "bg-gray-100 text-gray-600 border border-gray-200", showStar: false },
  GOLD: { label: "Gold", color: "bg-yellow-50 text-yellow-700 border border-yellow-300", showStar: true },
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
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">
            {customers.length} client{customers.length !== 1 ? "s" : ""} enregistre{customers.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Client</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Niveau</th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Points</th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Commandes</th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">CA total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-4 bg-gray-100 rounded-md animate-pulse" />
                  </td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">Aucun client enregistre</p>
                </td>
              </tr>
            ) : (
              customers.map((c) => {
                const tier = TIER_CONFIG[c.loyaltyTier] || { label: c.loyaltyTier, color: "bg-gray-100 text-gray-600", showStar: false };
                const initials = `${c.user.firstName?.[0] || ""}${c.user.lastName?.[0] || ""}`.toUpperCase();

                return (
                  <tr key={c.id} className="hover:bg-gray-50/50 cursor-pointer transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#28afb1]/10 text-[#28afb1] text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <span className="font-medium text-gray-900">
                          {c.user.firstName} {c.user.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Mail className="h-3.5 w-3.5 text-gray-300" />
                        <span>{c.user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium", tier.color)}>
                        {tier.showStar && <Star className="h-3 w-3 fill-current" />}
                        {tier.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-[#28afb1]">{c.loyaltyPoints}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-gray-600">
                        <ShoppingBag className="h-3.5 w-3.5 text-gray-300" />
                        {c.totalOrders}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-gray-900">{formatCurrency(c.totalSpent)}</span>
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
