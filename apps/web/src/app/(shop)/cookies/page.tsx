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
        <p className="spec-label">Cookies essentiels</p>
        <div className="font-mono text-sm text-text-muted space-y-2">
          <p>
            <span className="text-text">refresh_token</span> (JWT)
            <br />
            Finalité : maintien de session et authentification utilisateur.
            <br />
            Durée : selon la durée de vie du jeton configurée serveur.
          </p>
          <p>
            <span className="text-text">cookie-consent</span> (localStorage)
            <br />
            Finalité : mémoriser votre choix de consentement cookies.
            <br />
            Durée : permanente jusqu&apos;à suppression manuelle.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Cookies analytics (optionnels)</p>
        <div className="font-mono text-sm text-text-muted space-y-2">
          <p>
            Si vous acceptez les cookies analytics via notre bandeau, les données suivantes sont collectées de manière anonyme :
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Pages visitées et parcours de navigation (funnel tracking)</li>
            <li>Événements de conversion (ajout panier, début checkout, commande)</li>
            <li>Source d&apos;arrivée et catégorie d&apos;appareil</li>
          </ul>
          <p>
            Ces données sont envoyées à notre service analytics interne (<span className="text-text">/api/v1/analytics/events</span>)
            et ne sont pas partagées avec des tiers. Aucun cookie tiers n&apos;est déposé.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Gestion des cookies</p>
        <p className="font-mono text-sm text-text-muted">
          Vous pouvez modifier votre choix à tout moment via le bandeau cookies accessible en bas de page,
          ou configurer votre navigateur pour bloquer ou supprimer les cookies. Certaines fonctionnalités du site
          peuvent alors être dégradées.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Contact</p>
        <p className="font-mono text-sm text-text-muted">{brand.email}</p>
      </section>
    </div>
  );
}
