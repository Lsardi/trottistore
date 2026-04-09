"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  customersApi,
  ordersApi,
  repairsApi,
  adminProductsApi,
  type AdminOrderSummary,
  type CustomerListItem,
  type Product,
  type RepairTicket,
} from "@/lib/api";
import { Search, Package, ShoppingCart, Users, Wrench, ArrowRight } from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function AdminGlobalSearchPage() {
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") || "").trim();

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [tickets, setTickets] = useState<RepairTicket[]>([]);

  useEffect(() => {
    if (!query) {
      setProducts([]);
      setOrders([]);
      setCustomers([]);
      setTickets([]);
      return;
    }

    async function searchAll() {
      setLoading(true);
      const [productsRes, ordersRes, customersRes, ticketsRes] = await Promise.allSettled([
        adminProductsApi.list({ page: 1, limit: 20, search: query }),
        ordersApi.adminList({ page: 1, limit: 30, search: query }),
        customersApi.list({ page: 1, limit: 30, search: query }),
        repairsApi.list({ page: 1, limit: 100 }),
      ]);

      setProducts(productsRes.status === "fulfilled" ? productsRes.value.data || [] : []);
      setOrders(ordersRes.status === "fulfilled" ? ordersRes.value.data || [] : []);
      setCustomers(customersRes.status === "fulfilled" ? customersRes.value.data || [] : []);

      if (ticketsRes.status === "fulfilled") {
        const q = normalize(query);
        const filtered = (ticketsRes.value.data || []).filter((ticket) => {
          const haystack = normalize(
            [
              `SAV-${String(ticket.ticketNumber)}`,
              ticket.customerName || "",
              ticket.customerEmail || "",
              ticket.productModel || "",
            ].join(" "),
          );
          return haystack.includes(q);
        });
        setTickets(filtered.slice(0, 20));
      } else {
        setTickets([]);
      }

      setLoading(false);
    }

    void searchAll();
  }, [query]);

  const totalResults = useMemo(
    () => products.length + orders.length + customers.length + tickets.length,
    [products.length, orders.length, customers.length, tickets.length],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-lg">RECHERCHE GLOBALE</h1>
        <p className="font-mono text-sm text-text-muted mt-1">
          {query ? `Resultats pour: ${query}` : "Saisis une recherche depuis la barre en haut."}
        </p>
      </div>

      {query ? (
        <div className="bg-surface border border-border p-3 font-mono text-xs text-text-muted">
          {loading ? "Recherche en cours..." : `${totalResults} resultat(s)`}
        </div>
      ) : null}

      <section className="bg-surface border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-text inline-flex items-center gap-2">
            <Package className="h-4 w-4 text-neon" /> Produits
          </h2>
          <Link href="/admin/produits" className="btn-outline inline-flex items-center gap-1.5 py-1.5 px-2.5">
            Ouvrir <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="space-y-2">
          {products.length === 0 ? (
            <p className="font-mono text-sm text-text-muted">Aucun produit.</p>
          ) : (
            products.map((product) => (
              <Link
                key={product.id}
                href={`/admin/produits/${product.id}`}
                className="block border border-border bg-surface-2 px-3 py-2 hover:border-neon/40"
              >
                <p className="font-mono text-xs text-text">{product.name}</p>
                <p className="font-mono text-[11px] text-text-dim">{product.sku}</p>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="bg-surface border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-text inline-flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-neon" /> Commandes
          </h2>
          <Link href="/admin/commandes" className="btn-outline inline-flex items-center gap-1.5 py-1.5 px-2.5">
            Ouvrir <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="space-y-2">
          {orders.length === 0 ? (
            <p className="font-mono text-sm text-text-muted">Aucune commande.</p>
          ) : (
            orders.map((order) => (
              <Link
                key={order.id}
                href="/admin/commandes"
                className="block border border-border bg-surface-2 px-3 py-2 hover:border-neon/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs text-text">#{order.orderNumber}</p>
                  <p className="font-mono text-xs text-neon">{formatCurrency(Number(order.totalTtc || 0))}</p>
                </div>
                <p className="font-mono text-[11px] text-text-dim">{order.customer?.email || "Client inconnu"}</p>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="bg-surface border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-text inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-neon" /> Clients
          </h2>
          <Link href="/admin/clients" className="btn-outline inline-flex items-center gap-1.5 py-1.5 px-2.5">
            Ouvrir <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="space-y-2">
          {customers.length === 0 ? (
            <p className="font-mono text-sm text-text-muted">Aucun client.</p>
          ) : (
            customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/admin/clients/${customer.id}`}
                className="block border border-border bg-surface-2 px-3 py-2 hover:border-neon/40"
              >
                <p className="font-mono text-xs text-text">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="font-mono text-[11px] text-text-dim">{customer.email}</p>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="bg-surface border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-text inline-flex items-center gap-2">
            <Wrench className="h-4 w-4 text-neon" /> Tickets SAV
          </h2>
          <Link href="/admin/sav" className="btn-outline inline-flex items-center gap-1.5 py-1.5 px-2.5">
            Ouvrir <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="space-y-2">
          {tickets.length === 0 ? (
            <p className="font-mono text-sm text-text-muted">Aucun ticket.</p>
          ) : (
            tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href="/admin/sav"
                className="block border border-border bg-surface-2 px-3 py-2 hover:border-neon/40"
              >
                <p className="font-mono text-xs text-text">SAV-{String(ticket.ticketNumber).padStart(4, "0")}</p>
                <p className="font-mono text-[11px] text-text-dim">
                  {ticket.customerName || "Client inconnu"} · {ticket.productModel}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>

      {!query ? (
        <div className="bg-surface border border-border p-4 flex items-center gap-2 font-mono text-sm text-text-muted">
          <Search className="h-4 w-4" />
          Lance une recherche depuis le champ global de la barre admin.
        </div>
      ) : null}
    </div>
  );
}
