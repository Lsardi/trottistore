"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cookie-consent";

type ConsentPreferences = {
  essentials: true;
  analytics: boolean;
  timestamp: string;
};

function saveConsent(consent: ConsentPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setVisible(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
      const valid = parsed.essentials === true && typeof parsed.analytics === "boolean" && typeof parsed.timestamp === "string";
      if (!valid) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function acceptAll() {
    saveConsent({
      essentials: true,
      analytics: true,
      timestamp: new Date().toISOString(),
    });
    setVisible(false);
  }

  function rejectAll() {
    saveConsent({
      essentials: true,
      analytics: false,
      timestamp: new Date().toISOString(),
    });
    setVisible(false);
  }

  function saveCustom() {
    saveConsent({
      essentials: true,
      analytics: analyticsEnabled,
      timestamp: new Date().toISOString(),
    });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      className="fixed bottom-0 left-0 right-0 md:bottom-3 md:left-6 md:right-6 z-[110]"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label="Préférences cookies"
    >
      <div className="mx-auto max-w-5xl border border-border bg-surface/95 backdrop-blur-sm p-3 md:p-5 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <p className="font-mono text-[10px] md:text-xs text-text-muted leading-relaxed mb-2">
          Cookies essentiels + analytics (optionnels).{" "}
          <Link href="/cookies" className="underline text-text">
            Voir la politique cookies
          </Link>
          .
        </p>

        {customizing ? (
          <div className="mt-4 border border-border p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-text">Essentiels</p>
                <p className="font-mono text-[11px] text-text-dim">Toujours actifs (connexion, sécurité, panier).</p>
              </div>
              <input type="checkbox" checked disabled aria-label="Cookies essentiels activés" />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-text">Analytics</p>
                <p className="font-mono text-[11px] text-text-dim">Mesure d'audience et amélioration du site.</p>
              </div>
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                aria-label="Activer les cookies analytics"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button type="button" className="btn-outline" onClick={() => setCustomizing(false)}>
                ANNULER
              </button>
              <button type="button" className="btn-neon" onClick={saveCustom}>
                ENREGISTRER MES CHOIX
              </button>
            </div>
          </div>
        ) : null}

        {!customizing ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-neon flex-1 min-w-[120px] py-2 text-xs" onClick={acceptAll}>
              ACCEPTER
            </button>
            <button type="button" className="btn-outline flex-1 min-w-[120px] py-2 text-xs" onClick={rejectAll}>
              REFUSER
            </button>
            <button type="button" className="font-mono text-[10px] text-text-dim underline" onClick={() => setCustomizing(true)}>
              Personnaliser
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
