"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  adminProductsApi,
  categoriesApi,
  type Product,
  type Category,
} from "@/lib/api";
import {
  Plus,
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Pencil,
  Copy,
  Archive,
  MoreHorizontal,
  Filter,
  X,
  Check,
  Loader2,
  AlertTriangle,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { cn, formatPrice, formatPriceTTC } from "@/lib/utils";
import Link from "next/link";

type StockStatus = "all" | "in_stock" | "low_stock" | "out_of_stock";

export default function AdminProduitsPage() {
  const router = useRouter();

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<StockStatus>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // Inline stock editing
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockValue, setEditingStockValue] = useState("");
  const [savingStock, setSavingStock] = useState(false);
  const stockInputRef = useRef<HTMLInputElement>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load categories once
  useEffect(() => {
    categoriesApi
      .list()
      .then((res) => setCategories(res.data || []))
      .catch(() => {});
  }, []);

  // Load products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        limit: 25,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.categorySlug = categoryFilter;
      if (stockFilter === "in_stock") params.inStock = "true";

      const res = await adminProductsApi.list(params);
      let data = res.data || [];

      // Client-side stock filtering for low/out states
      if (stockFilter === "out_of_stock") {
        data = data.filter((p) => {
          const stock = p.variants?.[0]?.stockQuantity ?? 0;
          return stock === 0;
        });
      } else if (stockFilter === "low_stock") {
        data = data.filter((p) => {
          const stock = p.variants?.[0]?.stockQuantity ?? 0;
          return stock > 0 && stock <= 5;
        });
      }

      setProducts(data);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    } catch {
      setError("Impossible de charger les produits. Service indisponible.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, categoryFilter, stockFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Focus stock input when editing
  useEffect(() => {
    if (editingStockId && stockInputRef.current) {
      stockInputRef.current.focus();
      stockInputRef.current.select();
    }
  }, [editingStockId]);

  // ─── Handlers ────────────────────────────────────────────

  const showToast = (message: string, type: "success" | "error" = "success") =>
    setToast({ message, type });

  const handleStockClick = (productId: string, currentStock: number) => {
    setEditingStockId(productId);
    setEditingStockValue(String(currentStock));
  };

  const handleStockSave = async (productId: string) => {
    const quantity = parseInt(editingStockValue, 10);
    if (isNaN(quantity) || quantity < 0) {
      setEditingStockId(null);
      return;
    }
    setSavingStock(true);
    try {
      await adminProductsApi.updateStock(productId, { quantity });
      // Update local state
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                variants: p.variants?.map((v, i) =>
                  i === 0 ? { ...v, stockQuantity: quantity } : v
                ),
              }
            : p
        )
      );
      showToast("Stock mis a jour");
    } catch {
      showToast("Erreur lors de la mise a jour du stock", "error");
    } finally {
      setSavingStock(false);
      setEditingStockId(null);
    }
  };

  const handleStockKeyDown = (
    e: React.KeyboardEvent,
    productId: string
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleStockSave(productId);
    } else if (e.key === "Escape") {
      setEditingStockId(null);
    }
  };

  const handleStatusToggle = async (
    productId: string,
    currentStatus: string
  ) => {
    const nextStatus = currentStatus === "ACTIVE" ? "DRAFT" : "ACTIVE";
    setActionLoading(productId);
    try {
      await adminProductsApi.update(productId, { status: nextStatus });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, status: nextStatus } : p
        )
      );
      showToast(
        `Produit ${nextStatus === "ACTIVE" ? "active" : "desactive"}`
      );
    } catch {
      showToast("Erreur lors du changement de statut", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (productId: string) => {
    setActionLoading(productId);
    try {
      const res = await adminProductsApi.duplicate(productId);
      showToast("Produit duplique");
      router.push(`/admin/produits/${res.data.id}`);
    } catch {
      showToast("Erreur lors de la duplication", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (productId: string) => {
    if (confirmDelete !== productId) {
      setConfirmDelete(productId);
      setTimeout(() => setConfirmDelete(null), 4000);
      return;
    }
    setActionLoading(productId);
    try {
      await adminProductsApi.delete(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setConfirmDelete(null);
      showToast("Produit archive");
    } catch {
      showToast("Erreur lors de l'archivage", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  // Bulk actions
  const handleBulkStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    setActionLoading("bulk");
    try {
      await adminProductsApi.bulkStatus(Array.from(selectedIds), status);
      setProducts((prev) =>
        prev.map((p) =>
          selectedIds.has(p.id) ? { ...p, status } : p
        )
      );
      showToast(`${selectedIds.size} produit(s) mis a jour`);
      setSelectedIds(new Set());
      setShowBulkMenu(false);
    } catch {
      showToast("Erreur lors de la mise a jour groupee", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const hasActiveFilters =
    statusFilter !== "" ||
    categoryFilter !== "" ||
    stockFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("");
    setCategoryFilter("");
    setStockFilter("all");
    setPage(1);
  };

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-in slide-in-from-top-2",
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          )}
        >
          {toast.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total > 0 && (
              <>
                {total} produit{total > 1 ? "s" : ""} au total
              </>
            )}
          </p>
        </div>
        <Link
          href="/admin/produits/nouveau"
          className="inline-flex items-center gap-2 bg-[#28afb1] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#28afb1]/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Ajouter un produit
        </Link>
      </div>

      {/* Search + Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors",
            hasActiveFilters
              ? "border-[#28afb1] text-[#28afb1] bg-[#28afb1]/5"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          )}
        >
          <Filter className="h-4 w-4" />
          Filtres
          {hasActiveFilters && (
            <span className="bg-[#28afb1] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {[statusFilter, categoryFilter, stockFilter !== "all" ? "1" : ""].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Statut
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none"
            >
              <option value="">Tous</option>
              <option value="ACTIVE">Actif</option>
              <option value="DRAFT">Brouillon</option>
              <option value="ARCHIVED">Archive</option>
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Categorie
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none"
            >
              <option value="">Toutes</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Stock
            </label>
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value as StockStatus);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none"
            >
              <option value="all">Tous</option>
              <option value="in_stock">En stock</option>
              <option value="low_stock">Stock faible (&le;5)</option>
              <option value="out_of_stock">Rupture</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              <X className="h-3.5 w-3.5" />
              Effacer
            </button>
          )}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-[#28afb1]/5 border border-[#28afb1]/20 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.size} produit{selectedIds.size > 1 ? "s" : ""}{" "}
            selectionne{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowBulkMenu(!showBulkMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Actions groupees
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {showBulkMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[180px]">
                  <button
                    onClick={() => handleBulkStatus("ACTIVE")}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition"
                  >
                    Activer
                  </button>
                  <button
                    onClick={() => handleBulkStatus("DRAFT")}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition"
                  >
                    Passer en brouillon
                  </button>
                  <button
                    onClick={() => handleBulkStatus("ARCHIVED")}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    Archiver
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedIds(new Set());
                setShowBulkMenu(false);
              }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-4">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-700 font-medium text-sm">{error}</p>
          <button
            onClick={loadProducts}
            className="mt-3 text-sm text-red-600 underline hover:no-underline"
          >
            Reessayer
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={
                      products.length > 0 &&
                      selectedIds.size === products.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-[#28afb1] focus:ring-[#28afb1]"
                  />
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Produit
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  SKU
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Categorie
                </th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Prix HT
                </th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Prix TTC
                </th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Stock
                </th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Statut
                </th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded-md animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">
                      Aucun produit trouve
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-2 text-sm text-[#28afb1] hover:underline"
                      >
                        Effacer les filtres
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const variant = product.variants?.[0];
                  const stock = variant?.stockQuantity ?? 0;
                  const image =
                    product.images?.find((i) => i.isPrimary) ||
                    product.images?.[0];
                  const isSelected = selectedIds.has(product.id);
                  const isActioning = actionLoading === product.id;
                  const isConfirmingDelete = confirmDelete === product.id;

                  return (
                    <tr
                      key={product.id}
                      className={cn(
                        "group transition-colors",
                        isSelected
                          ? "bg-[#28afb1]/5"
                          : "hover:bg-gray-50/50"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(product.id)}
                          className="rounded border-gray-300 text-[#28afb1] focus:ring-[#28afb1]"
                        />
                      </td>

                      {/* Product name + image */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/produits/${product.id}`}
                          className="flex items-center gap-3 group/link"
                        >
                          <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            {image ? (
                              <img
                                src={image.url}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageOff className="h-4 w-4 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-gray-900 line-clamp-1 group-hover/link:text-[#28afb1] transition-colors">
                            {product.name}
                          </span>
                        </Link>
                      </td>

                      {/* SKU */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {product.sku}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {product.categories?.[0]?.category?.name || "\u2014"}
                      </td>

                      {/* Price HT */}
                      <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">
                        {formatPrice(parseFloat(product.priceHt))}
                      </td>

                      {/* Price TTC */}
                      <td className="px-4 py-3 text-right text-gray-500 tabular-nums text-xs">
                        {formatPriceTTC(product.priceHt, product.tvaRate)}
                      </td>

                      {/* Stock — inline editable */}
                      <td className="px-4 py-3 text-right">
                        {editingStockId === product.id ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              ref={stockInputRef}
                              type="number"
                              min="0"
                              value={editingStockValue}
                              onChange={(e) =>
                                setEditingStockValue(e.target.value)
                              }
                              onKeyDown={(e) =>
                                handleStockKeyDown(e, product.id)
                              }
                              onBlur={() =>
                                handleStockSave(product.id)
                              }
                              disabled={savingStock}
                              className="w-16 px-2 py-1 text-right text-sm border border-[#28afb1] rounded-md focus:ring-2 focus:ring-[#28afb1]/20 outline-none tabular-nums"
                            />
                            {savingStock && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#28afb1]" />
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              handleStockClick(product.id, stock)
                            }
                            title="Cliquer pour modifier le stock"
                            className={cn(
                              "inline-flex items-center justify-center min-w-[2.5rem] rounded-full px-2.5 py-0.5 text-xs font-bold cursor-pointer transition-all hover:ring-2 hover:ring-offset-1",
                              stock === 0
                                ? "bg-red-50 text-red-600 hover:ring-red-300"
                                : stock <= 5
                                  ? "bg-orange-50 text-orange-600 hover:ring-orange-300"
                                  : "bg-green-50 text-green-700 hover:ring-green-300"
                            )}
                          >
                            {stock}
                          </button>
                        )}
                      </td>

                      {/* Status toggle */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            handleStatusToggle(product.id, product.status)
                          }
                          disabled={isActioning}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer",
                            product.status === "ACTIVE"
                              ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                              : product.status === "DRAFT"
                                ? "bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100"
                                : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                          )}
                        >
                          {isActioning ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : product.status === "ACTIVE" ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          ) : null}
                          {product.status === "ACTIVE"
                            ? "Actif"
                            : product.status === "DRAFT"
                              ? "Brouillon"
                              : "Archive"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/admin/produits/${product.id}`}
                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDuplicate(product.id)}
                            disabled={isActioning}
                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
                            title="Dupliquer"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(product.id)}
                            disabled={isActioning}
                            className={cn(
                              "p-1.5 rounded-md transition",
                              isConfirmingDelete
                                ? "bg-red-100 text-red-600 hover:bg-red-200"
                                : "hover:bg-gray-100 text-gray-500 hover:text-red-600"
                            )}
                            title={
                              isConfirmingDelete
                                ? "Cliquer a nouveau pour confirmer"
                                : "Archiver"
                            }
                          >
                            {isConfirmingDelete ? (
                              <Trash2 className="h-4 w-4" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {page} sur {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-4 w-4" />
              Precedent
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
