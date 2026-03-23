"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { productsApi, categoriesApi, type Product, type Category } from "@/lib/api";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "newest", label: "Plus recents" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix decroissant" },
  { value: "name", label: "Nom A-Z" },
] as const;

export default function ProductsPageWrapper() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-12"><div className="animate-pulse h-96 bg-gray-100 rounded-2xl" /></div>}>
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
  const [categorySlug, setCategorySlug] = useState(searchParams.get("categorySlug") || "");

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
      // Categories non chargees — pas bloquant
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Catalogue</h1>
        <p className="text-gray-500">
          Pieces detachees et accessoires pour trottinettes electriques
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
            className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow text-sm"
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
            className="appearance-none pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none cursor-pointer"
          >
            <option value="">Toutes les categories</option>
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
          className="appearance-none px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none cursor-pointer"
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden">
              <div className="aspect-square bg-gray-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-16" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                <div className="h-5 bg-gray-100 rounded animate-pulse w-20 mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-24">
          <PackageSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-1">Aucun produit trouve</p>
          <p className="text-sm text-gray-500">Essayez de modifier vos filtres</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
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
            Precedent
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
                      ? "bg-teal-500 text-white shadow-sm"
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
  );
}
