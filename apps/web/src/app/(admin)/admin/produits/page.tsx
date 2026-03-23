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
            "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 font-mono text-sm font-bold transition-all",
            toast.type === "success"
              ? "bg-neon text-void"
              : "bg-danger text-white"
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
          <h1 className="heading-lg">PRODUITS</h1>
          <p className="font-mono text-sm text-text-muted mt-0.5">
            {total > 0 && (
              <>
                {total} produit{total > 1 ? "s" : ""} au total
              </>
            )}
          </p>
        </div>
        <Link
          href="/admin/produits/nouveau"
          className="btn-neon"
        >
          <Plus className="h-4 w-4" />
          AJOUTER UN PRODUIT
        </Link>
      </div>

      {/* Search + Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
          <input
            type="text"
            placeholder="Rechercher par nom, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark w-full pl-10"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2.5 font-mono text-xs uppercase tracking-wider font-bold border transition-colors",
            hasActiveFilters
              ? "border-neon text-neon bg-neon-dim"
              : "border-border text-text-muted hover:border-text-dim"
          )}
        >
          <Filter className="h-4 w-4" />
          Filtres
          {hasActiveFilters && (
            <span className="bg-neon text-void text-xs font-bold h-5 w-5 flex items-center justify-center">
              {[statusFilter, categoryFilter, stockFilter !== "all" ? "1" : ""].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-surface border border-border p-4 mb-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[160px]">
            <label className="spec-label block mb-1.5">Statut</label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="input-dark w-full appearance-none pr-8"
              >
                <option value="">Tous</option>
                <option value="ACTIVE">Actif</option>
                <option value="DRAFT">Brouillon</option>
                <option value="ARCHIVED">Archive</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim pointer-events-none" />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="spec-label block mb-1.5">Categorie</label>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="input-dark w-full appearance-none pr-8"
              >
                <option value="">Toutes</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim pointer-events-none" />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="spec-label block mb-1.5">Stock</label>
            <div className="relative">
              <select
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value as StockStatus);
                  setPage(1);
                }}
                className="input-dark w-full appearance-none pr-8"
              >
                <option value="all">Tous</option>
                <option value="in_stock">En stock</option>
                <option value="low_stock">Stock faible (&le;5)</option>
                <option value="out_of_stock">Rupture</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim pointer-events-none" />
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 font-mono text-xs text-text-dim hover:text-neon transition"
            >
              <X className="h-3.5 w-3.5" />
              Effacer
            </button>
          )}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-neon-dim border border-neon/20 px-4 py-3 mb-4 flex items-center justify-between">
          <span className="font-mono text-sm text-neon">
            {selectedIds.size} produit{selectedIds.size > 1 ? "s" : ""}{" "}
            selectionne{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowBulkMenu(!showBulkMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border font-mono text-xs font-bold text-text hover:border-neon transition"
              >
                Actions groupees
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {showBulkMenu && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border py-1 z-20 min-w-[180px]">
                  <button
                    onClick={() => handleBulkStatus("ACTIVE")}
                    className="w-full text-left px-4 py-2 font-mono text-sm text-text hover:bg-surface-2 transition"
                  >
                    Activer
                  </button>
                  <button
                    onClick={() => handleBulkStatus("DRAFT")}
                    className="w-full text-left px-4 py-2 font-mono text-sm text-text hover:bg-surface-2 transition"
                  >
                    Passer en brouillon
                  </button>
                  <button
                    onClick={() => handleBulkStatus("ARCHIVED")}
                    className="w-full text-left px-4 py-2 font-mono text-sm text-danger hover:bg-danger/10 transition"
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
              className="px-3 py-1.5 font-mono text-xs text-text-dim hover:text-text transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 p-6 text-center mb-4">
          <AlertTriangle className="h-8 w-8 text-danger mx-auto mb-2" />
          <p className="font-mono text-sm text-danger">{error}</p>
          <button
            onClick={loadProducts}
            className="mt-3 font-mono text-sm text-danger underline hover:no-underline"
          >
            Reessayer
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={
                      products.length > 0 &&
                      selectedIds.size === products.length
                    }
                    onChange={toggleSelectAll}
                    className="accent-neon"
                  />
                </th>
                <th className="text-left px-4 py-3.5 spec-label">Produit</th>
                <th className="text-left px-4 py-3.5 spec-label">SKU</th>
                <th className="text-left px-4 py-3.5 spec-label">Categorie</th>
                <th className="text-right px-4 py-3.5 spec-label">Prix HT</th>
                <th className="text-right px-4 py-3.5 spec-label">Prix TTC</th>
                <th className="text-right px-4 py-3.5 spec-label">Stock</th>
                <th className="text-center px-4 py-3.5 spec-label">Statut</th>
                <th className="text-right px-4 py-3.5 spec-label">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-4">
                      <div className="h-4 bg-surface-2 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Package className="h-10 w-10 text-text-dim mx-auto mb-3" />
                    <p className="font-mono text-text-muted">
                      Aucun produit trouve
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-2 font-mono text-sm text-neon hover:underline"
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
                          ? "bg-neon-dim"
                          : "hover:bg-surface-2/50"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(product.id)}
                          className="accent-neon"
                        />
                      </td>

                      {/* Product name + image */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/produits/${product.id}`}
                          className="flex items-center gap-3 group/link"
                        >
                          <div className="w-10 h-10 bg-void border border-border overflow-hidden flex-shrink-0">
                            {image ? (
                              <img
                                src={image.url}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageOff className="h-4 w-4 text-text-dim" />
                              </div>
                            )}
                          </div>
                          <span className="font-mono text-sm text-text line-clamp-1 group-hover/link:text-neon transition-colors">
                            {product.name}
                          </span>
                        </Link>
                      </td>

                      {/* SKU */}
                      <td className="px-4 py-3 font-mono text-xs text-text-dim">
                        {product.sku}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">
                        {product.categories?.[0]?.category?.name || "\u2014"}
                      </td>

                      {/* Price HT */}
                      <td className="px-4 py-3 text-right font-mono text-sm text-text tabular-nums">
                        {formatPrice(parseFloat(product.priceHt))}
                      </td>

                      {/* Price TTC */}
                      <td className="px-4 py-3 text-right font-mono text-xs text-text-muted tabular-nums">
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
                              className="w-16 px-2 py-1 text-right font-mono text-sm border border-neon bg-surface text-text outline-none tabular-nums"
                            />
                            {savingStock && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-neon" />
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              handleStockClick(product.id, stock)
                            }
                            title="Cliquer pour modifier le stock"
                            className={cn(
                              "inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 font-mono text-xs font-bold cursor-pointer transition-all",
                              stock === 0
                                ? "bg-danger/20 text-danger"
                                : stock <= 5
                                  ? "bg-warning/20 text-warning"
                                  : "bg-neon-dim text-neon"
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
                            "inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border",
                            product.status === "ACTIVE"
                              ? "bg-neon-dim text-neon border-neon/30 hover:bg-neon/20"
                              : product.status === "DRAFT"
                                ? "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
                                : "bg-surface-2 text-text-dim border-border hover:bg-surface-3"
                          )}
                        >
                          {isActioning ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : product.status === "ACTIVE" ? (
                            <span className="h-1.5 w-1.5 bg-neon" />
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
                            className="p-1.5 text-text-dim hover:text-neon transition"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDuplicate(product.id)}
                            disabled={isActioning}
                            className="p-1.5 text-text-dim hover:text-neon transition"
                            title="Dupliquer"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(product.id)}
                            disabled={isActioning}
                            className={cn(
                              "p-1.5 transition",
                              isConfirmingDelete
                                ? "bg-danger/20 text-danger"
                                : "text-text-dim hover:text-danger"
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
          <p className="font-mono text-sm text-text-muted">
            Page {page} sur {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn-outline py-2 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Precedent
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="btn-outline py-2 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
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
