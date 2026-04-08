"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  adminProductsApi,
  categoriesApi,
  type Category,
  type AdminProductPayload,
} from "@/lib/api";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  X,
  Check,
  AlertTriangle,
  Star,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageEntry {
  url: string;
  alt: string;
  isPrimary: boolean;
}

export default function AdminNewProductPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [priceHt, setPriceHt] = useState("");
  const [tvaRate, setTvaRate] = useState("20");
  const [weightGrams, setWeightGrams] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [images, setImages] = useState<ImageEntry[]>([]);

  // New image form
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageAlt, setNewImageAlt] = useState("");

  const showToast = (message: string, type: "success" | "error" = "success") =>
    setToast({ message, type });

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Load categories
  useEffect(() => {
    categoriesApi
      .list()
      .then((res) => setAllCategories(res.data || []))
      .catch(() => {});
  }, []);

  // Auto-generate SKU from name
  useEffect(() => {
    if (name && !sku) {
      const autoSku = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 30);
      setSku(autoSku);
    }
  }, [name]);

  // Image management
  const addImage = () => {
    if (!newImageUrl.trim()) return;
    setImages((prev) => [
      ...prev,
      {
        url: newImageUrl.trim(),
        alt: newImageAlt.trim(),
        isPrimary: prev.length === 0,
      },
    ]);
    setNewImageUrl("");
    setNewImageAlt("");
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((img) => img.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  const setPrimaryImage = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, isPrimary: i === index }))
    );
  };

  // Category toggle
  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((c) => c !== catId)
        : [...prev, catId]
    );
  };

  // Save
  const handleSave = async () => {
    if (!name.trim()) {
      showToast("Le nom du produit est requis", "error");
      return;
    }
    if (!sku.trim()) {
      showToast("Le SKU est requis", "error");
      return;
    }
    if (!priceHt || parseFloat(priceHt) < 0) {
      showToast("Le prix HT est requis", "error");
      return;
    }

    setSaving(true);
    try {
      const payload: AdminProductPayload = {
        name: name.trim(),
        sku: sku.trim(),
        description: description || undefined,
        shortDescription: shortDescription || undefined,
        priceHt: parseFloat(priceHt),
        tvaRate: parseFloat(tvaRate),
        weightGrams: weightGrams ? parseInt(weightGrams, 10) : undefined,
        status,
        isFeatured,
        metaTitle: metaTitle || undefined,
        metaDesc: metaDesc || undefined,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        images:
          images.length > 0
            ? images.map((img) => ({
                url: img.url,
                alt: img.alt || undefined,
                isPrimary: img.isPrimary,
              }))
            : undefined,
      };

      const res = await adminProductsApi.create(payload);
      showToast("Produit cree avec succes");
      // Redirect to edit page
      setTimeout(() => {
        router.push(`/admin/produits/${res.data.id}`);
      }, 500);
    } catch (err: any) {
      const msg =
        err?.data?.error?.message || "Erreur lors de la creation du produit";
      showToast(msg, "error");
    } finally {
      setSaving(false);
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
              ? "bg-neon text-surface"
              : "bg-danger text-surface"
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
            className="p-2 rounded-lg hover:bg-surface-2 transition text-text-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-text">
              Nouveau produit
            </h1>
            <p className="text-sm text-text-muted">
              Remplissez les informations du produit
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/produits"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-text-muted hover:bg-surface transition"
          >
            Annuler
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-neon text-surface px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-neon/90 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Creer le produit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* General info */}
          <section className="bg-surface rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-text mb-4">
              Informations generales
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Nom du produit *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
                  placeholder="Trottinette electrique..."
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
                    placeholder="TROTT-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Poids (g)
                  </label>
                  <input
                    type="number"
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
                    placeholder="15000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Description courte
                </label>
                <textarea
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition resize-y"
                />
              </div>
            </div>
          </section>

          {/* Images */}
          <section className="bg-surface rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-text mb-4">
              Images
            </h2>

            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "relative group border rounded-lg overflow-hidden aspect-square bg-surface",
                      img.isPrimary
                        ? "border-neon ring-2 ring-neon/20"
                        : "border-border"
                    )}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt || "Image produit"}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      style={{ objectFit: "contain" }}
                    />
                    {img.isPrimary && (
                      <span className="absolute top-2 left-2 bg-neon text-surface text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Principale
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      {!img.isPrimary && (
                        <button
                          onClick={() => setPrimaryImage(idx)}
                          className="p-1.5 bg-surface rounded-md shadow text-text hover:text-neon"
                          title="Definir comme principale"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => removeImage(idx)}
                        className="p-1.5 bg-surface rounded-md shadow text-text hover:text-red-600"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="url"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="URL de l'image"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
                onKeyDown={(e) => e.key === "Enter" && addImage()}
              />
              <input
                type="text"
                value={newImageAlt}
                onChange={(e) => setNewImageAlt(e.target.value)}
                placeholder="Alt text"
                className="w-40 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
                onKeyDown={(e) => e.key === "Enter" && addImage()}
              />
              <button
                onClick={addImage}
                disabled={!newImageUrl.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-2 rounded-lg text-sm font-medium text-text hover:bg-surface transition disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            </div>
          </section>

          {/* SEO */}
          <section className="bg-surface rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-text mb-4">SEO</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Meta titre
                </label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  maxLength={200}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
                />
                <p className="text-xs text-text-dim mt-1">
                  {metaTitle.length}/200
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Meta description
                </label>
                <textarea
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition resize-none"
                />
                <p className="text-xs text-text-dim mt-1">
                  {metaDesc.length}/500
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing */}
          <section className="bg-surface rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-text mb-4">
              Tarification
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Prix HT *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceHt}
                    onChange={(e) => setPriceHt(e.target.value)}
                    className="w-full px-3 py-2.5 pr-8 border border-border rounded-lg text-sm tabular-nums focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim text-sm">
                    &euro;
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  TVA (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={tvaRate}
                  onChange={(e) => setTvaRate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm tabular-nums focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
                />
              </div>
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Prix TTC</span>
                  <span className="text-lg font-bold text-text tabular-nums">
                    {priceTtc} &euro;
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Status */}
          <section className="bg-surface rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-text mb-4">
              Publication
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Statut
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-neon/20 focus:border-neon outline-none transition"
                >
                  <option value="DRAFT">Brouillon</option>
                  <option value="ACTIVE">Actif</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded border-border text-neon focus:ring-neon"
                />
                <span className="text-sm text-text">Produit vedette</span>
              </label>
            </div>
          </section>

          {/* Categories */}
          <section className="bg-surface rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-text mb-4">
              Categories
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allCategories.length === 0 ? (
                <p className="text-sm text-text-dim">Aucune categorie</p>
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
                      className="rounded border-border text-neon focus:ring-neon"
                    />
                    <span className="text-sm text-text">{cat.name}</span>
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
