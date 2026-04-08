"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { ApiError, productsApi, type Category, type Product } from "@/lib/api";

const SORT_OPTIONS = [
  { value: "newest", label: "Plus récents" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "name", label: "Nom A-Z" },
] as const;

interface CatalogueFiltersProps {
  initialProducts: Product[];
  categories: Category[];
  initialTotal: number;
  initialTotalPages: number;
  initialPage: number;
  initialSort: string;
  initialSearch: string;
  initialCategorySlug: string;
  initialError: string | null;
}

export function CatalogueSkeleton() {
  return (
    <div className="min-h-screen bg-void">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-2">
          <div className="h-10 w-64 animate-pulse bg-surface" />
        </div>
        <div className="h-4 w-32 animate-pulse mb-6 bg-surface" />
        <div className="divider-neon mb-8" />

        <div className="flex gap-[1px] mb-8 bg-border">
          <div className="flex-1 h-11 animate-pulse bg-surface" />
          <div className="w-52 h-11 animate-pulse bg-surface" />
          <div className="w-44 h-11 animate-pulse bg-surface" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border">
              <div className="aspect-square animate-pulse" style={{ backgroundColor: "#0F0F0F" }} />
              <div className="p-4 space-y-3 border-t border-border">
                <div className="h-2 w-20 animate-pulse bg-surface-2" />
                <div className="h-4 w-full animate-pulse bg-surface-2" />
                <div className="h-4 w-2/3 animate-pulse bg-surface-2" />
                <div className="h-5 w-24 animate-pulse mt-2 bg-surface-2" />
                <div className="h-3 w-16 animate-pulse bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CatalogueFilters({
  initialProducts,
  categories,
  initialTotal,
  initialTotalPages,
  initialPage,
  initialSort,
  initialSearch,
  initialCategorySlug,
  initialError,
}: CatalogueFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isFirstRender = useRef(true);

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [sort, setSort] = useState(initialSort);
  const [search, setSearch] = useState(initialSearch);
  const [categorySlug, setCategorySlug] = useState(initialCategorySlug);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } catch (fetchError) {
      console.error("Erreur chargement produits", fetchError);
      setProducts([]);
      setTotal(0);
      setTotalPages(1);
      if (fetchError instanceof ApiError) {
        setError("Le service catalogue est temporairement indisponible. Réessayez dans quelques instants.");
        return;
      }
      if (fetchError instanceof TypeError) {
        setError("Le service catalogue ne répond pas. Vérifiez que l'API e-commerce est démarrée (port 3001).");
        return;
      }
      setError("Impossible de charger le catalogue pour le moment.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, search, categorySlug]);

  useEffect(() => {
    if (isFirstRender.current) return;
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (categorySlug) qs.set("categorySlug", categorySlug);
    if (sort && sort !== "newest") qs.set("sort", sort);
    if (page > 1) qs.set("page", String(page));
    const nextUrl = qs.toString() ? `${pathname}?${qs.toString()}` : pathname;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    router.push(nextUrl, { scroll: false });
  }, [categorySlug, page, pathname, router, search, sort]);

  function buildPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "ellipsis")[] = [1];
    if (page > 3) pages.push("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="min-h-screen bg-void">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-1">
          <h1 className="heading-lg">CATALOGUE</h1>
        </div>
        <p className="font-mono text-xs uppercase tracking-widest mb-6 text-text-dim">{total} PRODUITS</p>
        <div className="divider-neon mb-8" />

        <div className="flex flex-col md:flex-row mb-8 border border-border">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-full pl-10 pr-4 py-3 outline-none font-mono text-sm bg-surface text-text border-none border-r border-border"
            />
          </div>

          <div className="relative">
            <select
              value={categorySlug}
              onChange={(e) => {
                setCategorySlug(e.target.value);
                setPage(1);
              }}
              className="appearance-none w-full md:w-52 px-4 py-3 font-mono text-sm cursor-pointer outline-none bg-surface text-text border-none border-r border-border"
            >
              <option value="">Toutes catégories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none w-full md:w-44 px-4 py-3 font-mono text-sm cursor-pointer outline-none bg-surface text-text border-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 border border-border bg-surface px-4 py-3 font-mono text-xs text-red-300" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border">
                <div className="aspect-square animate-pulse" style={{ backgroundColor: "#0F0F0F" }} />
                <div className="p-4 space-y-3 border-t border-border">
                  <div className="h-2 w-20 animate-pulse bg-surface-2" />
                  <div className="h-4 w-full animate-pulse bg-surface-2" />
                  <div className="h-4 w-2/3 animate-pulse bg-surface-2" />
                  <div className="h-5 w-24 animate-pulse mt-2 bg-surface-2" />
                  <div className="h-3 w-16 animate-pulse bg-surface-2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-32">
            <h2 className="heading-lg mb-3 text-text">AUCUN RÉSULTAT</h2>
            <p className="font-mono text-sm text-text-dim">Modifiez vos filtres ou effectuez une nouvelle recherche.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {totalPages > 1 && !loading && (
          <nav className="flex items-center justify-center gap-1 mt-12 font-mono text-xs uppercase tracking-wider">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-2 transition-colors disabled:opacity-30 text-text-muted"
            >
              &larr; PRÉCÉDENT
            </button>

            <div className="flex items-center gap-1 mx-4">
              {buildPageNumbers().map((p, i) =>
                p === "ellipsis" ? (
                  <span key={`e-${i}`} className="px-2 py-2 text-text-dim">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-8 h-8 flex items-center justify-center transition-colors"
                    style={{
                      color: p === page ? "var(--color-neon)" : "var(--color-text-muted)",
                      borderBottom: p === page ? "1px solid var(--color-neon)" : "1px solid transparent",
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
              className="px-3 py-2 transition-colors disabled:opacity-30 text-text-muted"
            >
              SUIVANT &rarr;
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
