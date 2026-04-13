import Link from "next/link";
import { brand } from "@/lib/brand";
import { GOOGLE_MAPS_DIR_URL, WAZE_DIR_URL } from "@/lib/storefront";

const NAV_LINKS = [
  { label: brand.nav.mainCategory, href: `/produits?categorySlug=${brand.nav.mainCategorySlug}` },
  { label: brand.nav.parts, href: `/produits?categorySlug=${brand.nav.partsSlug}` },
  { label: "Catalogue", href: "/produits" },
  { label: "Quiz", href: "/quiz" },
  { label: "Mon compte", href: "/mon-compte" },
  { label: "Suivi commande", href: "/mon-compte" },
  { label: "Livraison & Retours", href: "/livraison" },
  { label: "FAQ", href: "/faq" },
];

const SERVICE_LINKS = [
  { label: "SOS Urgence", href: "/urgence" },
  { label: "Réparation SAV", href: "/reparation" },
  { label: "Atelier", href: "/atelier" },
  { label: "Diagnostic", href: "/diagnostic" },
  { label: "Compatibilité", href: "/compatibilite" },
  { label: "Guides", href: "/guide" },
  { label: "Avis clients", href: "/avis" },
  { label: "Offre Pro", href: "/pro" },
];

const LEGAL_LINKS = [
  { label: "À propos", href: "/a-propos" },
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "CGV", href: "/cgv" },
  { label: "Confidentialité", href: "/politique-confidentialite" },
  { label: "Cookies", href: "/cookies" },
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
          padding: "36px 24px 24px",
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
                <li key={link.href + link.label} style={{ marginBottom: 7 }}>
                  <Link
                    href={link.href}
                    className="font-mono footer-link"
                    style={{
                      fontSize: "0.72rem",
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
                <li key={link.href + link.label} style={{ marginBottom: 7 }}>
                  <Link
                    href={link.href}
                    className="font-mono footer-link"
                    style={{
                      fontSize: "0.72rem",
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
              <p style={{ margin: "8px 0 0" }}>
                <a
                  href={GOOGLE_MAPS_DIR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
                >
                  Itinéraire Google Maps
                </a>
              </p>
              <p style={{ margin: "4px 0 0" }}>
                <a
                  href={WAZE_DIR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
                >
                  Ouvrir Waze
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div
            className="font-mono"
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              fontSize: "0.68rem",
              color: "var(--color-text-dim)",
              letterSpacing: "0.06em",
            }}
          >
            <span>&copy; {new Date().getFullYear()} {brand.name}</span>
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="footer-link"
                style={{ color: "var(--color-text-dim)", textDecoration: "none" }}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: "0.68rem",
              color: "var(--color-text-dim)",
              letterSpacing: "0.06em",
            }}
          >
            CB &middot; APPLE PAY &middot; GOOGLE PAY &middot; VIREMENT
          </span>
        </div>
      </div>

    </footer>
  );
}
