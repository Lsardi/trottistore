"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  adminProductsApi,
  categoriesApi,
  type Product,
  type Category,
  type AdminProductPayload,
} from "@/lib/api";
import {
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  ImageOff,
  Plus,
  GripVertical,
  X,
  Check,
  AlertTriangle,
  Star,
  Package,
} from "lucide-react";
import { cn, formatPrice, formatPriceTTC } from "@/lib/utils";

interface ImageEntry {
  url: string;
  alt: string;
  isPrimary: boolean;
}

interface VariantEntry {
  id: string;
  sku: string;
  name: string;
  stockQuantity: number;
  priceOverride: string;
  isActive: boolean;
}

export default function AdminProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Toast
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Categories
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const [priceHt, setPriceHt] = useState("");
  const [tvaRate, setTvaRate] = useState("20");
  const [weightGrams, setWeightGrams] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [variants, setVariants] = useState<VariantEntry[]>([]);

  // New image form
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageAlt, setNewImageAlt] = useState("");

  // Dirty tracking
  const [isDirty, setIsDirty] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Load product + categories
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [productRes, catRes] = await Promise.all([
          adminProductsApi.getById(id),
          categoriesApi.list(),
        ]);

        const p = productRes.data;
        setName(p.name);
        setSku(p.sku);
        setDescription(p.description || "");
        setShortDescription(p.shortDescription || "");
        setBrandId((p.brand as any)?.id || "");
        setPriceHt(String(p.priceHt));
        setTvaRate(String(p.tvaRate));
        setWeightGrams(p.weightGrams != null ? String(p.weightGrams) : "");
        setStatus(p.status);
        setIsFeatured(p.isFeatured);
        setMetaTitle((p as any).metaTitle || "");
        setMetaDesc((p as any).metaDesc || "");
        setSelectedCategories(
          p.categories?.map((c: any) => c.category?.id || c.categoryId) || []
        );
        setImages(
          (p.images || []).map((img: any) => ({
            url: img.url,
            alt: img.alt || "",
            isPrimary: img.isPrimary,
          }))
        );
        setVariants(
          (p.variants || []).map((v: any) => ({
            id: v.id,
            sku: v.sku,
            name: v.name,
            stockQuantity: v.stockQuantity,
            priceOverride: v.priceOverride ? String(v.priceOverride) : "",
            isActive: v.isActive,
          }))
        );
        setAllCategories(catRes.data || []);
      } catch {
        showToast("Erreur lors du chargement du produit", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Mark dirty on any change
  const markDirty = () => setIsDirty(true);

  // ─── Image management ──────────────────────────────────────

  const addImage = () => {
    if (!newImageUrl.trim()) return;
    const entry: ImageEntry = {
      url: newImageUrl.trim(),
      alt: newImageAlt.trim(),
      isPrimary: images.length === 0,
    };
    setImages((prev) => [...prev, entry]);
    setNewImageUrl("");
    setNewImageAlt("");
    markDirty();
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Ensure at least one primary
      if (next.length > 0 && !next.some((img) => img.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
    markDirty();
  };

  const setPrimaryImage = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, isPrimary: i === index }))
    );
    markDirty();
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    markDirty();
  };

  // ─── Category multi-select ────────────────────────────────

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((c) => c !== catId)
        : [...prev, catId]
    );
    markDirty();
  };

  // ─── Variant stock editing ────────────────────────────────

  const updateVariantStock = async (variantId: string, quantity: number) => {
    try {
      await adminProductsApi.updateStock(id, { variantId, quantity });
      setVariants((prev) =>
        prev.map((v) =>
          v.id === variantId ? { ...v, stockQuantity: quantity } : v
        )
      );
      showToast("Stock mis a jour");
    } catch {
      showToast("Erreur mise a jour stock", "error");
    }
  };

  // ─── Save ─────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim() || !sku.trim() || !priceHt) {
      showToast("Nom, SKU et prix sont requis", "error");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<AdminProductPayload> = {
        name: name.trim(),
        sku: sku.trim(),
        description: description || undefined,
        shortDescription: shortDescription || undefined,
        brandId: brandId || null,
        priceHt: parseFloat(priceHt),
        tvaRate: parseFloat(tvaRate),
        weightGrams: weightGrams ? parseInt(weightGrams, 10) : null,
        status,
        isFeatured,
        metaTitle: metaTitle || null,
        metaDesc: metaDesc || null,
        categories: selectedCategories,
        images: images.map((img) => ({
          url: img.url,
          alt: img.alt || undefined,
          isPrimary: img.isPrimary,
        })),
      };

      await adminProductsApi.update(id, payload);
      setIsDirty(false);
      showToast("Produit sauvegarde");
    } catch {
      showToast("Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 5000);
      return;
    }
    setDeleting(true);
    try {
      await adminProductsApi.delete(id);
      showToast("Produit supprime");
      router.push("/admin/produits");
    } catch {
      showToast("Erreur lors de la suppression", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#28afb1]" />
      </div>
    );
  }

  const priceTtc =
    priceHt && tvaRate
      ? (parseFloat(priceHt) * (1 + parseFloat(tvaRate) / 100)).toFixed(2)
      : "0.00";

  return (
    <div className="max-w-5xl mx-auto relative">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium",
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
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/produits"
            className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Modifier le produit
            </h1>
            <p className="text-sm text-gray-500 font-mono">{sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              confirmDelete
                ? "bg-red-600 text-white hover:bg-red-700"
                : "border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            )}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {confirmDelete ? "Confirmer la suppression" : "Supprimer"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-[#28afb1] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#28afb1]/90 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Sauvegarder
            {isDirty && <span className="h-2 w-2 rounded-full bg-white/50" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* General info */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Informations generales
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Nom du produit *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition"
                  placeholder="Trottinette electrique..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value);
                      markDirty();
                    }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Poids (g)
                  </label>
                  <input
                    type="number"
                    value={weightGrams}
                    onChange={(e) => {
                      setWeightGrams(e.target.value);
                      markDirty();
                    }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition"
                    placeholder="15000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Description courte
                </label>
                <textarea
                  value={shortDescription}
                  onChange={(e) => {
                    setShortDescription(e.target.value);
                    markDirty();
                  }}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    markDirty();
                  }}
                  rows={5}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition resize-y"
                />
              </div>
            </div>
          </section>

          {/* Images */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Images
            </h2>

            {/* Current images */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "relative group border rounded-lg overflow-hidden aspect-square bg-gray-50",
                      img.isPrimary
                        ? "border-[#28afb1] ring-2 ring-[#28afb1]/20"
                        : "border-gray-200"
                    )}
                  >
                    <img
                      src={img.url}
                      alt={img.alt}
                      className="w-full h-full object-contain"
                    />
                    {img.isPrimary && (
                      <span className="absolute top-2 left-2 bg-[#28afb1] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Principale
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      {!img.isPrimary && (
                        <button
                          onClick={() => setPrimaryImage(idx)}
                          className="p-1.5 bg-white rounded-md shadow text-gray-700 hover:text-[#28afb1]"
                          title="Definir comme principale"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      {idx > 0 && (
                        <button
                          onClick={() => moveImage(idx, idx - 1)}
                          className="p-1.5 bg-white rounded-md shadow text-gray-700 hover:text-gray-900"
                          title="Deplacer avant"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => removeImage(idx)}
                        className="p-1.5 bg-white rounded-md shadow text-gray-700 hover:text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add image */}
            <div className="flex gap-2">
              <input
                type="url"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="URL de l'image"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition"
                onKeyDown={(e) => e.key === "Enter" && addImage()}
              />
              <input
                type="text"
                value={newImageAlt}
                onChange={(e) => setNewImageAlt(e.target.value)}
                placeholder="Alt text"
                className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition"
                onKeyDown={(e) => e.key === "Enter" && addImage()}
              />
              <button
                onClick={addImage}
                disabled={!newImageUrl.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            </div>
          </section>

          {/* Variants */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Variantes & Stock
            </h2>
            {variants.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune variante</p>
            ) : (
              <div className="space-y-3">
                {variants.map((v) => (
                  <VariantRow
                    key={v.id}
                    variant={v}
                    onUpdateStock={(qty) => updateVariantStock(v.id, qty)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* SEO */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">SEO</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Meta titre
                </label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => {
                    setMetaTitle(e.target.value);
                    markDirty();
                  }}
                  maxLength={200}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {metaTitle.length}/200
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Meta description
                </label>
                <textarea
                  value={metaDesc}
                  onChange={(e) => {
                    setMetaDesc(e.target.value);
                    markDirty();
                  }}
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {metaDesc.length}/500
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Tarification
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Prix HT *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceHt}
                    onChange={(e) => {
                      setPriceHt(e.target.value);
                      markDirty();
                    }}
                    className="w-full px-3 py-2.5 pr-8 border border-gray-200 rounded-lg text-sm tabular-nums focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    &euro;
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  TVA (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={tvaRate}
                  onChange={(e) => {
                    setTvaRate(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm tabular-nums focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition"
                />
              </div>
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Prix TTC</span>
                  <span className="text-lg font-bold text-gray-900 tabular-nums">
                    {priceTtc} &euro;
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Status */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Publication
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Statut
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#28afb1]/20 focus:border-[#28afb1] outline-none transition"
                >
                  <option value="ACTIVE">Actif</option>
                  <option value="DRAFT">Brouillon</option>
                  <option value="ARCHIVED">Archive</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => {
                    setIsFeatured(e.target.checked);
                    markDirty();
                  }}
                  className="rounded border-gray-300 text-[#28afb1] focus:ring-[#28afb1]"
                />
                <span className="text-sm text-gray-700">Produit vedette</span>
              </label>
            </div>
          </section>

          {/* Categories */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Categories
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allCategories.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune categorie</p>
              ) : (
                allCategories.map((cat) => (
                  <label
                    key={cat.id}
                    className="flex items-center gap-2.5 cursor-pointer py-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="rounded border-gray-300 text-[#28afb1] focus:ring-[#28afb1]"
                    />
                    <span className="text-sm text-gray-700">{cat.name}</span>
                  </label>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Variant Row Component ──────────────────────────────────

function VariantRow({
  variant,
  onUpdateStock,
}: {
  variant: VariantEntry;
  onUpdateStock: (qty: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [stockValue, setStockValue] = useState(String(variant.stockQuantity));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const qty = parseInt(stockValue, 10);
    if (isNaN(qty) || qty < 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onUpdateStock(qty);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-900">{variant.name}</p>
        <p className="text-xs text-gray-400 font-mono">{variant.sku}</p>
      </div>
      <div className="flex items-center gap-4">
        {variant.priceOverride && (
          <span className="text-sm text-gray-500 tabular-nums">
            {formatPrice(parseFloat(variant.priceOverride))}
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Stock:</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={stockValue}
                onChange={(e) => setStockValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setEditing(false);
                }}
                onBlur={handleSave}
                autoFocus
                className="w-16 px-2 py-1 text-sm text-right border border-[#28afb1] rounded-md focus:ring-2 focus:ring-[#28afb1]/20 outline-none tabular-nums"
              />
              {saving && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#28afb1]" />
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                setStockValue(String(variant.stockQuantity));
                setEditing(true);
              }}
              className={cn(
                "min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-bold cursor-pointer hover:ring-2 hover:ring-offset-1 transition",
                variant.stockQuantity === 0
                  ? "bg-red-50 text-red-600 hover:ring-red-300"
                  : variant.stockQuantity <= 5
                    ? "bg-orange-50 text-orange-600 hover:ring-orange-300"
                    : "bg-green-50 text-green-700 hover:ring-green-300"
              )}
            >
              {variant.stockQuantity}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
