"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useState } from "react";
import {
  adminProductsApi,
  fitmentsApi,
  type FitmentModel,
  type FitmentProduct,
  type Product,
} from "@/lib/api";
import {
  Link2,
  Loader2,
  Package,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "edit" | "lookup";

export default function AdminCompatibilitePage() {
  const [tab, setTab] = useState<Tab>("edit");

  // Suggested models (distinct across catalog) — loaded once
  const [models, setModels] = useState<FitmentModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  async function loadModels() {
    setLoadingModels(true);
    try {
      const res = await fitmentsApi.listModels();
      setModels(res.data || []);
    } catch {
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }

  useEffect(() => {
    void loadModels();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-lg">COMPATIBILITÉ</h1>
        <p className="font-mono text-sm text-text-muted mt-1">
          Base fitment — associe chaque pièce aux modèles de trottinettes sur lesquels elle
          va. Recherche inverse disponible.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("edit")}
          className={cn(
            "px-3 py-2 font-mono text-xs uppercase tracking-wider border",
            tab === "edit"
              ? "bg-neon text-void border-neon"
              : "bg-surface text-text-muted border-border hover:border-text-dim",
          )}
        >
          Éditer une pièce
        </button>
        <button
          type="button"
          onClick={() => setTab("lookup")}
          className={cn(
            "px-3 py-2 font-mono text-xs uppercase tracking-wider border",
            tab === "lookup"
              ? "bg-neon text-void border-neon"
              : "bg-surface text-text-muted border-border hover:border-text-dim",
          )}
        >
          Rechercher par modèle
        </button>
      </div>

      {tab === "edit" ? (
        <EditTab suggestions={models} onModelsRefresh={loadModels} loadingModels={loadingModels} />
      ) : (
        <LookupTab suggestions={models} loadingModels={loadingModels} />
      )}
    </div>
  );
}

// ─── Tab 1 — edit a product's compatible models ──────────────────

function EditTab({
  suggestions,
  onModelsRefresh,
  loadingModels,
}: {
  suggestions: FitmentModel[];
  onModelsRefresh: () => void;
  loadingModels: boolean;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [editedModels, setEditedModels] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await adminProductsApi.list({ search: q, limit: 20 });
      setResults(res.data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => void runSearch(), 250);
    return () => clearTimeout(timer);
  }, [runSearch]);

  async function openProduct(p: Product) {
    setMessage(null);
    try {
      const res = await adminProductsApi.getById(p.id);
      setSelected(res.data);
      setEditedModels(res.data.compatibleModels ?? []);
      setDraft("");
    } catch {
      setMessage("Impossible de charger la fiche produit.");
    }
  }

  function addModel(raw: string) {
    const normalized = raw.trim();
    if (!normalized) return;
    if (editedModels.includes(normalized)) return;
    setEditedModels([...editedModels, normalized]);
    setDraft("");
  }

  function removeModel(m: string) {
    setEditedModels(editedModels.filter((x) => x !== m));
  }

  function handleDraftKeydown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addModel(draft);
    } else if (e.key === "Backspace" && draft === "" && editedModels.length > 0) {
      setEditedModels(editedModels.slice(0, -1));
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      await adminProductsApi.updateCompatibility(selected.id, editedModels);
      setMessage(`✓ ${editedModels.length} modèle(s) enregistré(s) pour ${selected.name}`);
      onModelsRefresh();
    } catch {
      setMessage("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: product search + results */}
      <section className="bg-surface border border-border p-4 space-y-3">
        <div className="spec-label">CHERCHER UNE PIÈCE</div>
        <div className="relative">
          <Search className="h-4 w-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, SKU…"
            className="input-dark w-full pl-9"
          />
        </div>
        <div className="space-y-1 max-h-96 overflow-auto">
          {searching ? (
            <div className="flex items-center gap-2 font-mono text-xs text-text-muted p-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-neon" />
              Recherche…
            </div>
          ) : results.length === 0 ? (
            <p className="font-mono text-xs text-text-muted p-2">
              {search ? "Aucun résultat." : "Tape au moins 2 lettres."}
            </p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void openProduct(p)}
                className={cn(
                  "w-full text-left border bg-surface-2 p-2 transition-colors",
                  selected?.id === p.id
                    ? "border-neon"
                    : "border-border hover:border-text-dim",
                )}
              >
                <p className="font-mono text-xs text-text">{p.name}</p>
                <p className="font-mono text-[11px] text-text-dim">{p.sku}</p>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Right: compatibility editor */}
      <section className="bg-surface border border-border p-4 space-y-3">
        <div className="spec-label">MODÈLES COMPATIBLES</div>
        {!selected ? (
          <p className="font-mono text-xs text-text-muted">
            Sélectionne une pièce à gauche pour éditer ses compatibilités.
          </p>
        ) : (
          <>
            <div>
              <p className="font-mono text-xs text-text truncate">{selected.name}</p>
              <p className="font-mono text-[11px] text-text-dim">{selected.sku}</p>
            </div>

            {/* Selected models as tags */}
            <div className="border border-border bg-surface-2 p-2 min-h-[72px]">
              <div className="flex flex-wrap gap-1.5">
                {editedModels.length === 0 ? (
                  <p className="font-mono text-[11px] text-text-dim p-1">
                    Aucun modèle associé.
                  </p>
                ) : (
                  editedModels.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1 bg-neon-dim border border-neon/40 text-neon font-mono text-[11px] px-2 py-0.5"
                    >
                      {m}
                      <button
                        type="button"
                        onClick={() => removeModel(m)}
                        className="hover:text-text"
                        aria-label={`Retirer ${m}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Add new model input */}
            <div className="flex gap-1">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleDraftKeydown}
                placeholder="Ex: Xiaomi M365 Pro (Entrée ou virgule pour ajouter)"
                className="input-dark flex-1"
                list="fitment-suggestions"
              />
              <datalist id="fitment-suggestions">
                {suggestions.map((s) => (
                  <option key={s.model} value={s.model}>
                    {s.productCount} pièce{s.productCount > 1 ? "s" : ""}
                  </option>
                ))}
              </datalist>
              <button
                type="button"
                onClick={() => addModel(draft)}
                className="btn-outline px-3"
                aria-label="Ajouter"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Suggestions chips */}
            {!loadingModels && suggestions.length > 0 ? (
              <div className="pt-2 border-t border-border">
                <p className="font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1.5">
                  Suggérés
                </p>
                <div className="flex flex-wrap gap-1">
                  {suggestions
                    .filter((s) => !editedModels.includes(s.model))
                    .slice(0, 12)
                    .map((s) => (
                      <button
                        key={s.model}
                        type="button"
                        onClick={() => addModel(s.model)}
                        className="font-mono text-[11px] border border-border bg-surface-2 text-text-muted px-2 py-0.5 hover:border-neon hover:text-neon"
                      >
                        {s.model}
                        <span className="text-text-dim ml-1">({s.productCount})</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="btn-neon w-full disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              ENREGISTRER
            </button>

            {message ? (
              <p
                className={cn(
                  "font-mono text-[11px]",
                  message.startsWith("✓") ? "text-neon" : "text-danger",
                )}
                role="status"
              >
                {message}
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

// ─── Tab 2 — reverse lookup: products for a model ─────────────────

function LookupTab({
  suggestions,
  loadingModels,
}: {
  suggestions: FitmentModel[];
  loadingModels: boolean;
}) {
  const [model, setModel] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<FitmentProduct[]>([]);

  async function runLookup(name: string) {
    const normalized = name.trim();
    setSubmitted(normalized);
    if (!normalized) {
      setProducts([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fitmentsApi.productsForModel(normalized);
      setProducts(res.data || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runLookup(model);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border p-4 space-y-3"
      >
        <div className="spec-label">RECHERCHER PAR MODÈLE</div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="h-4 w-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ex: Dualtron Storm, Xiaomi M365 Pro…"
              className="input-dark w-full pl-9"
              list="lookup-suggestions"
            />
            <datalist id="lookup-suggestions">
              {suggestions.map((s) => (
                <option key={s.model} value={s.model}>
                  {s.productCount} pièce{s.productCount > 1 ? "s" : ""}
                </option>
              ))}
            </datalist>
          </div>
          <button type="submit" className="btn-neon">
            Chercher
          </button>
        </div>

        {/* Quick-pick from suggestions */}
        {!loadingModels && suggestions.length > 0 ? (
          <div>
            <p className="font-mono text-[10px] text-text-dim uppercase tracking-wider mb-1.5">
              Modèles dans ton catalogue
            </p>
            <div className="flex flex-wrap gap-1">
              {suggestions.slice(0, 20).map((s) => (
                <button
                  key={s.model}
                  type="button"
                  onClick={() => {
                    setModel(s.model);
                    void runLookup(s.model);
                  }}
                  className="font-mono text-[11px] border border-border bg-surface-2 text-text-muted px-2 py-0.5 hover:border-neon hover:text-neon"
                >
                  {s.model}
                  <span className="text-text-dim ml-1">({s.productCount})</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </form>

      {submitted ? (
        <div className="bg-surface border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-text inline-flex items-center gap-2">
              <Package className="h-4 w-4 text-neon" />
              Pièces compatibles avec {submitted}
            </h2>
            <span className="font-mono text-xs text-text-muted">
              {loading ? "…" : `${products.length} résultat(s)`}
            </span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 font-mono text-xs text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-neon" />
              Recherche…
            </div>
          ) : products.length === 0 ? (
            <p className="font-mono text-xs text-text-muted">
              Aucune pièce marquée compatible avec ce modèle. Va dans l&apos;onglet{" "}
              <strong>Éditer une pièce</strong> pour en ajouter.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {products.map((p) => (
                <li key={p.id}>
                  <a
                    href={`/admin/produits/${p.id}`}
                    className="flex items-center justify-between py-2 hover:text-neon"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-text truncate">{p.name}</p>
                      <p className="font-mono text-[11px] text-text-dim">
                        {p.sku}
                        {p.brand?.name ? ` · ${p.brand.name}` : ""}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-neon shrink-0 ml-2">
                      {Number(p.priceHt).toFixed(2)} €
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
