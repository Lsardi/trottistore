import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";

const BRAND_DATA: Record<string, { name: string; tagline: string; models: string[]; commonIssues: string[] }> = {
  dualtron: {
    name: "Dualtron",
    tagline: "Spécialiste réparation Dualtron depuis 2019",
    models: ["Thunder 2", "Mini", "Victor", "Storm", "Eagle Pro", "Spider 2", "Compact", "Ultra 2"],
    commonIssues: ["Contrôleur HS", "Problème de freinage", "Display défaillant", "Batterie en fin de vie", "Pneu crevé"],
  },
  xiaomi: {
    name: "Xiaomi",
    tagline: "Réparation Xiaomi M365, Pro 2, Mi 4 et toute la gamme",
    models: ["M365", "M365 Pro", "Pro 2", "Essential", "Mi 4", "Mi 4 Pro"],
    commonIssues: ["Tableau de bord éteint", "Crevaison chambre à air", "Batterie qui ne charge plus", "Frein arrière usé", "Accélérateur défectueux"],
  },
  ninebot: {
    name: "Ninebot",
    tagline: "Atelier certifié pour trottinettes Ninebot / Segway",
    models: ["Max G30", "Max G30LP", "Max G2", "E2", "F2", "F2 Plus", "F2 Pro"],
    commonIssues: ["Erreur moteur", "Batterie faible autonomie", "Frein à tambour usé", "Pneu tubeless crevé", "Connecteur de charge endommagé"],
  },
  kaabo: {
    name: "Kaabo",
    tagline: "Expert réparation Kaabo Mantis et Wolf Warrior",
    models: ["Mantis 10", "Mantis King GT", "Wolf Warrior 11", "Wolf King GT Pro"],
    commonIssues: ["Contrôleur grillé", "Suspension HS", "Freins hydrauliques à purger", "Écran LCD défaillant", "Jeu de direction"],
  },
  vsett: {
    name: "Vsett",
    tagline: "Réparation et entretien de toutes les Vsett",
    models: ["8", "9+", "10+", "11+"],
    commonIssues: ["Problème de puissance", "Frein à disque usé", "Batterie dégradée", "Éclairage défaillant", "Pliage desserré"],
  },
  segway: {
    name: "Segway",
    tagline: "Service après-vente Segway Ninebot",
    models: ["Ninebot P65", "Ninebot P100S", "Ninebot GT2"],
    commonIssues: ["Erreur système", "Batterie longue charge", "Pneu tubeless", "Frein régénératif faible", "Connectique oxydée"],
  },
  inokim: {
    name: "Inokim",
    tagline: "Entretien et réparation Inokim — pièces en stock",
    models: ["OX", "OXO", "Quick 4", "Light 2"],
    commonIssues: ["Contrôleur défaillant", "Pneu gonflable crevé", "Frein à câble usé", "Amortisseur fatigué", "Poignée accélérateur"],
  },
  minimotors: {
    name: "Minimotors",
    tagline: "Réparation Minimotors / Dualtron — expertise complète",
    models: ["Speedway 5", "Speedway Leger"],
    commonIssues: ["Contrôleur EY3", "Batterie lithium dégradée", "Freins à disque", "Direction qui vibre", "Éclairage LED"],
  },
  teverun: {
    name: "Teverun",
    tagline: "Réparation trottinettes Teverun — Fighter, Blade, Tetra",
    models: ["Fighter 11+", "Blade GT", "Blade Mini", "Tetra"],
    commonIssues: ["Double moteur", "Suspension réglable", "Freins hydrauliques", "Contrôleur Sine Wave", "Display TFT"],
  },
};

export async function generateStaticParams() {
  return Object.keys(BRAND_DATA).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = BRAND_DATA[slug];
  const name = data?.name || slug;
  return {
    title: `Réparation trottinette ${name} — ${brand.address.city} | ${brand.name}`,
    description: `Atelier spécialisé réparation trottinette ${name} à ${brand.address.city}. Diagnostic gratuit, devis transparent, pièces en stock. Toutes pannes : ${data?.commonIssues.slice(0, 3).join(", ")}.`,
  };
}

export default async function ReparationBrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = BRAND_DATA[slug];

  if (!data) {
    const label = slug.replace(/-/g, " ");
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <p className="spec-label mb-2">REPARATION SPECIALISEE</p>
        <h1 className="heading-lg mb-4">Réparation trottinette {label}</h1>
        <p className="font-mono text-sm text-text-muted mb-8">
          Prise en charge rapide, devis transparent et suivi en temps réel.
        </p>
        <Link href="/urgence" className="btn-neon inline-flex">Démarrer une demande urgente</Link>
      </div>
    );
  }

  const schemaService = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Réparation trottinette ${data.name}`,
    description: data.tagline,
    provider: {
      "@type": "LocalBusiness",
      name: brand.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: brand.address.street,
        postalCode: brand.address.postalCode,
        addressLocality: brand.address.city,
        addressCountry: "FR",
      },
    },
    areaServed: {
      "@type": "GeoCircle",
      geoMidpoint: { "@type": "GeoCoordinates", latitude: 48.9346, longitude: 2.3387 },
      geoRadius: "30000",
    },
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaService) }} />

      {/* Hero */}
      <div className="mb-10">
        <p className="spec-label mb-2 text-neon">ATELIER SPECIALISE</p>
        <h1 className="heading-lg mb-3">REPARATION {data.name.toUpperCase()}</h1>
        <p className="font-mono text-sm text-text-muted max-w-xl">
          {data.tagline}. Atelier à {brand.address.city}, diagnostic gratuit, pièces d&apos;origine en stock.
        </p>
      </div>

      {/* CTA */}
      <div className="flex flex-wrap gap-3 mb-10">
        <Link href="/urgence" className="btn-neon">DEMANDE URGENTE</Link>
        <Link href="/diagnostic" className="btn-outline">DIAGNOSTIC EN LIGNE</Link>
        <a href={`tel:${brand.phoneIntl}`} className="btn-outline">APPELER</a>
      </div>

      {/* Modèles */}
      <section className="bg-surface border border-border p-6 mb-6">
        <h2 className="font-display font-bold text-text uppercase text-sm mb-4">Modeles {data.name} pris en charge</h2>
        <div className="flex flex-wrap gap-2">
          {data.models.map((model) => (
            <Link
              key={model}
              href={`/compatibilite?brand=${encodeURIComponent(data.name)}&model=${encodeURIComponent(model)}`}
              className="font-mono text-xs px-3 py-1.5 border border-border hover:border-neon text-text-muted hover:text-neon transition-colors"
            >
              {data.name} {model}
            </Link>
          ))}
        </div>
      </section>

      {/* Pannes courantes */}
      <section className="bg-surface border border-border p-6 mb-6">
        <h2 className="font-display font-bold text-text uppercase text-sm mb-4">Pannes courantes {data.name}</h2>
        <div className="space-y-3">
          {data.commonIssues.map((issue) => (
            <div key={issue} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
              <span className="font-mono text-sm text-text">{issue}</span>
              <Link
                href={`/diagnostic`}
                className="font-mono text-xs text-neon hover:underline"
              >
                Diagnostiquer
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Pourquoi nous */}
      <section className="bg-surface border border-border p-6 mb-6">
        <h2 className="font-display font-bold text-text uppercase text-sm mb-4">Pourquoi choisir {brand.name} ?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="font-display font-bold text-neon text-sm mb-1">DIAGNOSTIC GRATUIT</p>
            <p className="font-mono text-xs text-text-muted">Identification du problème sans engagement</p>
          </div>
          <div>
            <p className="font-display font-bold text-neon text-sm mb-1">PIECES EN STOCK</p>
            <p className="font-mono text-xs text-text-muted">700+ références, remplacement immédiat</p>
          </div>
          <div>
            <p className="font-display font-bold text-neon text-sm mb-1">SUIVI TEMPS REEL</p>
            <p className="font-mono text-xs text-text-muted">Suivez votre réparation comme un colis</p>
          </div>
        </div>
      </section>

      {/* Autres marques */}
      <section className="mt-10">
        <p className="spec-label mb-4">AUTRES MARQUES REPAREES</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(BRAND_DATA)
            .filter(([key]) => key !== slug)
            .map(([key, b]) => (
              <Link
                key={key}
                href={`/reparation/${key}`}
                className="font-mono text-xs px-3 py-1.5 border border-border hover:border-neon text-text-dim hover:text-neon transition-colors"
              >
                {b.name}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
