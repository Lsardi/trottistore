"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { productsApi, categoriesApi, type Product, type Category } from "@/lib/api";

const SORT_OPTIONS = [
  { value: "newest", label: "Plus récents" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "name", label: "Nom A-Z" },
] as const;

export default function ProductsPage() {
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
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Catalogue</h1>
        <p className="text-gray-600">
          Pièces détachées et accessoires pour trottinettes électriques
        </p>
      </div>

      {/* Filtres & tri */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        {/* Recherche */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Catégorie */}
        <select
          value={categorySlug}
          onChange={(e) => { setCategorySlug(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug}>{cat.name}</option>
          ))}
        </select>

        {/* Tri */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Grille produits */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl animate-pulse aspect-[3/4]" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">Aucun produit trouvé</p>
          <p className="text-sm">Essayez de modifier vos filtres</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            ← Précédent
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
