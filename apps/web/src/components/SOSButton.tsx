"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Phone, Wrench, MapPin, X, Zap } from "lucide-react";
import { brand } from "@/lib/brand";
import { getStoreStatusLabel, isStoreOpen, GOOGLE_MAPS_DIR_URL, WAZE_DIR_URL } from "@/lib/storefront";

export default function SOSButton() {
  const [open, setOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setShopOpen(isStoreOpen());
  }, []);

  // Fermer le menu quand on change de page
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Ne pas afficher sur les pages admin
  if (pathname?.startsWith("/admin")) return null;

  // CTA contextuel selon la page
  const isDiagnosticPage = pathname === "/diagnostic";
  const isRepairPage = pathname === "/reparation";

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 998,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Menu d'actions */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 88,
            right: 16,
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          {/* Appeler */}
          <a
            href={`tel:${brand.phoneIntl}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              backgroundColor: "var(--color-neon)",
              color: "var(--color-void)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              textDecoration: "none",
              borderRadius: "var(--radius-md)",
              animation: "slide-up 0.2s ease forwards",
            }}
          >
            <Phone style={{ width: 16, height: 16 }} />
            <span>
              APPELER{" "}
              <span
                style={{
                  fontSize: "0.65rem",
                  opacity: 0.8,
                  marginLeft: 4,
                }}
              >
                {shopOpen ? "OUVERT" : "FERMÉ"}
              </span>
            </span>
          </a>

          {!shopOpen && (
            <a
              href="/urgence#urgent-form"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text)",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textDecoration: "none",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                animation: "slide-up 0.22s ease forwards",
              }}
            >
              <Phone style={{ width: 16, height: 16, color: "var(--color-neon)" }} />
              ÊTRE RAPPELÉ
            </a>
          )}

          {/* Diagnostic — ne pas afficher si déjà sur la page */}
          {!isDiagnosticPage && (
            <a
              href="/diagnostic"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text)",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textDecoration: "none",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                animation: "slide-up 0.25s ease forwards",
              }}
            >
              <Zap style={{ width: 16, height: 16, color: "var(--color-neon)" }} />
              DIAGNOSTIC RAPIDE
            </a>
          )}

          {/* Déposer ticket — ne pas afficher si déjà sur la page */}
          {!isRepairPage && (
            <a
              href="/reparation"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text)",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textDecoration: "none",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                animation: "slide-up 0.3s ease forwards",
              }}
            >
              <Wrench style={{ width: 16, height: 16, color: "var(--color-neon)" }} />
              DÉPOSER UN TICKET SAV
            </a>
          )}

          {/* Itinéraire */}
          <a
            href={GOOGLE_MAPS_DIR_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              textDecoration: "none",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              animation: "slide-up 0.35s ease forwards",
            }}
          >
            <MapPin style={{ width: 16, height: 16, color: "var(--color-neon)" }} />
            Y ALLER — {brand.address.cityShort}
          </a>

          <a
            href={WAZE_DIR_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              textDecoration: "none",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              animation: "slide-up 0.4s ease forwards",
            }}
          >
            <MapPin style={{ width: 16, height: 16, color: "var(--color-neon)" }} />
            OUVRIR WAZE
          </a>
        </div>
      )}

      {/* Bouton SOS principal */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fermer le menu SOS" : "SOS Trottinette — Aide rapide"}
        style={{
          position: "fixed",
          bottom: 20,
          right: 16,
          zIndex: 999,
          width: open ? 48 : "auto",
          height: 48,
          padding: open ? 0 : "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: open ? "var(--color-surface-2)" : "var(--color-neon)",
          color: open ? "var(--color-text)" : "var(--color-void)",
          border: open ? "1px solid var(--color-border)" : "none",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "0.8rem",
          letterSpacing: "0.05em",
          boxShadow: open
            ? "none"
            : "0 0 20px rgba(0, 255, 209, 0.3), 0 4px 12px rgba(0,0,0,0.3)",
          transition: "all 200ms ease",
        }}
      >
        {open ? (
          <X style={{ width: 20, height: 20 }} />
        ) : (
          <>
            <Wrench style={{ width: 18, height: 18 }} />
            <span>SOS</span>
            <span style={{ fontSize: "0.62rem", opacity: 0.8 }}>{getStoreStatusLabel()}</span>
          </>
        )}
      </button>
    </>
  );
}
