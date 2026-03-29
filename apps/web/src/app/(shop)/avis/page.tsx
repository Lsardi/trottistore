import { brand } from "@/lib/brand";

export const metadata = {
  title: "Avis clients",
  description: "Avis clients TrottiStore: réparation, SAV et pièces détachées.",
};

const reviews = [
  { author: "Camille R.", text: "Réparation rapide et suivi très clair du ticket SAV.", rating: 5 },
  { author: "Nassim B.", text: "Pièce retirée en boutique en moins d'une heure. Service top.", rating: 5 },
  { author: "Julie M.", text: "Diagnostic honnête, devis respecté, équipe pro.", rating: 5 },
];

export default function AvisPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <p className="spec-label mb-3">PREUVE SOCIALE</p>
      <h1 className="heading-lg mb-4">Avis clients TrottiStore</h1>
      <p className="font-mono text-sm text-text-muted mb-8">
        Plus de {brand.googleReviewCount} avis Google depuis {brand.since}.
      </p>

      <div className="space-y-4">
        {reviews.map((review) => (
          <article key={review.author} className="bg-surface border border-border p-5">
            <p className="font-mono text-xs text-neon mb-2">{"★".repeat(review.rating)}</p>
            <p className="font-mono text-sm text-text mb-2">{review.text}</p>
            <p className="font-mono text-xs text-text-dim">{review.author}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
