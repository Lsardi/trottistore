"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError, adminCategoriesApi, type AdminCategory } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Edit2, Plus, Save, Trash2, X } from "lucide-react";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Toast = { type: "success" | "error"; message: string };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newParentId, setNewParentId] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadCategories() {
    setLoading(true);
    try {
      const res = await adminCategoriesApi.list();
      setCategories(res.data || []);
    } catch {
      setToast({ type: "error", message: "Impossible de charger les categories." });
    } finally {
      setLoading(false);
    }
  }

  const parentOptions = useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setToast({ type: "error", message: "Le nom est obligatoire." });
      return;
    }

    setCreating(true);
    try {
      const slug = (newSlug.trim() || slugify(newName)).slice(0, 100);
      await adminCategoriesApi.create({
        name: newName.trim(),
        slug,
        parentId: newParentId || undefined,
      });
      setNewName("");
      setNewSlug("");
      setNewParentId("");
      setToast({ type: "success", message: "Categorie creee." });
      await loadCategories();
    } catch (error) {
      const apiError = error as ApiError;
      const message =
        (apiError?.data as { error?: { message?: string } } | null)?.error?.message ||
        "Echec de la creation.";
      setToast({ type: "error", message });
    } finally {
      setCreating(false);
    }
  }

  function startEdit(category: AdminCategory) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditSlug(category.slug);
    setEditParentId(category.parentId || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditSlug("");
    setEditParentId("");
  }

  async function saveEdit(categoryId: string) {
    if (!editName.trim()) {
      setToast({ type: "error", message: "Le nom est obligatoire." });
      return;
    }

    try {
      const payload = {
        name: editName.trim(),
        slug: (editSlug.trim() || slugify(editName)).slice(0, 100),
        parentId: editParentId || null,
      };
      await adminCategoriesApi.update(categoryId, payload);
      setToast({ type: "success", message: "Categorie mise a jour." });
      cancelEdit();
      await loadCategories();
    } catch (error) {
      const apiError = error as ApiError;
      const message =
        (apiError?.data as { error?: { message?: string } } | null)?.error?.message ||
        "Echec de la mise a jour.";
      setToast({ type: "error", message });
    }
  }

  async function handleDelete(category: AdminCategory) {
    if (category.productCount > 0) {
      setToast({ type: "error", message: "Categorie non vide: suppression bloquee." });
      return;
    }

    const confirmed = window.confirm(`Supprimer la categorie \"${category.name}\" ?`);
    if (!confirmed) return;

    try {
      await adminCategoriesApi.delete(category.id);
      setToast({ type: "success", message: "Categorie supprimee." });
      await loadCategories();
    } catch (error) {
      const apiError = error as ApiError;
      const message =
        (apiError?.data as { error?: { message?: string } } | null)?.error?.message ||
        "Echec de la suppression.";
      setToast({ type: "error", message });
    }
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          className={cn(
            "fixed right-4 top-4 z-50 border px-4 py-2 font-mono text-xs",
            toast.type === "success"
              ? "border-neon/40 bg-neon-dim text-neon"
              : "border-danger/40 bg-danger/10 text-danger",
          )}
        >
          {toast.message}
        </div>
      ) : null}

      <div>
        <h1 className="heading-lg">CATEGORIES</h1>
        <p className="font-mono text-sm text-text-muted mt-1">
          Gestion des categories produit et de leur hierarchie.
        </p>
      </div>

      <section className="bg-surface border border-border p-4">
        <h2 className="font-display font-bold text-text mb-3">Creer une categorie</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="spec-label block mb-1.5">Nom *</label>
            <input
              className="input-dark w-full"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Freins"
              required
            />
          </div>
          <div>
            <label className="spec-label block mb-1.5">Slug (optionnel)</label>
            <input
              className="input-dark w-full"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="freins"
            />
          </div>
          <div>
            <label className="spec-label block mb-1.5">Parent (optionnel)</label>
            <select
              className="input-dark w-full"
              value={newParentId}
              onChange={(e) => setNewParentId(e.target.value)}
            >
              <option value="">Aucun</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="btn-primary w-full inline-flex items-center justify-center gap-2"
              disabled={creating}
            >
              <Plus className="h-4 w-4" />
              {creating ? "Creation..." : "Creer"}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-surface border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="text-left px-4 py-3 spec-label">Nom</th>
              <th className="text-left px-4 py-3 spec-label">Slug</th>
              <th className="text-left px-4 py-3 spec-label">Parent</th>
              <th className="text-right px-4 py-3 spec-label">Produits</th>
              <th className="text-right px-4 py-3 spec-label">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx}>
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 bg-surface-2 animate-pulse" />
                  </td>
                </tr>
              ))
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center font-mono text-text-muted">
                  Aucune categorie
                </td>
              </tr>
            ) : (
              categories.map((category) => {
                const parent = categories.find((c) => c.id === category.parentId);
                const isEditing = editingId === category.id;

                return (
                  <tr key={category.id} className="hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className="input-dark w-full"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      ) : (
                        <span className="font-mono text-sm text-text">{category.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className="input-dark w-full"
                          value={editSlug}
                          onChange={(e) => setEditSlug(e.target.value)}
                        />
                      ) : (
                        <span className="font-mono text-xs text-text-dim">{category.slug}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          className="input-dark w-full"
                          value={editParentId}
                          onChange={(e) => setEditParentId(e.target.value)}
                        >
                          <option value="">Aucun</option>
                          {parentOptions
                            .filter((c) => c.id !== category.id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <span className="font-mono text-xs text-text-dim">{parent?.name || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm text-neon">{category.productCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="btn-outline inline-flex items-center gap-1 px-2 py-1"
                              onClick={() => void saveEdit(category.id)}
                            >
                              <Save className="h-3.5 w-3.5" />
                              Sauver
                            </button>
                            <button
                              type="button"
                              className="btn-outline inline-flex items-center gap-1 px-2 py-1"
                              onClick={cancelEdit}
                            >
                              <X className="h-3.5 w-3.5" />
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn-outline inline-flex items-center gap-1 px-2 py-1"
                              onClick={() => startEdit(category)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              Editer
                            </button>
                            <button
                              type="button"
                              className="btn-outline inline-flex items-center gap-1 px-2 py-1 border-danger/40 text-danger"
                              onClick={() => void handleDelete(category)}
                              disabled={category.productCount > 0}
                              title={category.productCount > 0 ? "Suppression impossible: categorie non vide" : "Supprimer"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
