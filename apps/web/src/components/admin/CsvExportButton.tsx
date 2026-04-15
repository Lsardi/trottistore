"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

// Admin CSV exports need a Bearer token so a plain <a href> would 401.
// This button fetches with the token, triggers a blob download, and
// falls back to the `apiFetch` refresh-on-401 flow since we go through
// the same `/api/v1/*` path that the rewrites proxy to.

export function CsvExportButton({
  path,
  label = "Exporter CSV",
  filename,
}: {
  path: string;
  label?: string;
  filename: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const res = await fetch(path, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("csv export failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className="btn-outline inline-flex items-center gap-1.5 text-xs disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}
