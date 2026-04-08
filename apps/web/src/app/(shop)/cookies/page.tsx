import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Cookies | ${brand.name}`,
  description: `Information cookies de ${brand.name}`,
};

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <h1 className="heading-lg">POLITIQUE COOKIES</h1>

      <section className="space-y-2">
        <p className="spec-label">Cookies utilises</p>
        <div className="font-mono text-sm text-text-muted space-y-2">
          <p>
            <span className="text-text">refresh_token</span> (JWT)
            <br />
            Finalité : maintien de session et authentification utilisateur.
            <br />
            Durée : selon la durée de vie du jeton configurée serveur.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Gestion des cookies</p>
        <p className="font-mono text-sm text-text-muted">
          Vous pouvez configurer votre navigateur pour bloquer ou supprimer les cookies. Certaines fonctionnalites du site
          peuvent alors etre degradees.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Contact</p>
        <p className="font-mono text-sm text-text-muted">{brand.email}</p>
      </section>
    </div>
  );
}
