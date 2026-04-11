import { brand } from "@/lib/brand";

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `https://${brand.domain}/#business`,
  name: brand.name,
  description: brand.seo.description,
  url: `https://${brand.domain}`,
  telephone: brand.phoneIntl,
  email: brand.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: brand.address.street,
    postalCode: brand.address.postalCode,
    addressLocality: brand.address.city,
    addressCountry: "FR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 48.9346,
    longitude: 2.3387,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "10:00",
      closes: "19:00",
    },
  ],
  priceRange: "€€",
  image: `https://${brand.domain}/og-image.jpg`,
  sameAs: [],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Trottinettes électriques et pièces détachées",
    itemListElement: [
      {
        "@type": "OfferCatalog",
        name: "Trottinettes électriques",
      },
      {
        "@type": "OfferCatalog",
        name: "Pièces détachées",
      },
      {
        "@type": "OfferCatalog",
        name: "Réparation et SAV",
      },
    ],
  },
  makesOffer: [
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Réparation trottinette électrique",
        description:
          "Diagnostic et réparation de trottinettes électriques toutes marques. Devis gratuit.",
        areaServed: {
          "@type": "GeoCircle",
          geoMidpoint: {
            "@type": "GeoCoordinates",
            latitude: 48.9346,
            longitude: 2.3387,
          },
          geoRadius: "30000",
        },
      },
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Combien coûte une réparation de trottinette électrique ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Le coût dépend de la panne. Un diagnostic coûte entre 20€ et 50€. Les réparations courantes (pneu, frein, display) vont de 30€ à 150€. Les interventions lourdes (contrôleur, batterie) de 100€ à 400€. Utilisez notre outil de diagnostic en ligne pour une estimation immédiate.",
      },
    },
    {
      "@type": "Question",
      name: "Quelles marques de trottinettes réparez-vous ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Nous réparons toutes les marques : Dualtron, Xiaomi, Ninebot, Kaabo, Vsett, Segway, Inokim, Minimotors, Teverun, Kuickwheel et plus encore. Notre atelier est équipé pour diagnostiquer et réparer tous les modèles du marché.",
      },
    },
    {
      "@type": "Question",
      name: "Quel est le délai de réparation ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Les réparations simples (pneu, frein) sont réalisées en 1 à 2 heures. Les interventions plus complexes (contrôleur, batterie) prennent 1 à 3 jours ouvrés. Vous pouvez suivre l'avancement de votre réparation en temps réel depuis votre espace client.",
      },
    },
    {
      "@type": "Question",
      name: "Où se trouve votre boutique ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `Notre boutique et atelier se trouvent au ${brand.address.street}, ${brand.address.postalCode} ${brand.address.city}. Nous sommes ouverts du lundi au samedi de 10h à 19h. Vous pouvez venir sans rendez-vous ou réserver un créneau en ligne.`,
      },
    },
  ],
};

export default function StructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />
    </>
  );
}
