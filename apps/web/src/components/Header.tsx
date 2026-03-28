"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ShoppingCart, User, Menu, X } from "lucide-react";
import { brand } from "@/lib/brand";

const NAV_ITEMS = [
  { label: brand.nav.mainCategory, href: `/produits?categorySlug=${brand.nav.mainCategorySlug}` },
  { label: brand.nav.parts, href: `/produits?categorySlug=${brand.nav.partsSlug}` },
  { label: brand.nav.repair, href: "/reparation" },
  { label: brand.nav.diagnostic, href: "/diagnostic" },
  { label: brand.nav.compatibility, href: "/compatibilite" },
] as const;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const cartCount = 0;

  return (
    <header>
      {/* ── Top Strip ── */}
      <div
        className="hidden md:block"
        style={{
          height: 32,
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 24px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-text-dim)",
            }}
          >
            {brand.domain.toUpperCase()}
          </span>
          <div
            className="font-mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.65rem",
              letterSpacing: "0.06em",
            }}
          >
            <a href={`tel:${brand.phoneIntl}`} style={{ color: "var(--color-text-muted)" }}>
              {brand.phone}
            </a>
            <span style={{ color: "var(--color-border-light)" }}>&middot;</span>
            <span style={{ color: "var(--color-text-dim)", textTransform: "uppercase" }}>
              {brand.address.cityShort}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Bar ── */}
      <div
        style={{
          height: 56,
          backgroundColor: "var(--color-void)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 24px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Left: Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <span
              style={{
                width: 6,
                height: 6,
                backgroundColor: "var(--color-neon)",
                display: "inline-block",
                boxShadow: "0 0 8px var(--color-neon-glow, rgba(0,255,209,0.6))",
              }}
            />
            <span
              className="font-display"
              style={{
                fontWeight: 800,
                fontSize: "1.3rem",
                letterSpacing: "-0.02em",
              }}
            >
              <span style={{ color: "var(--color-neon)" }}>{brand.nameParts[0]}</span>
              <span style={{ color: "var(--color-text)" }}>{brand.nameParts[1]}</span>
            </span>
          </Link>

          {/* Right: Icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Link
              href="/produits"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                color: "var(--color-text-muted)",
                transition: "color 150ms",
              }}
              className="header-icon"
              aria-label="Rechercher"
            >
              <Search style={{ width: 18, height: 18 }} />
            </Link>

            <Link
              href="/panier"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                color: "var(--color-text-muted)",
                transition: "color 150ms",
                position: "relative",
              }}
              className="header-icon"
              aria-label="Panier"
            >
              <ShoppingCart style={{ width: 18, height: 18 }} />
              {cartCount > 0 && (
                <span
                  className="font-mono"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 2,
                    width: 16,
                    height: 16,
                    backgroundColor: "var(--color-neon)",
                    color: "var(--color-void)",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {cartCount}
                </span>
              )}
            </Link>

            <Link
              href="/mon-compte"
              className="header-icon"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                color: "var(--color-text-muted)",
                transition: "color 150ms",
              }}
              aria-label="Mon compte"
            >
              <User style={{ width: 18, height: 18 }} />
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                color: "var(--color-text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {menuOpen ? (
                <X style={{ width: 18, height: 18 }} />
              ) : (
                <Menu style={{ width: 18, height: 18 }} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Nav Bar (Desktop) ── */}
      <nav
        className="hidden lg:block"
        style={{
          backgroundColor: "var(--color-void)",
          borderTop: "1px solid var(--color-border)",
          padding: "10px 0",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            gap: 0,
          }}
        >
          {NAV_ITEMS.map((item, i) => (
            <span key={item.label} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && (
                <span
                  className="font-mono"
                  style={{ color: "var(--color-border-light)", margin: "0 16px", fontSize: "0.7rem" }}
                >
                  &middot;
                </span>
              )}
              <Link
                href={item.href}
                className="font-mono nav-link"
                style={{
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--color-text-dim)",
                  textDecoration: "none",
                  transition: "color 150ms",
                }}
              >
                {item.label}
              </Link>
            </span>
          ))}
        </div>
      </nav>

      {/* ── Mobile Panel ── */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            maxWidth: 320,
            backgroundColor: "var(--color-void)",
            borderLeft: "1px solid var(--color-border)",
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Close */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <span
              className="font-display"
              style={{ fontWeight: 800, fontSize: "1rem" }}
            >
              <span style={{ color: "var(--color-neon)" }}>{brand.nameParts[0]}</span>
              <span style={{ color: "var(--color-text)" }}>{brand.nameParts[1]}</span>
            </span>
            <button
              onClick={() => setMenuOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                background: "none",
                border: "none",
                color: "var(--color-text-muted)",
                cursor: "pointer",
              }}
              aria-label="Fermer"
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Nav items */}
          <nav style={{ padding: "20px 0", flex: 1 }}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="font-mono"
                style={{
                  display: "block",
                  padding: "14px 20px",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--color-text-muted)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--color-surface-2)",
                  transition: "color 150ms",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile bottom info */}
          <div
            className="font-mono"
            style={{
              padding: "20px",
              borderTop: "1px solid var(--color-border)",
              fontSize: "0.65rem",
              color: "var(--color-text-dim)",
            }}
          >
            <a
              href={`tel:${brand.phoneIntl}`}
              style={{ color: "var(--color-text-muted)", display: "block", marginBottom: 8 }}
            >
              {brand.phone}
            </a>
            <span>{brand.address.cityShort}</span>
          </div>
        </div>
      )}

      {/* Mobile overlay */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            zIndex: 199,
          }}
        />
      )}

    </header>
  );
}
