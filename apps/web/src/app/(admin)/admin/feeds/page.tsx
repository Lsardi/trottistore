"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Rss } from "lucide-react";

// The feeds live at /api/v1/merchant/* on the ecommerce service. Via the
// web's Next.js rewrites, they're publicly reachable at /api/v1/merchant/*
// on the web domain — which is what we show here (single source of truth,
// matches what Google/Back Market will actually hit).

type FeedSummary = {
  key: string;
  label: string;
  description: string;
  path: string;
  status: "ready" | "coming";
  platform: string;
};

const FEEDS: FeedSummary[] = [
  {
    key: "google-shopping",
    label: "Google Shopping",
    description: "Feed XML produits actifs avec stock, prix TTC, image primaire. Conforme spec Merchant Center.",
    path: "/api/v1/merchant/feed",
    status: "ready",
    platform: "Google",
  },
  {
    key: "google-local-inventory",
    label: "Google Local Inventory (pickup)",
    description: "Disponibilité en boutique pour le Pickup Today de Google.",
    path: "/api/v1/merchant/local-inventory",
    status: "ready",
    platform: "Google",
  },
  {
    key: "back-market",
    label: "Back Market",
    description: "Feed reconditionné / occasion. Nécessite un compte Back Market + mapping attributs spécifiques.",
    path: "",
    status: "coming",
    platform: "Back Market",
  },
  {
    key: "leboncoin",
    label: "Leboncoin Pro",
    description: "Catalogue pro pour annonces automatisées.",
    path: "",
    status: "coming",
    platform: "Leboncoin",
  },
];

function absUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export default function AdminFeedsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [feedSize, setFeedSize] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const res = await fetch("/api/v1/merchant/feed");
        if (!res.ok) return;
        const body = await res.text();
        if (cancelled) return;
        const itemMatches = body.match(/<item>/g);
        setProductCount(itemMatches ? itemMatches.length : null);
        setFeedSize(body.length);
      } catch {
        // ignore
      }
    }
    void ping();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy(key: string, path: string) {
    const url = absUrl(path);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-lg">FEEDS MARKETPLACES</h1>
        <p className="font-mono text-sm text-text-muted mt-1">
          Diffusion du catalogue vers les canaux tiers · URL publiques, mises à jour en temps réel.
        </p>
      </div>

      {productCount != null ? (
        <div className="bg-surface border border-border p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="spec-label mb-1">PRODUITS DANS LE FEED</p>
            <p className="font-display text-2xl text-neon">{productCount}</p>
          </div>
          <div>
            <p className="spec-label mb-1">TAILLE</p>
            <p className="font-display text-2xl text-neon">
              {feedSize ? `${(feedSize / 1024).toFixed(1)} kB` : "—"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {FEEDS.map((feed) => (
          <div
            key={feed.key}
            className="bg-surface border border-border p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="shrink-0 mt-1">
                  <Rss className="h-4 w-4 text-neon" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display font-bold text-text">{feed.label}</h2>
                    <span className="font-mono text-[10px] text-text-dim uppercase tracking-wider">
                      {feed.platform}
                    </span>
                    {feed.status === "ready" ? (
                      <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-neon/40 bg-neon-dim text-neon">
                        En ligne
                      </span>
                    ) : (
                      <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border bg-surface-2 text-text-dim">
                        À venir
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-text-muted mt-1">{feed.description}</p>
                </div>
              </div>
            </div>

            {feed.status === "ready" ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-[11px] text-text bg-surface-2 border border-border px-3 py-1.5 truncate">
                  {absUrl(feed.path)}
                </code>
                <button
                  type="button"
                  onClick={() => void copy(feed.key, feed.path)}
                  className="btn-outline p-2 inline-flex items-center gap-1 font-mono text-[11px]"
                  title="Copier l'URL"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedKey === feed.key ? "Copié" : "Copier"}
                </button>
                <a
                  href={feed.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline p-2"
                  title="Ouvrir le feed"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border p-4">
        <p className="spec-label mb-2">COMMENT BRANCHER GOOGLE SHOPPING</p>
        <ol className="font-mono text-xs text-text-muted list-decimal pl-5 space-y-1">
          <li>
            Va sur{" "}
            <a
              href="https://merchants.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon underline"
            >
              Google Merchant Center
            </a>
          </li>
          <li>Onglet Produits → Feeds → +</li>
          <li>Type : Planifié · Fréquence : quotidien</li>
          <li>Colle l&apos;URL du feed Google Shopping ci-dessus</li>
          <li>Google récupère automatiquement les changements de stock et de prix</li>
        </ol>
      </div>
    </div>
  );
}
