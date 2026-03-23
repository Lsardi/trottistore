"use client";

import { useEffect, useState } from "react";
import { productsApi, type Product } from "@/lib/api";
import {
  Plus,
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  ImageOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminProduitsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await productsApi.list({ page, limit: 20, search: search || undefined });
        setProducts(res.data || []);
        setTotalPages(res.pagination?.totalPages || 1);
      } catch { /* services non connectes */ }
      finally { setLoading(false); }
    }
    load();
  }, [page, search]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
          <p className="text-sm text-gray-500 mt-1">Gerez votre catalogue produits</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-[#28afb1] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#28afb1]/90 transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          Ajouter un produit
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un produit par nom ou SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Produit</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">SKU</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Categorie</th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Prix HT</th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Stock</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-4 bg-gray-100 rounded-md animate-pulse" />
                  </td>
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">Aucun produit trouve</p>
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const variant = product.variants?.[0];
                const stock = variant?.stockQuantity ?? 0;
                const image = product.images?.find((i) => i.isPrimary) || product.images?.[0];

                return (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {image ? (
                            <img src={image.url} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageOff className="h-4 w-4 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-gray-900 line-clamp-1">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-gray-400">{product.sku}</td>
                    <td className="px-6 py-3.5 text-gray-500">
                      {product.categories?.[0]?.category?.name || "\u2014"}
                    </td>
                    <td className="px-6 py-3.5 text-right font-medium text-gray-900">
                      {parseFloat(product.priceHt).toFixed(2)} &euro;
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-bold",
                          stock === 0
                            ? "bg-red-50 text-red-600"
                            : stock <= 5
                              ? "bg-orange-50 text-orange-600"
                              : "bg-green-50 text-green-700"
                        )}
                      >
                        {stock}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium",
                          product.status === "ACTIVE"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {product.status === "ACTIVE" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        )}
                        {product.status === "ACTIVE" ? "Actif" : product.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Precedent
          </button>
          <span className="px-3 py-2 text-sm text-gray-500">
            Page <span className="font-semibold text-gray-900">{page}</span> sur{" "}
            <span className="font-semibold text-gray-900">{totalPages}</span>
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
