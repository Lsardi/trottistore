import { Star, ExternalLink } from "lucide-react";
import { fetchGoogleReviews } from "@/lib/google-reviews";

interface GoogleReviewsBadgeProps {
  /**
   * Rendered context label (visually hints "Avis Google" without overpromising
   * since this is shop-level, not product-level data).
   */
  variant?: "compact" | "full";
}

/**
 * Server component: shop-level Google rating badge.
 * Renders nothing when Google API is not configured (silent fallback).
 */
export default async function GoogleReviewsBadge({ variant = "compact" }: GoogleReviewsBadgeProps) {
  const data = await fetchGoogleReviews();
  if (!data || data.total === 0) return null;

  const fullStars = Math.round(data.rating);
  const ratingFormatted = data.rating.toFixed(1);

  if (variant === "compact") {
    return (
      <a
        href={data.placeUrl ?? "https://g.page/r/trottistore"}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 font-mono text-xs text-text-muted hover:text-neon transition-colors"
      >
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`w-3.5 h-3.5 ${i <= fullStars ? "text-neon fill-current" : "text-text-dim"}`}
            />
          ))}
        </div>
        <span className="text-neon font-bold">{ratingFormatted}</span>
        <span className="text-text-dim">·</span>
        <span>{data.total} avis Google</span>
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }

  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 border border-border bg-surface-2">
      <div className="flex flex-col">
        <span className="font-display font-bold text-neon text-2xl leading-none">
          {ratingFormatted}
        </span>
        <div className="flex gap-0.5 mt-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`w-3 h-3 ${i <= fullStars ? "text-neon fill-current" : "text-text-dim"}`}
            />
          ))}
        </div>
      </div>
      <div className="border-l border-border pl-3">
        <p className="font-mono text-xs text-text-muted leading-tight">
          {data.total} avis vérifiés
        </p>
        <a
          href={data.placeUrl ?? "https://g.page/r/trottistore"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-neon hover:underline inline-flex items-center gap-1 mt-0.5"
        >
          Voir sur Google
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}
