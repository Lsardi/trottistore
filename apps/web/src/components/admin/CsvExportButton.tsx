"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

// Admin CSV exports are authenticated via the httpOnly access_token cookie
// (sent automatically with credentials:"include"), so a plain <a href> would
// work too — but we fetch as a blob to control the download filename.

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
      const res = await fetch(path, {
        credentials: "include",
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
