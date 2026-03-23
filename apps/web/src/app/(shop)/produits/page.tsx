"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import {
  productsApi,
  categoriesApi,
  type Product,
  type Category,
} from "@/lib/api";

const SORT_OPTIONS = [
  { value: "newest", label: "Plus récents" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "name", label: "Nom A-Z" },
] as const;

export default function ProductsPageWrapper() {
  return (
    <Suspense fallback={<CatalogueSkeleton />}>
      <ProductsPage />
    </Suspense>
  );
}

/* ─── SKELETON ────────────────────────────────────────────── */

function CatalogueSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10">
        {/* Header skeleton */}
        <div className="mb-2">
          <div className="h-10 w-64 animate-pulse" style={{ backgroundColor: "#141414" }} />
        </div>
        <div className="h-4 w-32 animate-pulse mb-6" style={{ backgroundColor: "#141414" }} />
        <div className="divider-neon mb-8" />

        {/* Filter bar skeleton */}
        <div className="flex gap-[1px] mb-8" style={{ backgroundColor: "#2A2A2A" }}>
          <div className="flex-1 h-11 animate-pulse" style={{ backgroundColor: "#141414" }} />
          <div className="w-52 h-11 animate-pulse" style={{ backgroundColor: "#141414" }} />
          <div className="w-44 h-11 animate-pulse" style={{ backgroundColor: "#141414" }} />
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}>
              <div className="aspect-square animate-pulse" style={{ backgroundColor: "#0F0F0F" }} />
              <div className="p-4 space-y-3" style={{ borderTop: "1px solid #2A2A2A" }}>
                <div className="h-2 w-20 animate-pulse" style={{ backgroundColor: "#1C1C1C" }} />
                <div className="h-4 w-full animate-pulse" style={{ backgroundColor: "#1C1C1C" }} />
                <div className="h-4 w-2/3 animate-pulse" style={{ backgroundColor: "#1C1C1C" }} />
                <div className="h-5 w-24 animate-pulse mt-2" style={{ backgroundColor: "#1C1C1C" }} />
                <div className="h-3 w-16 animate-pulse" style={{ backgroundColor: "#1C1C1C" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN PAGE ───────────────────────────────────────────── */

function ProductsPage() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [categorySlug, setCategorySlug] = useState(
    searchParams.get("categorySlug") || ""
  );

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.list({
        page,
        limit: 24,
        sort,
        search: search || undefined,
        categorySlug: categorySlug || undefined,
      });
      setProducts(res.data);
      setTotal(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch {
      console.error("Erreur chargement produits");
    } finally {
      setLoading(false);
    }
  }, [page, sort, search, categorySlug]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await categoriesApi.list();
      setCategories(res.data);
    } catch {
      // Categories non chargées — pas bloquant
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  /* ─── Pagination helpers ─── */
  function buildPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "ellipsis")[] = [1];
    if (page > 3) pages.push("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10">
        {/* ── Header ── */}
        <div className="mb-1">
          <h1 className="heading-lg">CATALOGUE</h1>
        </div>
        <p className="font-mono text-xs uppercase tracking-widest mb-6" style={{ color: "#555555" }}>
          {total} PRODUITS
        </p>
        <div className="divider-neon mb-8" />

        {/* ── Filter bar ── */}
        <div
          className="flex flex-col md:flex-row mb-8"
          style={{ border: "1px solid #2A2A2A" }}
        >
          {/* Search */}
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "#555555" }}
            />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-full pl-10 pr-4 py-3 outline-none font-mono text-sm"
              style={{
                backgroundColor: "#141414",
                color: "#E8E8E8",
                border: "none",
                borderRight: "1px solid #2A2A2A",
              }}
            />
          </div>

          {/* Category select */}
          <div className="relative">
            <select
              value={categorySlug}
              onChange={(e) => {
                setCategorySlug(e.target.value);
                setPage(1);
              }}
              className="appearance-none w-full md:w-52 px-4 py-3 font-mono text-sm cursor-pointer outline-none"
              style={{
                backgroundColor: "#141414",
                color: "#E8E8E8",
                border: "none",
                borderRight: "1px solid #2A2A2A",
              }}
            >
              <option value="">Toutes catégories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort select */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none w-full md:w-44 px-4 py-3 font-mono text-sm cursor-pointer outline-none"
              style={{
                backgroundColor: "#141414",
                color: "#E8E8E8",
                border: "none",
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Product grid ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}>
                <div className="aspect-square animate-pulse" style={{ backgroundColor: "#0F0F0F" }} />
                <div className="p-4 space-y-3" style={{ borderTop: "1px solid #2A2A2A" }}>
                  <div className="h-2 w-20 animate-pulse" style={{ backgroundColor: "#1C1C1C" }} />
                  <div className="h-4 w-full animate-pulse" style={{ backgroundColor: "#1C1C1C" }} />
                  <div className="h-4 w-2/3 animate-pulse" style={{ backgroundColor: "#1C1C1C" }} />
                  <div className="h-5 w-24 animate-pulse mt-2" style={{ backgroundColor: "#1C1C1C" }} />
                  <div className="h-3 w-16 animate-pulse" style={{ backgroundColor: "#1C1C1C" }} />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          /* ── Empty state ── */
          <div className="text-center py-32">
            <h2 className="heading-lg mb-3" style={{ color: "#E8E8E8" }}>
              AUCUN RÉSULTAT
            </h2>
            <p className="font-mono text-sm" style={{ color: "#555555" }}>
              Modifiez vos filtres ou effectuez une nouvelle recherche.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && !loading && (
          <nav className="flex items-center justify-center gap-1 mt-12 font-mono text-xs uppercase tracking-wider">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-2 transition-colors disabled:opacity-30"
              style={{ color: "#888888" }}
            >
              &larr; PRÉCÉDENT
            </button>

            <div className="flex items-center gap-1 mx-4">
              {buildPageNumbers().map((p, i) =>
                p === "ellipsis" ? (
                  <span key={`e-${i}`} className="px-2 py-2" style={{ color: "#555555" }}>
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-8 h-8 flex items-center justify-center transition-colors"
                    style={{
                      color: p === page ? "#00FFD1" : "#888888",
                      borderBottom: p === page ? "1px solid #00FFD1" : "1px solid transparent",
                    }}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 transition-colors disabled:opacity-30"
              style={{ color: "#888888" }}
            >
              SUIVANT &rarr;
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
