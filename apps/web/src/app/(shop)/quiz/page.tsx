"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, RotateCcw, Zap, MapPin, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { productsApi, type Product } from "@/lib/api";

interface Question {
  id: string;
  title: string;
  subtitle: string;
  options: { value: string; label: string; emoji: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: "usage",
    title: "Quel sera votre usage principal ?",
    subtitle: "Choisissez ce qui vous correspond le mieux",
    options: [
      { value: "commute", label: "Trajet domicile-travail", emoji: "🏢" },
      { value: "leisure", label: "Balades et loisirs", emoji: "🌳" },
      { value: "performance", label: "Sensations fortes", emoji: "⚡" },
      { value: "delivery", label: "Livraison / usage pro", emoji: "📦" },
    ],
  },
  {
    id: "distance",
    title: "Quelle distance quotidienne ?",
    subtitle: "Aller-retour en kilomètres",
    options: [
      { value: "short", label: "Moins de 10 km", emoji: "📍" },
      { value: "medium", label: "10 à 25 km", emoji: "🗺️" },
      { value: "long", label: "25 à 50 km", emoji: "🛣️" },
      { value: "vlong", label: "Plus de 50 km", emoji: "🌍" },
    ],
  },
  {
    id: "budget",
    title: "Quel est votre budget ?",
    subtitle: "Hors options et accessoires",
    options: [
      { value: "entry", label: "Moins de 500 EUR", emoji: "💰" },
      { value: "mid", label: "500 — 1 000 EUR", emoji: "💰💰" },
      { value: "high", label: "1 000 — 2 000 EUR", emoji: "💰💰💰" },
      { value: "premium", label: "Plus de 2 000 EUR", emoji: "👑" },
    ],
  },
  {
    id: "weight",
    title: "Le poids est-il important pour vous ?",
    subtitle: "Si vous devez porter la trottinette dans des escaliers par ex.",
    options: [
      { value: "light", label: "Oui, le plus léger possible", emoji: "🪶" },
      { value: "medium", label: "Raisonnable, pas trop lourd", emoji: "⚖️" },
      { value: "heavy", label: "Pas un critère", emoji: "💪" },
    ],
  },
  {
    id: "terrain",
    title: "Sur quel type de terrain roulez-vous ?",
    subtitle: "Principalement",
    options: [
      { value: "road", label: "Routes et pistes cyclables", emoji: "🛤️" },
      { value: "mixed", label: "Un peu de tout", emoji: "🏙️" },
      { value: "offroad", label: "Chemins et terrains variés", emoji: "🏔️" },
    ],
  },
];

interface Recommendation {
  name: string;
  brand: string;
  price: string;
  highlight: string;
  slug: string;
  inStock: boolean;
  imageUrl?: string;
}

/** Map quiz budget to a [minPriceTtc, maxPriceTtc] range in EUR. */
function budgetRange(budget?: string): [number, number] {
  switch (budget) {
    case "entry":
      return [0, 500];
    case "mid":
      return [500, 1000];
    case "high":
      return [1000, 2000];
    case "premium":
      return [2000, 100000];
    default:
      return [0, 100000];
  }
}

/** Heuristic: if user wants performance / offroad, prioritize "Dualtron|Kaabo|Wolf". */
function brandHints(answers: Record<string, string>): string[] {
  const hints: string[] = [];
  const usage = answers.usage;
  const terrain = answers.terrain;
  if (usage === "performance" || terrain === "offroad") hints.push("Dualtron", "Kaabo");
  if (usage === "commute" || terrain === "road") hints.push("Xiaomi", "Ninebot");
  if (usage === "leisure") hints.push("Ninebot", "Vsett");
  if (usage === "delivery") hints.push("Vsett", "Kaabo");
  return Array.from(new Set(hints));
}

function highlightFor(answers: Record<string, string>, product: Product): string {
  if (answers.budget === "entry") return "Excellent rapport qualité/prix";
  if (answers.budget === "premium") return "Performance et finitions haut de gamme";
  if (answers.terrain === "offroad") return "Conçue pour les terrains variés";
  if (answers.usage === "commute") return "Idéale pour les trajets quotidiens";
  if (product.isFeatured) return "Notre coup de cœur";
  return "Bon compromis pour votre profil";
}

async function fetchRecommendationsFromApi(
  answers: Record<string, string>,
): Promise<Recommendation[]> {
  const hints = brandHints(answers);
  const [minPrice, maxPrice] = budgetRange(answers.budget);

  // Pull from the trottinettes category. We over-fetch then filter client-side
  // for price (the backend filter API doesn't have a price range yet).
  const res = await productsApi.list({ categorySlug: "trottinettes-electriques", limit: 50 });
  const all = res.data || [];
  if (all.length === 0) return [];

  // Filter by price range
  const inBudget = all.filter((p) => {
    const ttc = parseFloat(p.priceHt) * (1 + parseFloat(p.tvaRate) / 100);
    return ttc >= minPrice && ttc <= maxPrice;
  });

  const candidates = inBudget.length >= 3 ? inBudget : all;

  // Score: brand hint match (+10), in stock (+3), featured (+1), nearer the
  // budget center (smaller distance = better)
  const center = (minPrice + maxPrice) / 2;
  const scored = candidates.map((p) => {
    const ttc = parseFloat(p.priceHt) * (1 + parseFloat(p.tvaRate) / 100);
    const inStock = (p.variants?.[0]?.stockQuantity ?? 0) > 0;
    let score = 0;
    if (hints.some((h) => p.brand?.name?.toLowerCase().includes(h.toLowerCase()))) score += 10;
    if (inStock) score += 3;
    if (p.isFeatured) score += 1;
    score -= Math.abs(ttc - center) / 1000;
    return { product: p, score, ttc, inStock };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(({ product, ttc, inStock }) => ({
    name: product.name,
    brand: product.brand?.name ?? "—",
    price: `${ttc.toFixed(0)} EUR`,
    highlight: highlightFor(answers, product),
    slug: product.slug,
    inStock,
    imageUrl: product.images?.find((i) => i.isPrimary)?.url ?? product.images?.[0]?.url,
  }));
}

export default function QuizPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingReco, setLoadingReco] = useState(false);

  const question = QUESTIONS[currentStep];
  const progress = ((currentStep) / QUESTIONS.length) * 100;

  // Fetch real recommendations from the products API once the user finishes
  // the quiz. Soft-fail to an empty list if the API is down.
  useEffect(() => {
    if (!showResults) return;
    setLoadingReco(true);
    fetchRecommendationsFromApi(answers)
      .then((recs) => setRecommendations(recs))
      .catch(() => setRecommendations([]))
      .finally(() => setLoadingReco(false));
  }, [showResults, answers]);

  function handleAnswer(value: string) {
    const newAnswers = { ...answers, [question.id]: value };
    setAnswers(newAnswers);

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowResults(true);
    }
  }

  function reset() {
    setCurrentStep(0);
    setAnswers({});
    setShowResults(false);
    setRecommendations([]);
  }

  if (showResults) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <p className="spec-label text-neon mb-2">RESULTAT</p>
          <h1 className="heading-lg mb-3">VOS RECOMMANDATIONS</h1>
          <p className="font-mono text-sm text-text-muted">
            Basées sur vos réponses, voici les trottinettes en stock qui vous correspondent le mieux.
          </p>
        </div>

        {loadingReco ? (
          <div className="bg-surface border border-border p-12 text-center mb-8">
            <Loader2 className="w-6 h-6 animate-spin text-neon mx-auto" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="bg-surface border border-border p-12 text-center mb-8">
            <p className="font-mono text-sm text-text-muted mb-2">
              Aucune trottinette ne correspond exactement à votre profil pour le moment.
            </p>
            <p className="font-mono text-xs text-text-dim mb-6">
              Parcourez le catalogue ou contactez-nous pour un conseil personnalisé.
            </p>
            <Link href="/produits" className="btn-neon">
              VOIR LE CATALOGUE
            </Link>
          </div>
        ) : (
        <div className="space-y-4 mb-8">
          {recommendations.map((rec, i) => (
            <Link
              key={rec.slug}
              href={`/produits/${rec.slug}`}
              className={cn(
                "block bg-surface border p-5 flex items-center justify-between gap-4 transition-colors hover:border-neon",
                i === 0 ? "border-neon" : "border-border"
              )}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center font-display font-bold text-lg flex-shrink-0",
                    i === 0 ? "bg-neon text-void" : "bg-surface-2 text-text-dim border border-border"
                  )}
                >
                  {i + 1}
                </div>
                {rec.imageUrl && (
                  <div className="relative w-16 h-16 flex-shrink-0 bg-void border border-border">
                    <Image
                      src={rec.imageUrl}
                      alt={rec.name}
                      fill
                      sizes="64px"
                      style={{ objectFit: "contain", padding: "4px" }}
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="spec-label mb-0.5">{rec.brand}</p>
                  <p className="font-display font-bold text-text text-lg truncate">{rec.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="font-mono text-xs text-text-muted flex items-center gap-1">
                      <Star className="w-3 h-3 text-neon" />
                      {rec.highlight}
                    </p>
                    {!rec.inStock && (
                      <span className="font-mono text-[10px] text-warning border border-warning/30 px-1.5 py-0.5">
                        SUR COMMANDE
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="price-main text-lg">{rec.price}</p>
                <span className="font-mono text-xs text-neon hover:underline mt-1 inline-block">
                  VOIR &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={reset} className="btn-outline">
            <RotateCcw className="w-4 h-4" />
            REFAIRE LE QUIZ
          </button>
          <Link href="/produits" className="btn-neon">
            VOIR TOUT LE CATALOGUE
          </Link>
        </div>

        <div className="mt-8 bg-surface-2 border border-border p-5 text-center">
          <p className="font-mono text-sm text-text mb-2">Pas sur de votre choix ?</p>
          <p className="font-mono text-xs text-text-muted mb-4">
            Venez essayer en boutique. Réservez un créneau et testez avant d&apos;acheter.
          </p>
          <Link href="/urgence" className="font-mono text-xs text-neon hover:underline">
            <MapPin className="w-3 h-3 inline mr-1" />
            RESERVER UN ESSAI EN BOUTIQUE
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <p className="spec-label text-neon mb-2">QUIZ</p>
        <h1 className="heading-lg mb-3">TROUVEZ VOTRE TROTTINETTE</h1>
        <p className="font-mono text-sm text-text-muted">
          5 questions, 30 secondes, 3 recommandations personnalisées.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs text-text-dim">Question {currentStep + 1}/{QUESTIONS.length}</span>
          <span className="font-mono text-xs text-text-dim">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-1 bg-surface-2">
          <div
            className="h-full bg-neon transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-8">
        <h2 className="font-display font-bold text-text text-xl mb-2">{question.title}</h2>
        <p className="font-mono text-sm text-text-muted">{question.subtitle}</p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleAnswer(option.value)}
            className="w-full bg-surface p-5 text-left border border-border hover:border-neon transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">{option.emoji}</span>
              <span className="font-display font-bold text-text group-hover:text-neon transition-colors">
                {option.label}
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-text-dim group-hover:text-neon transition-colors" />
          </button>
        ))}
      </div>

      {/* Back button */}
      {currentStep > 0 && (
        <button
          onClick={() => setCurrentStep(currentStep - 1)}
          className="font-mono text-sm text-neon hover:underline mt-6 flex items-center gap-1"
        >
          &larr; Question précédente
        </button>
      )}
    </div>
  );
}
