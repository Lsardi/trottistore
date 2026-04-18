"use client";

import { FormEvent, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Search, Package, ShoppingCart, Users, Wrench, ArrowRight, Hash } from "lucide-react";

// Serial-number lookup hit — mirrors the backend's GET /admin/orders/by-serial
// response shape but kept inline here (one consumer, not worth a new type).
type SerialHit = {
  id: string;
  serialNumbers: string[];
  order: {
    id: string;
    orderNumber: number;
    status: string;
    createdAt: string;
    customer?: { id: string; email: string; firstName: string; lastName: string } | null;
  };
  product: { id: string; name: string; sku: string };
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function AdminGlobalSearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-32"><p className="font-mono text-sm text-text-muted">Chargement...</p></div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = (searchParams.get("q") || "").trim();

  const [localQuery, setLocalQuery] = useState(query);
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = localQuery.trim();
    router.push(normalized ? `/admin/recherche?q=${encodeURIComponent(normalized)}` : "/admin/recherche");
  }

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [serialHits, setSerialHits] = useState<SerialHit[]>([]);

  useEffect(() => {
    if (!query) {
      setProducts([]);
      setOrders([]);
      setCustomers([]);
      setTickets([]);
      setSerialHits([]);
      return;
    }

    async function searchAll() {
      setLoading(true);
      const [productsRes, ordersRes, customersRes, ticketsRes, serialRes] = await Promise.allSettled([
        adminProductsApi.list({ page: 1, limit: 20, search: query }),
        ordersApi.adminList({ page: 1, limit: 30, search: query }),
        customersApi.list({ page: 1, limit: 30, search: query }),
        repairsApi.list({ page: 1, limit: 50 }),
        ordersApi.adminFindBySerial(query),
      ]);

      setProducts(productsRes.status === "fulfilled" ? productsRes.value.data || [] : []);
      setOrders(ordersRes.status === "fulfilled" ? ordersRes.value.data || [] : []);
      setCustomers(customersRes.status === "fulfilled" ? customersRes.value.data || [] : []);
      setSerialHits(serialRes.status === "fulfilled" ? serialRes.value.data || [] : []);

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
    () => products.length + orders.length + customers.length + tickets.length + serialHits.length,
    [products.length, orders.length, customers.length, tickets.length, serialHits.length],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-lg">RECHERCHE GLOBALE</h1>
        <p className="font-mono text-sm text-text-muted mt-1">
          {query ? `Résultats pour: ${query}` : "Tape une requête ci-dessous pour chercher produits, commandes, clients, tickets SAV."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface border border-border p-3">
        <div className="relative">
          <Search className="h-4 w-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Produits, commandes, clients, SAV…"
            className="input-dark w-full pl-9"
            autoFocus
          />
        </div>
      </form>

      {query ? (
        <div className="bg-surface border border-border p-3 font-mono text-xs text-text-muted">
          {loading ? "Recherche en cours..." : `${totalResults} résultat(s)`}
        </div>
      ) : null}

      {serialHits.length > 0 ? (
        <section className="bg-surface border border-neon/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-neon inline-flex items-center gap-2">
              <Hash className="h-4 w-4" /> Numéros de série
            </h2>
            <span className="font-mono text-[11px] text-text-dim">
              {serialHits.length} match{serialHits.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {serialHits.map((hit) => (
              <Link
                key={hit.id}
                href={`/admin/commandes?order=${hit.order.id}`}
                className="block border border-border bg-surface-2 px-3 py-2 hover:border-neon"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-mono text-xs text-text">
                    SN {query} · commande{" "}
                    <span className="text-neon">#{hit.order.orderNumber}</span>
                  </p>
                  <p className="font-mono text-[11px] text-text-dim">
                    {hit.order.status}
                  </p>
                </div>
                <p className="font-mono text-[11px] text-text-dim truncate">
                  {hit.product.name}
                  {hit.order.customer
                    ? ` · ${hit.order.customer.firstName} ${hit.order.customer.lastName} (${hit.order.customer.email})`
                    : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
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
          Utilise le champ ci-dessus pour lancer une recherche globale.
        </div>
      ) : null}
    </div>
  );
}
