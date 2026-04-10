"use client";

import { useEffect, useState } from "react";
import { Star, CheckCircle } from "lucide-react";
import { reviewsApi, type ReviewData } from "@/lib/api";

interface ProductReviewsProps {
  slug: string;
}

export default function ProductReviews({ slug }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [stats, setStats] = useState({ averageRating: 0, totalReviews: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    reviewsApi.forProduct(slug).then((res) => {
      setReviews(res.data);
      setStats(res.stats);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [slug]);

  if (!loaded || (loaded && reviews.length === 0)) return null;

  return (
    <div className="mt-16">
      <div className="divider mb-8" />

      <div className="flex items-center gap-4 mb-6">
        <p className="spec-label">AVIS CLIENTS</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${i <= Math.round(stats.averageRating) ? "text-neon fill-current" : "text-text-dim"}`}
              />
            ))}
          </div>
          <span className="font-mono text-xs text-text-muted">
            {stats.averageRating.toFixed(1)} ({stats.totalReviews} avis)
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-0.5">
                {Array.from({ length: review.rating }).map((_, j) => (
                  <Star key={j} className="w-3 h-3 text-neon fill-current" />
                ))}
              </div>
              {review.verifiedPurchase && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-neon">
                  <CheckCircle className="w-3 h-3" /> Achat vérifié
                </span>
              )}
            </div>
            {review.title && (
              <p className="font-display font-bold text-text text-sm mb-1">{review.title}</p>
            )}
            <p className="font-mono text-xs text-text-muted leading-relaxed mb-2">
              {review.content}
            </p>
            <p className="font-mono text-[11px] text-text-dim">
              {review.user.firstName} {review.user.lastName.charAt(0)}. —{" "}
              {new Date(review.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
