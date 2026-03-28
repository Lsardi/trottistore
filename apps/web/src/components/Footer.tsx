import Link from "next/link";
import { brand } from "@/lib/brand";

const NAV_LINKS = [
  { label: brand.nav.mainCategory, href: `/produits?categorySlug=${brand.nav.mainCategorySlug}` },
  { label: brand.nav.parts, href: `/produits?categorySlug=${brand.nav.partsSlug}` },
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
    <footer style={{ backgroundColor: "var(--color-void)" }}>
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
                <span style={{ color: "var(--color-neon)" }}>{brand.nameParts[0]}</span>
                <span style={{ color: "var(--color-text)" }}>{brand.nameParts[1]}</span>
              </span>
            </div>
            <p
              className="font-mono"
              style={{
                fontSize: "0.7rem",
                color: "var(--color-text-dim)",
                lineHeight: 1.6,
                fontStyle: "italic",
                maxWidth: 240,
              }}
            >
              {brand.footerTagline}
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
                      color: "var(--color-text-muted)",
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
                      color: "var(--color-text-muted)",
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
            <div className="font-mono" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.7 }}>
              <p style={{ margin: "0 0 8px" }}>
                {brand.address.street}
                <br />
                {brand.address.postalCode} {brand.address.city}
              </p>
              <p style={{ margin: "0 0 4px" }}>
                <a href={`tel:${brand.phoneIntl}`} style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>
                  {brand.phone}
                </a>
              </p>
              <p style={{ margin: 0 }}>
                <a href={`mailto:${brand.email}`} style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>
                  {brand.email}
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
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span
            className="font-mono"
            style={{ fontSize: "0.65rem", color: "var(--color-text-dim)", letterSpacing: "0.06em" }}
          >
            &copy; {new Date().getFullYear()} {brand.name}
          </span>
          <span
            className="font-mono"
            style={{ fontSize: "0.65rem", color: "var(--color-text-dim)" }}
          >
            CB &middot; APPLE PAY &middot; GOOGLE PAY &middot; VIREMENT &middot; 2X 3X 4X SANS FRAIS
          </span>
        </div>
      </div>

    </footer>
  );
}
