import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: `Guides & Conseils | ${brand.name}`,
  description:
    "Guides pratiques pour entretenir, choisir et dépanner votre trottinette électrique. Par les techniciens TrottiStore.",
};

const GUIDES = [
  {
    slug: "entretien-trottinette",
    title: "Guide complet d'entretien de votre trottinette électrique",
    description:
      "Les contrôles essentiels pour prolonger la durée de vie de votre trottinette et éviter les pannes coûteuses.",
  },
  {
    slug: "choisir-trottinette",
    title: "Comment choisir sa trottinette électrique en 2026",
    description:
      "Budget, autonomie, puissance, poids : les critères qui comptent vraiment pour trouver le modèle adapté.",
  },
  {
    slug: "panne-trottinette",
    title: "Panne de trottinette : que faire ? Guide de premiers secours",
    description:
      "Les gestes immédiats quand votre trottinette refuse de démarrer, freine mal ou affiche une erreur.",
  },
];

export default function GuidesIndexPage() {
  return (
    <main className="mx-auto px-4 sm:px-6 lg:px-8 py-12" style={{ maxWidth: 900 }}>
      <h1 className="heading-xl mb-2">GUIDES & CONSEILS</h1>
      <p
        className="font-mono mb-10"
        style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}
      >
        Par les techniciens {brand.name} — pour rouler plus longtemps, mieux, et en sécurité.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guide/${guide.slug}`}
            style={{
              display: "block",
              padding: 24,
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              transition: "border-color 200ms",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <BookOpen
                style={{
                  width: 24,
                  height: 24,
                  color: "var(--color-neon)",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <div>
                <h2
                  className="font-display"
                  style={{
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "var(--color-text)",
                    marginBottom: 6,
                  }}
                >
                  {guide.title}
                </h2>
                <p
                  className="font-mono"
                  style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}
                >
                  {guide.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="divider my-10" />

      <div style={{ textAlign: "center" }}>
        <p
          className="font-mono mb-4"
          style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}
        >
          Besoin d&apos;aide personnalisée ?
        </p>
        <Link href="/diagnostic" className="btn-neon">
          LANCER UN DIAGNOSTIC
        </Link>
      </div>
    </main>
  );
}
