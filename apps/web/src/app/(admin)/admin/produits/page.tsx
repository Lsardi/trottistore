"use client";

import { useEffect, useState } from "react";
import { productsApi, type Product } from "@/lib/api";

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
      } catch { /* services non connectés */ }
      finally { setLoading(false); }
    }
    load();
  }, [page, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition">
          + Ajouter un produit
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Rechercher un produit par nom ou SKU..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Produit</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">SKU</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Catégorie</th>
              <th className="text-right px-6 py-3 text-gray-500 font-medium">Prix HT</th>
              <th className="text-right px-6 py-3 text-gray-500 font-medium">Stock</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  Aucun produit trouvé
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const variant = product.variants?.[0];
                const stock = variant?.stockQuantity ?? 0;
                const image = product.images?.find((i) => i.isPrimary) || product.images?.[0];

                return (
                  <tr key={product.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                          {image ? (
                            <img src={image.url} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm">🛴</div>
                          )}
                        </div>
                        <span className="font-medium text-gray-900 line-clamp-1">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-500">{product.sku}</td>
                    <td className="px-6 py-3 text-gray-500">
                      {product.categories?.[0]?.category?.name || "—"}
                    </td>
                    <td className="px-6 py-3 text-right">{parseFloat(product.priceHt).toFixed(2)} €</td>
                    <td className="px-6 py-3 text-right">
                      <span className={stock <= 5 ? (stock === 0 ? "text-red-600 font-bold" : "text-orange-600 font-medium") : "text-gray-900"}>
                        {stock}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        product.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}>
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
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border text-sm disabled:opacity-50"
          >
            ←
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded border text-sm disabled:opacity-50"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
