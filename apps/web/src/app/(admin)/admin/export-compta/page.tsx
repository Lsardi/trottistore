"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Loader2, Users, Package, ShoppingCart } from "lucide-react";

const EXPORTS = [
  {
    icon: ShoppingCart,
    title: "Commandes",
    description: "Toutes les commandes avec statut, montants HT/TTC, client, méthode de paiement.",
    endpoint: "/api/v1/admin/exports/orders.csv",
    filename: "commandes.csv",
  },
  {
    icon: Package,
    title: "Produits",
    description: "Catalogue complet : nom, SKU, prix HT, TVA, stock, catégorie, marque.",
    endpoint: "/api/v1/admin/exports/products.csv",
    filename: "produits.csv",
  },
  {
    icon: Users,
    title: "Clients",
    description: "Liste clients : email, nom, téléphone, tier fidélité, total dépensé, nombre de commandes.",
    endpoint: "/api/v1/admin/exports/customers.csv",
    filename: "clients.csv",
  },
];

export default function AdminExportComptaPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(endpoint: string, filename: string) {
    setDownloading(endpoint);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="heading-lg">EXPORT COMPTABLE</h1>
        <p className="font-mono text-sm text-text-muted mt-1">
          Téléchargez les données au format CSV pour votre comptabilité.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {EXPORTS.map((exp) => {
          const Icon = exp.icon;
          const isLoading = downloading === exp.endpoint;
          return (
            <div key={exp.endpoint} className="bg-surface border border-border p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 flex items-center justify-center bg-void border border-border">
                  <Icon className="w-5 h-5 text-neon" />
                </div>
                <h2 className="font-display font-bold text-text">{exp.title}</h2>
              </div>

              <p className="font-mono text-xs text-text-muted mb-6 flex-1 leading-relaxed">
                {exp.description}
              </p>

              <button
                onClick={() => handleDownload(exp.endpoint, exp.filename)}
                disabled={isLoading}
                className="btn-neon w-full disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Téléchargement...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    TÉLÉCHARGER CSV
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-surface border border-border p-5">
        <div className="flex items-center gap-3 mb-3">
          <FileSpreadsheet className="w-5 h-5 text-text-dim" />
          <p className="spec-label">FORMAT</p>
        </div>
        <ul className="font-mono text-xs text-text-muted space-y-2">
          <li>• Format CSV (séparateur point-virgule) compatible Excel, Google Sheets, Sage, Pennylane</li>
          <li>• Encodage UTF-8 avec BOM pour les accents</li>
          <li>• Montants en euros, 2 décimales</li>
          <li>• Dates au format JJ/MM/AAAA</li>
        </ul>
      </div>
    </div>
  );
}
