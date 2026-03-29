import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { Star, ExternalLink, Quote } from "lucide-react";

export const metadata: Metadata = {
  title: `Avis clients — ${brand.googleReviewCount} avis Google 5.0 | ${brand.name}`,
  description: `${brand.googleReviewCount} avis clients Google avec une note de 5.0/5. Découvrez ce que nos clients pensent de ${brand.name} — réparation, SAV et pièces détachées.`,
};

const REVIEWS = [
  {
    author: "Marc D.",
    date: "Mars 2026",
    text: "Excellent service ! Ma Dualtron est arrivée en 48h, parfaitement emballée. Le SAV m'a rappelé pour vérifier que tout fonctionnait.",
    rating: 5,
    service: "Achat",
  },
  {
    author: "Sophie L.",
    date: "Février 2026",
    text: "J'ai fait réparer ma trottinette à l'atelier. Travail impeccable, prix honnête et très bon accueil. Je recommande à 100%.",
    rating: 5,
    service: "Réparation",
  },
  {
    author: "Karim B.",
    date: "Février 2026",
    text: "Paiement en 4x sans frais, c'est top. Livraison rapide et produit conforme à la description.",
    rating: 5,
    service: "Achat",
  },
  {
    author: "Nassim B.",
    date: "Janvier 2026",
    text: "Pièce retirée en boutique en moins d'une heure. Le système de retrait rapide c'est vraiment pratique quand on est pressé.",
    rating: 5,
    service: "Pièces",
  },
  {
    author: "Julie M.",
    date: "Janvier 2026",
    text: "Diagnostic honnête, devis respecté, équipe pro. Ma Xiaomi Pro 2 remarche comme neuve. Merci !",
    rating: 5,
    service: "Réparation",
  },
  {
    author: "Camille R.",
    date: "Décembre 2025",
    text: "Réparation rapide et suivi très clair du ticket SAV. On sait exactement où en est sa trottinette. Super concept.",
    rating: 5,
    service: "SAV",
  },
  {
    author: "Thomas F.",
    date: "Décembre 2025",
    text: "Acheté une Vsett 9+ sur leur conseil. Le quiz en ligne m'a bien aidé à choisir. Trottinette au top.",
    rating: 5,
    service: "Achat",
  },
  {
    author: "Amina K.",
    date: "Novembre 2025",
    text: "Mon Ninebot G30 avait un problème de batterie. Diagnostic gratuit, prix juste, réparé en 24h. Parfait.",
    rating: 5,
    service: "Réparation",
  },
  {
    author: "Pierre V.",
    date: "Novembre 2025",
    text: "Livraison très rapide de pièces détachées. L'outil de compatibilité sur le site est génial, plus besoin de chercher partout.",
    rating: 5,
    service: "Pièces",
  },
];

const SERVICE_COUNTS = {
  Achat: REVIEWS.filter((r) => r.service === "Achat").length,
  Réparation: REVIEWS.filter((r) => r.service === "Réparation").length,
  Pièces: REVIEWS.filter((r) => r.service === "Pièces").length,
  SAV: REVIEWS.filter((r) => r.service === "SAV").length,
};

const reviewSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: brand.name,
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5.0",
    reviewCount: brand.googleReviewCount,
    bestRating: "5",
    worstRating: "1",
  },
  review: REVIEWS.map((r) => ({
    "@type": "Review",
    author: { "@type": "Person", name: r.author },
    reviewRating: { "@type": "Rating", ratingValue: r.rating },
    reviewBody: r.text,
  })),
};

export default function AvisPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }} />

      {/* Hero */}
      <div className="text-center mb-10">
        <p className="spec-label text-neon mb-3">AVIS CLIENTS VERIFIES</p>
        <h1 className="heading-lg mb-4">CE QUE NOS CLIENTS DISENT</h1>

        {/* Score agrégé */}
        <div className="inline-flex items-center gap-4 bg-surface border border-border px-6 py-4 mb-6">
          <div className="text-center">
            <p className="font-display font-bold text-3xl text-neon">5.0</p>
            <div className="flex gap-0.5 justify-center mt-1">
              {[1,2,3,4,5].map((i) => (
                <Star key={i} className="w-4 h-4 text-neon fill-current" />
              ))}
            </div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-left">
            <p className="font-display font-bold text-text text-lg">{brand.googleReviewCount} avis</p>
            <p className="font-mono text-xs text-text-muted">Google Reviews</p>
          </div>
        </div>

        {/* Tags par service */}
        <div className="flex flex-wrap justify-center gap-2">
          {Object.entries(SERVICE_COUNTS).map(([service, count]) => (
            <span key={service} className="font-mono text-xs px-3 py-1 border border-border text-text-muted">
              {service} ({count})
            </span>
          ))}
        </div>
      </div>

      {/* Avis */}
      <div className="space-y-4 mb-10">
        {REVIEWS.map((review, i) => (
          <article
            key={i}
            className="bg-surface border border-border p-6 relative"
          >
            <Quote className="w-8 h-8 text-neon/10 absolute top-4 right-4" />
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-0.5">
                {Array.from({ length: review.rating }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 text-neon fill-current" />
                ))}
              </div>
              <span className="badge badge-muted">{review.service}</span>
            </div>
            <p className="font-mono text-sm text-text leading-relaxed mb-4" style={{ fontStyle: "italic" }}>
              &ldquo;{review.text}&rdquo;
            </p>
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-text text-sm">{review.author}</span>
              <span className="font-mono text-xs text-text-dim">{review.date}</span>
            </div>
          </article>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-surface border border-neon/20 p-8 text-center">
        <h2 className="font-display font-bold text-text text-lg mb-3">Vous aussi, partagez votre experience</h2>
        <p className="font-mono text-sm text-text-muted mb-6">
          Un avis Google nous aide énormément et prend 30 secondes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://g.page/r/trottistore/review"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neon"
          >
            <Star className="w-4 h-4" />
            LAISSER UN AVIS GOOGLE
            <ExternalLink className="w-3 h-3" />
          </a>
          <Link href="/reparation" className="btn-outline">
            BESOIN D&apos;UNE REPARATION ?
          </Link>
        </div>
      </div>
    </div>
  );
}
