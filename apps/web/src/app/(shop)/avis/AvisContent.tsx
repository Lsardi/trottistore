"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, ExternalLink, Quote, CheckCircle, Loader2 } from "lucide-react";
import { brand } from "@/lib/brand";
import { reviewsApi, type ReviewData } from "@/lib/api";

const SERVICE_TAGS = ["Achat", "Réparation", "Pièces", "SAV"] as const;

export default function AvisContent() {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [stats, setStats] = useState({ averageRating: 0, totalReviews: 0 });
  const [loading, setLoading] = useState(true);

  // Submission form
  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formContent, setFormContent] = useState("");
  const [formTag, setFormTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [reviewsRes, statsRes] = await Promise.all([
          reviewsApi.list({ limit: 30 }),
          reviewsApi.stats(),
        ]);
        setReviews(reviewsRes.data);
        setStats(statsRes.data);
      } catch {
        // Silently fail — show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");

    try {
      await reviewsApi.create({
        rating: formRating,
        content: formContent,
        serviceTag: formTag || undefined,
      });
      setSubmitted(true);
    } catch {
      setFormError("Vous devez être connecté pour laisser un avis.");
    } finally {
      setSubmitting(false);
    }
  }

  const serviceCounts = SERVICE_TAGS.reduce((acc, tag) => {
    acc[tag] = reviews.filter((r) => r.serviceTag === tag).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="text-center mb-10">
        <p className="spec-label text-neon mb-3">AVIS CLIENTS</p>
        <h1 className="heading-lg mb-4">CE QUE NOS CLIENTS DISENT</h1>

        <div className="inline-flex items-center gap-4 bg-surface border border-border px-6 py-4 mb-6">
          <div className="text-center">
            <p className="font-display font-bold text-3xl text-neon">
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
            </p>
            <div className="flex gap-0.5 justify-center mt-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${i <= Math.round(stats.averageRating) ? "text-neon fill-current" : "text-text-dim"}`}
                />
              ))}
            </div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-left">
            <p className="font-display font-bold text-text text-lg">
              {stats.totalReviews} avis
            </p>
            <p className="font-mono text-xs text-text-muted">Avis vérifiés</p>
          </div>
        </div>

        {reviews.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(serviceCounts)
              .filter(([, count]) => count > 0)
              .map(([service, count]) => (
                <span key={service} className="font-mono text-xs px-3 py-1 border border-border text-text-muted">
                  {service} ({count})
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-neon" />
        </div>
      )}

      {/* Reviews list */}
      {!loading && reviews.length > 0 && (
        <div className="space-y-4 mb-10">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="bg-surface border border-border p-6 relative"
            >
              <Quote className="w-8 h-8 text-neon/10 absolute top-4 right-4" />
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-0.5">
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 text-neon fill-current" />
                  ))}
                </div>
                {review.serviceTag && (
                  <span className="badge badge-muted">{review.serviceTag}</span>
                )}
                {review.verifiedPurchase && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-neon">
                    <CheckCircle className="w-3 h-3" /> Achat vérifié
                  </span>
                )}
              </div>
              {review.title && (
                <p className="font-display font-bold text-text text-sm mb-2">{review.title}</p>
              )}
              <p className="font-mono text-sm text-text leading-relaxed mb-4" style={{ fontStyle: "italic" }}>
                &ldquo;{review.content}&rdquo;
              </p>
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-text text-sm">
                  {review.user.firstName} {review.user.lastName.charAt(0)}.
                </span>
                <span className="font-mono text-xs text-text-dim">
                  {new Date(review.createdAt).toLocaleDateString("fr-FR", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && reviews.length === 0 && (
        <div className="text-center py-12 mb-10">
          <p className="font-mono text-sm text-text-muted">
            Aucun avis pour le moment. Soyez le premier à partager votre expérience !
          </p>
        </div>
      )}

      {/* Submission form */}
      <div className="bg-surface border border-neon/20 p-8 mb-8">
        <h2 className="font-display font-bold text-text text-lg mb-3 text-center">
          Partagez votre expérience
        </h2>

        {submitted ? (
          <div className="text-center py-4">
            <CheckCircle className="w-8 h-8 text-neon mx-auto mb-3" />
            <p className="font-mono text-sm text-text">
              Merci pour votre avis ! Il sera publié après modération.
            </p>
          </div>
        ) : showForm ? (
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto">
            {formError && (
              <div role="alert" className="font-mono text-xs text-red-400 bg-red-400/10 p-3 rounded">
                {formError}
              </div>
            )}

            <div>
              <label className="block font-mono text-xs text-text-muted mb-2">Note</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormRating(star)}
                    className="p-1"
                  >
                    <Star
                      className={`w-6 h-6 ${star <= formRating ? "text-neon fill-current" : "text-text-dim"}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="review-tag" className="block font-mono text-xs text-text-muted mb-1">
                Service concerné
              </label>
              <select
                id="review-tag"
                value={formTag}
                onChange={(e) => setFormTag(e.target.value)}
                className="input-dark w-full"
              >
                <option value="">Général</option>
                {SERVICE_TAGS.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="review-content" className="block font-mono text-xs text-text-muted mb-1">
                Votre avis
              </label>
              <textarea
                id="review-content"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="input-dark w-full resize-none"
                placeholder="Décrivez votre expérience (minimum 10 caractères)..."
              />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="btn-neon disabled:opacity-50">
                {submitting ? "ENVOI..." : "ENVOYER MON AVIS"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline">
                ANNULER
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={() => setShowForm(true)} className="btn-neon">
              <Star className="w-4 h-4" />
              LAISSER UN AVIS
            </button>
            <a
              href="https://g.page/r/trottistore/review"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
            >
              AVIS GOOGLE
              <ExternalLink className="w-3 h-3" />
            </a>
            <Link href="/reparation" className="btn-outline">
              BESOIN D&apos;UNE RÉPARATION ?
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
