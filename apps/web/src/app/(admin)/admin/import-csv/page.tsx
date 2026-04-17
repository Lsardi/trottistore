"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  X,
  Loader2,
  ChevronDown,
  ArrowRight,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────

interface CsvRow {
  [key: string]: string;
}

interface ImportRow {
  sku: string;
  name: string;
  description?: string;
  shortDescription?: string;
  price?: number;
  brand?: string;
  category?: string;
  specs?: {
    power?: string;
    voltage?: string;
    battery?: string;
    speed?: string;
    weight?: string;
    range?: string;
  };
}

interface ImportResult {
  matched: number;
  created: number;
  skipped: number;
  errors: Array<{ sku: string; error: string }>;
}

type FieldKey =
  | "sku"
  | "name"
  | "description"
  | "shortDescription"
  | "price"
  | "brand"
  | "category"
  | "power"
  | "voltage"
  | "battery"
  | "speed"
  | "weight"
  | "range"
  | "__skip__";

interface FieldOption {
  key: FieldKey;
  label: string;
}

const FIELD_OPTIONS: FieldOption[] = [
  { key: "__skip__", label: "-- Ignorer --" },
  { key: "sku", label: "SKU / Reference" },
  { key: "name", label: "Nom du produit" },
  { key: "description", label: "Description" },
  { key: "shortDescription", label: "Description courte" },
  { key: "price", label: "Prix HT" },
  { key: "brand", label: "Marque" },
  { key: "category", label: "Categorie" },
  { key: "power", label: "Puissance (W)" },
  { key: "voltage", label: "Tension (V)" },
  { key: "battery", label: "Batterie (Ah)" },
  { key: "speed", label: "Vitesse max (km/h)" },
  { key: "weight", label: "Poids (kg)" },
  { key: "range", label: "Autonomie (km)" },
];

// Auto-detect mappings from common French/English column names
const AUTO_DETECT_MAP: Record<string, FieldKey> = {
  // SKU
  sku: "sku",
  ref: "sku",
  reference: "sku",
  "référence": "sku",
  "ref.": "sku",
  "code article": "sku",
  "code_article": "sku",
  article: "sku",
  ean: "sku",

  // Name
  nom: "name",
  name: "name",
  produit: "name",
  product: "name",
  designation: "name",
  "désignation": "name",
  titre: "name",
  title: "name",
  libelle: "name",
  "libellé": "name",

  // Description
  description: "description",
  desc: "description",
  "description longue": "description",
  "long description": "description",

  // Short description
  "description courte": "shortDescription",
  "short description": "shortDescription",
  resume: "shortDescription",
  "résumé": "shortDescription",

  // Price
  prix: "price",
  price: "price",
  tarif: "price",
  "prix ht": "price",
  "prix_ht": "price",
  prixht: "price",
  "price_ht": "price",
  "p.u.": "price",
  "prix unitaire": "price",
  "unit price": "price",

  // Brand
  marque: "brand",
  brand: "brand",
  fabricant: "brand",
  manufacturer: "brand",

  // Category
  categorie: "category",
  "catégorie": "category",
  category: "category",
  famille: "category",
  type: "category",

  // Specs
  puissance: "power",
  power: "power",
  moteur: "power",
  watt: "power",
  watts: "power",

  tension: "voltage",
  voltage: "voltage",
  volt: "voltage",
  volts: "voltage",

  batterie: "battery",
  battery: "battery",
  capacite: "battery",
  "capacité": "battery",
  ah: "battery",

  vitesse: "speed",
  speed: "speed",
  "vitesse max": "speed",
  "vitesse_max": "speed",
  "max speed": "speed",
  "v. max": "speed",

  poids: "weight",
  weight: "weight",
  masse: "weight",

  autonomie: "range",
  range: "range",
  "km": "range",
  portee: "range",
  "portée": "range",
};

// ─── CSV Parser ─────────────────────────────────────────────

function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs >= semicolons && tabs >= commas && tabs > 0) return "\t";
  if (semicolons >= commas) return ";";
  return ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    const row: CsvRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

function autoDetectMapping(headers: string[]): Record<string, FieldKey> {
  const mapping: Record<string, FieldKey> = {};
  for (const header of headers) {
    const normalized = header
      .toLowerCase()
      .trim()
      .replace(/[_\-.]/g, " ")
      .replace(/\s+/g, " ");

    // Exact match first
    if (AUTO_DETECT_MAP[normalized]) {
      mapping[header] = AUTO_DETECT_MAP[normalized];
      continue;
    }

    // Try without accents
    const noAccent = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (AUTO_DETECT_MAP[noAccent]) {
      mapping[header] = AUTO_DETECT_MAP[noAccent];
      continue;
    }

    // Partial match
    for (const [key, value] of Object.entries(AUTO_DETECT_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        mapping[header] = value;
        break;
      }
    }

    if (!mapping[header]) {
      mapping[header] = "__skip__";
    }
  }
  return mapping;
}

// ─── Steps ──────────────────────────────────────────────────

type Step = "upload" | "mapping" | "preview" | "importing" | "done";

// ─── Page Component ─────────────────────────────────────────

export default function AdminImportCsvPage() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, FieldKey>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ─── File handling ──────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|tsv|txt)$/i)) {
      setError("Format invalide. Veuillez utiliser un fichier .csv, .tsv ou .txt");
      return;
    }

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { headers: h, rows: r } = parseCsv(text);

        if (h.length === 0) {
          setError("Fichier vide ou format non reconnu.");
          return;
        }

        if (r.length === 0) {
          setError("Le fichier ne contient aucune ligne de donnees.");
          return;
        }

        setHeaders(h);
        setRawRows(r);
        setMapping(autoDetectMapping(h));
        setStep("mapping");
      } catch {
        setError("Erreur lors de la lecture du fichier CSV.");
      }
    };
    reader.onerror = () => {
      setError("Erreur lors de la lecture du fichier.");
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // ─── Mapping ────────────────────────────────────────────

  const updateMapping = (header: string, field: FieldKey) => {
    setMapping((prev) => ({ ...prev, [header]: field }));
  };

  const hasSku = Object.values(mapping).includes("sku");
  const hasName = Object.values(mapping).includes("name");
  const canProceed = hasSku && hasName;

  // ─── Build import rows ──────────────────────────────────

  const buildImportRows = useCallback((): ImportRow[] => {
    const reverseMap: Partial<Record<FieldKey, string>> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (field !== "__skip__") {
        reverseMap[field] = header;
      }
    }

    return rawRows
      .map((row) => {
        const sku = reverseMap.sku ? row[reverseMap.sku]?.trim() : "";
        const name = reverseMap.name ? row[reverseMap.name]?.trim() : "";
        if (!sku || !name) return null;

        const priceStr = reverseMap.price ? row[reverseMap.price]?.trim() : "";
        const price = priceStr
          ? parseFloat(priceStr.replace(/[^0-9.,]/g, "").replace(",", "."))
          : undefined;

        const specs: ImportRow["specs"] = {};
        let hasSpecs = false;
        for (const specKey of ["power", "voltage", "battery", "speed", "weight", "range"] as const) {
          const header = reverseMap[specKey];
          if (header && row[header]?.trim()) {
            specs[specKey] = row[header].trim();
            hasSpecs = true;
          }
        }

        const importRow: ImportRow = {
          sku,
          name,
          description: reverseMap.description ? row[reverseMap.description]?.trim() || undefined : undefined,
          shortDescription: reverseMap.shortDescription ? row[reverseMap.shortDescription]?.trim() || undefined : undefined,
          price: price && !isNaN(price) ? price : undefined,
          brand: reverseMap.brand ? row[reverseMap.brand]?.trim() || undefined : undefined,
          category: reverseMap.category ? row[reverseMap.category]?.trim() || undefined : undefined,
          specs: hasSpecs ? specs : undefined,
        };

        return importRow;
      })
      .filter((r): r is ImportRow => r !== null);
  }, [rawRows, mapping]);

  // ─── Import ─────────────────────────────────────────────

  const handleImport = async () => {
    const rows = buildImportRows();
    if (rows.length === 0) {
      setToast({ message: "Aucune ligne valide a importer", type: "error" });
      return;
    }

    setStep("importing");
    setImportProgress(0);
    setError(null);

    // Send in batches of 100 for better progress tracking
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < rows.length; i += batchSize) {
      batches.push(rows.slice(i, i + batchSize));
    }

    const totalResult: ImportResult = {
      matched: 0,
      created: 0,
      skipped: 0,
      errors: [],
    };

    try {
      for (let i = 0; i < batches.length; i++) {
        const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        const res = await fetch("/api/v1/admin/products/import-csv", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ rows: batches[i] }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(
            (errData as { error?: { message?: string } } | null)?.error?.message || `HTTP ${res.status}`,
          );
        }

        const data = (await res.json()) as { success: boolean; data: ImportResult };
        totalResult.matched += data.data.matched;
        totalResult.created += data.data.created;
        totalResult.skipped += data.data.skipped;
        totalResult.errors.push(...data.data.errors);

        setImportProgress(Math.round(((i + 1) / batches.length) * 100));
      }

      setResult(totalResult);
      setStep("done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(`Erreur lors de l'import : ${message}`);
      setStep("preview");
    }
  };

  // ─── Reset ──────────────────────────────────────────────

  const handleReset = () => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setImportProgress(0);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Render ─────────────────────────────────────────────

  const previewRows = step === "preview" || step === "mapping" ? rawRows.slice(0, 5) : [];

  return (
    <div className="relative max-w-5xl">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 font-mono text-sm font-bold transition-all",
            toast.type === "success"
              ? "bg-neon text-void"
              : "bg-danger text-white",
          )}
        >
          {toast.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {toast.message}
          <button
            onClick={() => setToast(null)}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="heading-lg">IMPORT CSV</h1>
        <p className="font-mono text-sm text-text-muted mt-0.5">
          Importer des produits depuis un fichier fournisseur (CSV, TSV)
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-mono text-sm text-danger">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-danger/60 hover:text-danger">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 font-mono text-xs uppercase tracking-wider">
        {(["upload", "mapping", "preview", "done"] as const).map(
          (s, idx) => {
            const labels = {
              upload: "1. Fichier",
              mapping: "2. Colonnes",
              preview: "3. Apercu",
              done: "4. Resultat",
            };
            const stepOrder = { upload: 0, mapping: 1, preview: 2, importing: 2, done: 3 };
            const currentOrder = stepOrder[step];
            const thisOrder = stepOrder[s];
            const isActive = currentOrder === thisOrder;
            const isDone = currentOrder > thisOrder;

            return (
              <div key={s} className="flex items-center gap-2">
                {idx > 0 && (
                  <ArrowRight
                    className={cn(
                      "h-3 w-3",
                      isDone ? "text-neon" : "text-text-dim",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "px-2.5 py-1 border transition-colors",
                    isActive
                      ? "border-neon text-neon bg-neon-dim"
                      : isDone
                        ? "border-neon/30 text-neon/70"
                        : "border-border text-text-dim",
                  )}
                >
                  {labels[s]}
                </span>
              </div>
            );
          },
        )}
      </div>

      {/* ─── STEP 1: Upload ─────────────────────────────── */}
      {step === "upload" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed p-16 flex flex-col items-center justify-center cursor-pointer transition-all",
            isDragging
              ? "border-neon bg-neon-dim"
              : "border-border hover:border-text-dim bg-surface",
          )}
        >
          <Upload
            className={cn(
              "h-12 w-12 mb-4",
              isDragging ? "text-neon" : "text-text-dim",
            )}
          />
          <p className="font-mono text-sm text-text mb-1">
            Glissez-deposez votre fichier CSV ici
          </p>
          <p className="font-mono text-xs text-text-dim">
            ou cliquez pour parcourir (CSV, TSV, TXT)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}

      {/* ─── STEP 2: Column Mapping ─────────────────────── */}
      {step === "mapping" && (
        <div>
          <div className="bg-surface border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-neon" />
                <div>
                  <p className="font-mono text-sm text-text font-bold">
                    {fileName}
                  </p>
                  <p className="font-mono text-xs text-text-dim">
                    {rawRows.length} ligne{rawRows.length > 1 ? "s" : ""} detectee{rawRows.length > 1 ? "s" : ""} &middot;{" "}
                    {headers.length} colonne{headers.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="font-mono text-xs text-text-dim hover:text-text transition"
              >
                Changer de fichier
              </button>
            </div>

            <p className="font-mono text-xs text-text-muted mb-4">
              Associez chaque colonne du fichier au champ correspondant.
              Les colonnes reconnues sont pre-remplies automatiquement.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {headers.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-text-muted w-40 truncate shrink-0" title={header}>
                    {header}
                  </span>
                  <ArrowRight className="h-3 w-3 text-text-dim shrink-0" />
                  <div className="relative flex-1">
                    <select
                      value={mapping[header] || "__skip__"}
                      onChange={(e) =>
                        updateMapping(header, e.target.value as FieldKey)
                      }
                      className={cn(
                        "input-dark w-full appearance-none pr-8 text-xs",
                        mapping[header] && mapping[header] !== "__skip__"
                          ? "border-neon/30 text-neon"
                          : "",
                      )}
                    >
                      {FIELD_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-dim pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>

            {!canProceed && (
              <div className="mt-4 bg-warning/10 border border-warning/30 px-4 py-3 font-mono text-xs text-warning">
                Vous devez mapper au minimum les champs <strong>SKU</strong> et <strong>Nom</strong> pour continuer.
              </div>
            )}
          </div>

          {/* Preview table in mapping step */}
          {previewRows.length > 0 && (
            <div className="bg-surface border border-border overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Table2 className="h-4 w-4 text-text-dim" />
                <span className="font-mono text-xs text-text-muted uppercase tracking-wider">
                  Apercu des 5 premieres lignes
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-2">
                      {headers.map((h) => (
                        <th
                          key={h}
                          className={cn(
                            "text-left px-3 py-2.5 spec-label whitespace-nowrap",
                            mapping[h] && mapping[h] !== "__skip__"
                              ? "text-neon"
                              : "",
                          )}
                        >
                          {h}
                          {mapping[h] && mapping[h] !== "__skip__" && (
                            <span className="block font-normal text-neon/60 text-[10px]">
                              {FIELD_OPTIONS.find((f) => f.key === mapping[h])?.label}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-surface-2/50">
                        {headers.map((h) => (
                          <td
                            key={h}
                            className="px-3 py-2 font-mono text-text-muted whitespace-nowrap max-w-[200px] truncate"
                          >
                            {row[h] || "\u2014"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="btn-outline px-4 py-2.5"
            >
              Retour
            </button>
            <button
              onClick={() => setStep("preview")}
              disabled={!canProceed}
              className="btn-neon px-6 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuer
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Preview ────────────────────────────── */}
      {step === "preview" && (
        <div>
          {(() => {
            const importRows = buildImportRows();
            const skippedCount = rawRows.length - importRows.length;

            return (
              <>
                <div className="bg-surface border border-border p-6 mb-6">
                  <h2 className="font-mono text-sm font-bold text-text mb-3 uppercase tracking-wider">
                    Resume de l&apos;import
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-void border border-border p-4">
                      <p className="font-mono text-2xl font-bold text-neon tabular-nums">
                        {importRows.length}
                      </p>
                      <p className="font-mono text-xs text-text-dim mt-1">
                        Lignes valides
                      </p>
                    </div>
                    <div className="bg-void border border-border p-4">
                      <p className="font-mono text-2xl font-bold text-warning tabular-nums">
                        {skippedCount}
                      </p>
                      <p className="font-mono text-xs text-text-dim mt-1">
                        Lignes ignorees (SKU ou nom manquant)
                      </p>
                    </div>
                    <div className="bg-void border border-border p-4">
                      <p className="font-mono text-2xl font-bold text-text tabular-nums">
                        {headers.filter((h) => mapping[h] && mapping[h] !== "__skip__").length}
                      </p>
                      <p className="font-mono text-xs text-text-dim mt-1">
                        Champs mappes
                      </p>
                    </div>
                  </div>
                </div>

                {/* Preview of mapped data */}
                <div className="bg-surface border border-border overflow-hidden mb-6">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-text-dim" />
                    <span className="font-mono text-xs text-text-muted uppercase tracking-wider">
                      Apercu des donnees mappees (5 premieres)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-surface-2">
                          <th className="text-left px-3 py-2.5 spec-label">SKU</th>
                          <th className="text-left px-3 py-2.5 spec-label">Nom</th>
                          <th className="text-right px-3 py-2.5 spec-label">Prix HT</th>
                          <th className="text-left px-3 py-2.5 spec-label">Marque</th>
                          <th className="text-left px-3 py-2.5 spec-label">Categorie</th>
                          <th className="text-left px-3 py-2.5 spec-label">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {importRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface-2/50">
                            <td className="px-3 py-2 font-mono text-neon">{row.sku}</td>
                            <td className="px-3 py-2 font-mono text-text max-w-[200px] truncate">
                              {row.name}
                            </td>
                            <td className="px-3 py-2 font-mono text-text text-right tabular-nums">
                              {row.price !== undefined ? `${row.price.toFixed(2)} \u20AC` : "\u2014"}
                            </td>
                            <td className="px-3 py-2 font-mono text-text-muted">
                              {row.brand || "\u2014"}
                            </td>
                            <td className="px-3 py-2 font-mono text-text-muted">
                              {row.category || "\u2014"}
                            </td>
                            <td className="px-3 py-2 font-mono text-text-dim max-w-[250px] truncate">
                              {row.description || (row.specs ? "(auto-gen)" : "\u2014")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep("mapping")}
                    className="btn-outline px-4 py-2.5"
                  >
                    Retour au mapping
                  </button>
                  <button
                    onClick={handleImport}
                    className="btn-neon px-8 py-2.5"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    IMPORTER {importRows.length} PRODUIT{importRows.length > 1 ? "S" : ""}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ─── STEP 3b: Importing (progress) ──────────────── */}
      {step === "importing" && (
        <div className="bg-surface border border-border p-12 flex flex-col items-center">
          <Loader2 className="h-10 w-10 text-neon animate-spin mb-6" />
          <p className="font-mono text-sm text-text mb-4">
            Import en cours...
          </p>
          <div className="w-full max-w-md">
            <div className="bg-void border border-border h-3 overflow-hidden">
              <div
                className="h-full bg-neon transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="font-mono text-xs text-text-dim mt-2 text-center tabular-nums">
              {importProgress}%
            </p>
          </div>
        </div>
      )}

      {/* ─── STEP 4: Results ────────────────────────────── */}
      {step === "done" && result && (
        <div>
          <div className="bg-surface border border-border p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center bg-neon">
                <Check className="h-5 w-5 text-void" />
              </div>
              <div>
                <h2 className="font-mono text-sm font-bold text-text uppercase tracking-wider">
                  Import termine
                </h2>
                <p className="font-mono text-xs text-text-dim">
                  {result.matched + result.created} produit{result.matched + result.created > 1 ? "s" : ""} traite{result.matched + result.created > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-void border border-border p-4">
                <p className="font-mono text-2xl font-bold text-neon tabular-nums">
                  {result.matched}
                </p>
                <p className="font-mono text-xs text-text-dim mt-1">
                  Mis a jour
                </p>
              </div>
              <div className="bg-void border border-border p-4">
                <p className="font-mono text-2xl font-bold text-neon tabular-nums">
                  {result.created}
                </p>
                <p className="font-mono text-xs text-text-dim mt-1">
                  Crees (DRAFT)
                </p>
              </div>
              <div className="bg-void border border-border p-4">
                <p className="font-mono text-2xl font-bold text-text-muted tabular-nums">
                  {result.skipped}
                </p>
                <p className="font-mono text-xs text-text-dim mt-1">
                  Ignores
                </p>
              </div>
              <div className="bg-void border border-border p-4">
                <p
                  className={cn(
                    "font-mono text-2xl font-bold tabular-nums",
                    result.errors.length > 0 ? "text-danger" : "text-text-muted",
                  )}
                >
                  {result.errors.length}
                </p>
                <p className="font-mono text-xs text-text-dim mt-1">
                  Erreurs
                </p>
              </div>
            </div>
          </div>

          {/* Error details */}
          {result.errors.length > 0 && (
            <div className="bg-danger/5 border border-danger/20 p-4 mb-6">
              <h3 className="font-mono text-xs font-bold text-danger uppercase tracking-wider mb-3">
                Details des erreurs
              </h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 font-mono text-xs"
                  >
                    <span className="text-danger font-bold shrink-0">
                      {err.sku}
                    </span>
                    <span className="text-text-dim">{err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleReset} className="btn-neon px-6 py-2.5">
            Nouvel import
          </button>
        </div>
      )}
    </div>
  );
}
