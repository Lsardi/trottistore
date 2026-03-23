"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ShoppingCart, User, Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { label: "TROTTINETTES", href: "/produits?categorySlug=trottinettes-electriques" },
  { label: "PIÈCES", href: "/produits?categorySlug=pieces-detachees" },
  { label: "SAV", href: "/reparation" },
  { label: "DIAGNOSTIC", href: "/diagnostic" },
  { label: "COMPATIBILITÉ", href: "/compatibilite" },
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
          backgroundColor: "#141414",
          borderBottom: "1px solid #2A2A2A",
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
              color: "#555",
            }}
          >
            TROTTISTORE.FR
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
            <a href="tel:+33604463055" style={{ color: "#888" }}>
              06 04 46 30 55
            </a>
            <span style={{ color: "#333" }}>&middot;</span>
            <span style={{ color: "#555", textTransform: "uppercase" }}>
              L&apos;ÎLE-SAINT-DENIS
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Bar ── */}
      <div
        style={{
          height: 56,
          backgroundColor: "#0A0A0A",
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
                backgroundColor: "#00FFD1",
                display: "inline-block",
                boxShadow: "0 0 8px rgba(0,255,209,0.6)",
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
              <span style={{ color: "#00FFD1" }}>TROTTI</span>
              <span style={{ color: "#E8E8E8" }}>STORE</span>
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
                color: "#888",
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
                color: "#888",
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
                    backgroundColor: "#00FFD1",
                    color: "#0A0A0A",
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
                color: "#888",
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
                color: "#888",
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
          backgroundColor: "#0A0A0A",
          borderTop: "1px solid #2A2A2A",
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
                  style={{ color: "#333", margin: "0 16px", fontSize: "0.7rem" }}
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
                  color: "#555",
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
            backgroundColor: "#0A0A0A",
            borderLeft: "1px solid #2A2A2A",
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
              borderBottom: "1px solid #2A2A2A",
            }}
          >
            <span
              className="font-display"
              style={{ fontWeight: 800, fontSize: "1rem" }}
            >
              <span style={{ color: "#00FFD1" }}>TROTTI</span>
              <span style={{ color: "#E8E8E8" }}>STORE</span>
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
                color: "#888",
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
                  color: "#888",
                  textDecoration: "none",
                  borderBottom: "1px solid #1C1C1C",
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
              borderTop: "1px solid #2A2A2A",
              fontSize: "0.65rem",
              color: "#555",
            }}
          >
            <a
              href="tel:+33604463055"
              style={{ color: "#888", display: "block", marginBottom: 8 }}
            >
              06 04 46 30 55
            </a>
            <span>L&apos;ÎLE-SAINT-DENIS</span>
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
