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

const ISSUE_DATA: Record<
  string,
  {
    title: string;
    symptom: string;
    likelyCauses: string[];
    priceRange: string;
    avgDelay: string;
    compatibleBrands: string[];
  }
> = {
  "trottinette-ne-demarre-plus": {
    title: "Trottinette qui ne démarre plus",
    symptom: "La trottinette reste éteinte ou s’éteint immédiatement après allumage.",
    likelyCauses: ["Batterie hors service", "Contrôleur HS", "BMS défaillant", "Connectique power endommagée"],
    priceRange: "À partir de 49€ (diagnostic) puis devis entre 90€ et 390€",
    avgDelay: "24h à 72h selon pièces",
    compatibleBrands: ["Xiaomi", "Ninebot", "Dualtron", "Kaabo", "Vsett", "Inokim", "Segway", "Teverun"],
  },
  "pneu-creve-trottinette": {
    title: "Pneu crevé trottinette",
    symptom: "Perte de pression rapide, roue molle, conduite instable ou chambre à air percée.",
    likelyCauses: ["Crevaison chambre à air", "Valve défectueuse", "Pneu usé", "Jante pincée"],
    priceRange: "Entre 29€ et 89€ selon modèle",
    avgDelay: "30 min à 2h (souvent dans la journée)",
    compatibleBrands: ["Xiaomi", "Ninebot", "Dualtron", "Kaabo", "Vsett", "Inokim", "Segway", "Teverun"],
  },
  "frein-trottinette-ne-freine-plus": {
    title: "Frein trottinette qui ne freine plus",
    symptom: "Course de levier excessive, bruit au freinage, distance d’arrêt allongée.",
    likelyCauses: ["Plaquettes usées", "Disque voilé", "Purge frein hydraulique", "Câble détendu"],
    priceRange: "Entre 39€ et 149€",
    avgDelay: "Le jour même à 48h",
    compatibleBrands: ["Dualtron", "Kaabo", "Vsett", "Ninebot", "Xiaomi", "Teverun"],
  },
  "batterie-trottinette-ne-charge-plus": {
    title: "Batterie trottinette ne charge plus",
    symptom: "Charge impossible, voyant chargeur anormal, autonomie très faible.",
    likelyCauses: ["Chargeur défaillant", "Port de charge endommagé", "Cellules batterie usées", "BMS en défaut"],
    priceRange: "Diagnostic + devis entre 60€ et 490€",
    avgDelay: "48h à 5 jours selon disponibilité batterie",
    compatibleBrands: ["Xiaomi", "Ninebot", "Dualtron", "Kaabo", "Inokim", "Segway", "Teverun"],
  },
  "guidon-trottinette-qui-bouge": {
    title: "Guidon trottinette qui bouge / jeu de direction",
    symptom: "Jeu au niveau de la colonne, vibrations, sensation d’instabilité.",
    likelyCauses: ["Serrage pliage à reprendre", "Roulements direction usés", "Pièces charnière usées"],
    priceRange: "Entre 25€ et 120€",
    avgDelay: "30 min à 24h",
    compatibleBrands: ["Dualtron", "Kaabo", "Vsett", "Xiaomi", "Ninebot", "Inokim"],
  },
};

export async function generateStaticParams() {
  const brandSlugs = Object.keys(BRAND_DATA).map((slug) => ({ slug }));
  const issueSlugs = Object.keys(ISSUE_DATA).map((slug) => ({ slug }));
  return [...brandSlugs, ...issueSlugs];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const issue = ISSUE_DATA[slug];
  if (issue) {
    return {
      title: `${issue.title} — Réparation rapide à ${brand.address.city} | ${brand.name}`,
      description: `${issue.symptom} Diagnostic atelier à ${brand.address.city}, devis transparent et pièces en stock. ${issue.priceRange}.`,
    };
  }

  const brandData = BRAND_DATA[slug];
  const name = brandData?.name || slug;
  return {
    title: `Réparation trottinette ${name} — ${brand.address.city} | ${brand.name}`,
    description: `Atelier spécialisé réparation trottinette ${name} à ${brand.address.city}. Diagnostic gratuit, devis transparent, pièces en stock. Toutes pannes : ${brandData?.commonIssues.slice(0, 3).join(", ")}.`,
  };
}

export default async function ReparationBrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const issue = ISSUE_DATA[slug];

  if (issue) {
    const issueSchema = {
      "@context": "https://schema.org",
      "@type": "Service",
      name: issue.title,
      description: issue.symptom,
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
      areaServed: "Île-de-France",
    };

    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(issueSchema) }} />

        <div className="mb-10">
          <p className="spec-label mb-2 text-neon">PANNE COURANTE</p>
          <h1 className="heading-lg mb-3">{issue.title.toUpperCase()}</h1>
          <p className="font-mono text-sm text-text-muted max-w-2xl">{issue.symptom}</p>
        </div>

        <div className="flex flex-wrap gap-3 mb-10">
          <Link href={`/urgence?issue=${encodeURIComponent(issue.title)}`} className="btn-neon">DEMANDE URGENTE</Link>
          <Link href="/diagnostic" className="btn-outline">LANCER LE DIAGNOSTIC</Link>
          <a href={`tel:${brand.phoneIntl}`} className="btn-outline">APPELER L&apos;ATELIER</a>
        </div>

        <section className="bg-surface border border-border p-6 mb-6">
          <h2 className="font-display font-bold text-text uppercase text-sm mb-4">Causes probables</h2>
          <div className="space-y-3">
            {issue.likelyCauses.map((cause) => (
              <div key={cause} className="font-mono text-sm text-text border-b border-border pb-2 last:border-0 last:pb-0">
                {cause}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface border border-border p-6 mb-6">
          <h2 className="font-display font-bold text-text uppercase text-sm mb-4">Tarifs et délais</h2>
          <p className="font-mono text-sm text-text mb-2">{issue.priceRange}</p>
          <p className="font-mono text-sm text-text-muted">Délai moyen: {issue.avgDelay}</p>
        </section>

        <section className="bg-surface border border-border p-6 mb-6">
          <h2 className="font-display font-bold text-text uppercase text-sm mb-4">Marques prises en charge</h2>
          <div className="flex flex-wrap gap-2">
            {issue.compatibleBrands.map((label) => (
              <span
                key={label}
                className="font-mono text-xs px-3 py-1.5 border border-border text-text-muted"
              >
                {label}
              </span>
            ))}
          </div>
        </section>
      </div>
    );
  }

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
