import Link from "next/link";

const NAV_LINKS = [
  { label: "Trottinettes", href: "/produits?categorySlug=trottinettes-electriques" },
  { label: "Pièces détachées", href: "/produits?categorySlug=pieces-detachees" },
  { label: "Catalogue", href: "/produits" },
  { label: "Mon compte", href: "/mon-compte" },
];

const SERVICE_LINKS = [
  { label: "Réparation SAV", href: "/reparation" },
  { label: "Diagnostic", href: "/diagnostic" },
  { label: "Compatibilité", href: "/compatibilite" },
  { label: "Suivi commande", href: "/mon-compte" },
];

export default function Footer() {
  return (
    <footer style={{ backgroundColor: "#0A0A0A" }}>
      {/* Neon divider at top */}
      <div className="divider-neon" />

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "48px 24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 32,
          }}
          className="footer-grid"
        >
          {/* Col 1: Logo */}
          <div>
            <div style={{ marginBottom: 16 }}>
              <span
                className="font-display"
                style={{ fontWeight: 800, fontSize: "1.1rem" }}
              >
                <span style={{ color: "#00FFD1" }}>TROTTI</span>
                <span style={{ color: "#E8E8E8" }}>STORE</span>
              </span>
            </div>
            <p
              className="font-mono"
              style={{
                fontSize: "0.7rem",
                color: "#555",
                lineHeight: 1.6,
                fontStyle: "italic",
                maxWidth: 240,
              }}
            >
              Spécialiste trottinettes électriques depuis 2019
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4
              className="spec-label"
              style={{ marginBottom: 16 }}
            >
              NAVIGATION
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {NAV_LINKS.map((link) => (
                <li key={link.href} style={{ marginBottom: 10 }}>
                  <Link
                    href={link.href}
                    className="font-mono footer-link"
                    style={{
                      fontSize: "0.75rem",
                      color: "#888",
                      textDecoration: "none",
                      transition: "color 150ms",
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Services */}
          <div>
            <h4
              className="spec-label"
              style={{ marginBottom: 16 }}
            >
              SERVICES
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {SERVICE_LINKS.map((link) => (
                <li key={link.href + link.label} style={{ marginBottom: 10 }}>
                  <Link
                    href={link.href}
                    className="font-mono footer-link"
                    style={{
                      fontSize: "0.75rem",
                      color: "#888",
                      textDecoration: "none",
                      transition: "color 150ms",
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Atelier */}
          <div>
            <h4
              className="spec-label"
              style={{ marginBottom: 16 }}
            >
              ATELIER
            </h4>
            <div className="font-mono" style={{ fontSize: "0.75rem", color: "#888", lineHeight: 1.7 }}>
              <p style={{ margin: "0 0 8px" }}>
                18 bis Rue Mechin
                <br />
                93450 L&apos;Île-Saint-Denis
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <a href="tel:+33604463055" style={{ color: "#888", textDecoration: "none" }}>
                  06 04 46 30 55
                </a>
              </p>
              <p style={{ margin: 0 }}>
                <a href="mailto:contact@trottistore.fr" style={{ color: "#888", textDecoration: "none" }}>
                  contact@trottistore.fr
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: "1px solid #2A2A2A",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span
            className="font-mono"
            style={{ fontSize: "0.65rem", color: "#555", letterSpacing: "0.06em" }}
          >
            &copy; 2026 TROTTISTORE
          </span>
          <span
            className="font-mono"
            style={{ fontSize: "0.65rem", color: "#555" }}
          >
            CB &middot; APPLE PAY &middot; GOOGLE PAY &middot; VIREMENT &middot; 2X 3X 4X SANS FRAIS
          </span>
        </div>
      </div>

    </footer>
  );
}
