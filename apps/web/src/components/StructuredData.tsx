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

export default function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(localBusinessSchema),
      }}
    />
  );
}
