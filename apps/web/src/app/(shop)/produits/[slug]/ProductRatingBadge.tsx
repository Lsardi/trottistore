"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { reviewsApi } from "@/lib/api";

interface ProductRatingBadgeProps {
  slug: string;
  /** Anchor id of the reviews section to scroll to. */
  anchor?: string;
}

/**
 * Small inline rating badge displayed in the product page header.
 * Renders nothing while loading, and shows "Soyez le premier à donner un avis"
 * link when there are 0 reviews so the social proof opportunity is never silent.
 */
export default function ProductRatingBadge({ slug, anchor = "avis-produit" }: ProductRatingBadgeProps) {
  const [stats, setStats] = useState<{ averageRating: number; totalReviews: number } | null>(null);

  useEffect(() => {
    reviewsApi
      .forProduct(slug)
      .then((res) => setStats(res.stats))
      .catch(() => setStats({ averageRating: 0, totalReviews: 0 }));
  }, [slug]);

  if (!stats) return null;

  if (stats.totalReviews === 0) {
    return (
      <a
        href={`#${anchor}`}
        className="inline-flex items-center gap-2 font-mono text-xs text-text-dim hover:text-neon transition-colors"
      >
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="w-3 h-3 text-text-dim" />
          ))}
        </div>
        <span>Soyez le premier à donner un avis</span>
      </a>
    );
  }

  return (
    <a
      href={`#${anchor}`}
      className="inline-flex items-center gap-2 font-mono text-xs text-text-muted hover:text-neon transition-colors"
    >
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${i <= Math.round(stats.averageRating) ? "text-neon fill-current" : "text-text-dim"}`}
          />
        ))}
      </div>
      <span className="text-neon font-bold">{stats.averageRating.toFixed(1)}</span>
      <span className="text-text-dim">·</span>
      <span>{stats.totalReviews} {stats.totalReviews > 1 ? "avis vérifiés" : "avis vérifié"}</span>
    </a>
  );
}
