import Image from "next/image";
import { Star, Quote, ExternalLink } from "lucide-react";
import { fetchGoogleReviews } from "@/lib/google-reviews";

/**
 * Server component: full Google reviews section (header + up to 5 reviews).
 * Renders nothing when Google API is not configured.
 */
export default async function GoogleReviewsSection() {
  const data = await fetchGoogleReviews();
  if (!data || data.reviews.length === 0) return null;

  const fullStars = Math.round(data.rating);

  return (
    <section className="mt-16">
      <div className="divider mb-8" />

      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <p className="spec-label">AVIS GOOGLE — BOUTIQUE</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${i <= fullStars ? "text-neon fill-current" : "text-text-dim"}`}
                />
              ))}
            </div>
            <span className="font-display font-bold text-neon text-lg">{data.rating.toFixed(1)}</span>
            <span className="font-mono text-xs text-text-muted">
              · {data.total} avis sur Google
            </span>
          </div>
        </div>

        <a
          href={data.placeUrl ?? "https://g.page/r/trottistore"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline text-xs flex items-center gap-2"
        >
          VOIR TOUS LES AVIS
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.reviews.map((review, i) => (
          <div key={i} className="bg-surface-2 border border-border p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              {review.authorPhotoUrl && (
                <Image
                  src={review.authorPhotoUrl}
                  alt={review.authorName}
                  width={36}
                  height={36}
                  className="rounded-full border border-border"
                  unoptimized
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-text text-sm truncate">
                  {review.authorName}
                </p>
                <p className="font-mono text-[11px] text-text-dim">{review.relativeTime}</p>
              </div>
            </div>

            <div className="flex gap-0.5 mb-2">
              {Array.from({ length: review.rating }).map((_, j) => (
                <Star key={j} className="w-3 h-3 text-neon fill-current" />
              ))}
            </div>

            <Quote className="w-4 h-4 text-neon-muted mb-2" />

            <p className="font-mono text-xs text-text-muted leading-relaxed line-clamp-6 flex-1">
              {review.text}
            </p>
          </div>
        ))}
      </div>

      <p className="font-mono text-[10px] text-text-dim text-center mt-6">
        Les avis affichés sont les plus récents publiés sur la fiche Google de la boutique.
      </p>
    </section>
  );
}
