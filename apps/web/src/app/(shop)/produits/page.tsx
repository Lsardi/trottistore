"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
} from "lucide-react";
import ProductCard from "@/components/ProductCard";
import {
  productsApi,
  categoriesApi,
  type Product,
  type Category,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "newest", label: "Plus récents" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "name", label: "Nom A-Z" },
] as const;

export default function ProductsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="animate-pulse h-96 bg-gray-100 rounded-lg" />
        </div>
      }
    >
      <ProductsPage />
    </Suspense>
  );
}

function ProductsPage() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
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
        limit: 25,
        sort,
        search: search || undefined,
        categorySlug: categorySlug || undefined,
      });
      setProducts(res.data);
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

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Catalogue
          </h1>
          <p className="text-sm text-gray-500">
            Pièces détachées et accessoires pour trottinettes électriques
          </p>
        </div>

        {/* Filters & sort */}
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#28afb1] focus:border-transparent outline-none transition-shadow text-sm"
            />
          </div>

          {/* Category */}
          <div className="relative">
            <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={categorySlug}
              onChange={(e) => {
                setCategorySlug(e.target.value);
                setPage(1);
              }}
              className="appearance-none pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#28afb1] focus:border-transparent outline-none cursor-pointer"
            >
              <option value="">Toutes les catégories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="appearance-none px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-[#28afb1] focus:border-transparent outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Product grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="aspect-square bg-gray-50 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-2.5 bg-gray-100 rounded w-16 animate-pulse" />
                  <div className="h-3.5 bg-gray-100 rounded w-full animate-pulse" />
                  <div className="h-3.5 bg-gray-100 rounded w-2/3 animate-pulse" />
                  <div className="h-5 bg-gray-100 rounded w-20 mt-2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24">
            <PackageSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-1">
              Aucun produit trouvé
            </p>
            <p className="text-sm text-gray-500">
              Essayez de modifier vos filtres
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </button>

            <div className="flex items-center gap-1 mx-2">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-10 h-10 rounded-lg text-sm font-medium transition-colors",
                      pageNum === page
                        ? "bg-[#28afb1] text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
