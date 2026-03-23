"use client";

import { useEffect, useState } from "react";

interface Customer {
  id: string;
  user: { email: string; firstName: string; lastName: string; lastLoginAt?: string };
  loyaltyTier: string;
  loyaltyPoints: number;
  totalOrders: number;
  totalSpent: string;
  source: string;
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: "bg-orange-100 text-orange-800",
  SILVER: "bg-gray-100 text-gray-800",
  GOLD: "bg-yellow-100 text-yellow-800",
};

export default function AdminClientsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://localhost:3002/api/v1/customers?limit=50");
        const json = await res.json();
        setCustomers(json.data || []);
      } catch { /* CRM non connecté */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Clients</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Client</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Email</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Niveau</th>
              <th className="text-right px-6 py-3 text-gray-500 font-medium">Points</th>
              <th className="text-right px-6 py-3 text-gray-500 font-medium">Commandes</th>
              <th className="text-right px-6 py-3 text-gray-500 font-medium">CA total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  Aucun client enregistré
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {c.user.firstName} {c.user.lastName}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{c.user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIER_COLORS[c.loyaltyTier] || "bg-gray-100"}`}>
                      {c.loyaltyTier}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">{c.loyaltyPoints}</td>
                  <td className="px-6 py-4 text-right">{c.totalOrders}</td>
                  <td className="px-6 py-4 text-right font-semibold">
                    {parseFloat(c.totalSpent).toFixed(2)} €
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
