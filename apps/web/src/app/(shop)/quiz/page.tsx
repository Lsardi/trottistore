"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight, RotateCcw, Zap, MapPin, Star, Loader2,
  Briefcase, TreePine, Gauge, Package,
  Navigation, Map, Route, Globe,
  Wallet, BadgeDollarSign, Crown,
  Feather, Scale, Dumbbell,
  TrainTrack, Building, Mountain, ArrowLeft, ShoppingBag, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { productsApi, type Product } from "@/lib/api";

interface QuizOption {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Question {
  id: string;
  title: string;
  subtitle: string;
  options: QuizOption[];
}

const QUESTIONS: Question[] = [
  {
    id: "usage",
    title: "Quel sera votre usage principal ?",
    subtitle: "Choisissez ce qui vous correspond le mieux",
    options: [
      { value: "commute", label: "Trajet domicile-travail", description: "Fiabilite et confort au quotidien", icon: Briefcase },
      { value: "leisure", label: "Balades et loisirs", description: "Le plaisir avant tout", icon: TreePine },
      { value: "performance", label: "Sensations fortes", description: "Vitesse et puissance", icon: Gauge },
      { value: "delivery", label: "Livraison / usage pro", description: "Robustesse et autonomie", icon: Package },
    ],
  },
  {
    id: "distance",
    title: "Quelle distance quotidienne ?",
    subtitle: "Aller-retour en kilometres",
    options: [
      { value: "short", label: "Moins de 10 km", description: "Trajets courts en ville", icon: Navigation },
      { value: "medium", label: "10 a 25 km", description: "Deplacements reguliers", icon: Map },
      { value: "long", label: "25 a 50 km", description: "Longs trajets", icon: Route },
      { value: "vlong", label: "Plus de 50 km", description: "Grandes distances", icon: Globe },
    ],
  },
  {
    id: "budget",
    title: "Quel est votre budget ?",
    subtitle: "Hors options et accessoires",
    options: [
      { value: "entry", label: "Moins de 500 EUR", description: "Premier prix, bon pour debuter", icon: Wallet },
      { value: "mid", label: "500 — 1 000 EUR", description: "Le meilleur rapport qualite/prix", icon: BadgeDollarSign },
      { value: "high", label: "1 000 — 2 000 EUR", description: "Performances et confort", icon: BadgeDollarSign },
      { value: "premium", label: "Plus de 2 000 EUR", description: "Le haut de gamme", icon: Crown },
    ],
  },
  {
    id: "weight",
    title: "Le poids est-il important pour vous ?",
    subtitle: "Si vous devez porter la trottinette dans des escaliers par ex.",
    options: [
      { value: "light", label: "Oui, le plus leger possible", description: "Transport frequent", icon: Feather },
      { value: "medium", label: "Raisonnable, pas trop lourd", description: "Un bon compromis", icon: Scale },
      { value: "heavy", label: "Pas un critere", description: "La puissance prime", icon: Dumbbell },
    ],
  },
  {
    id: "terrain",
    title: "Sur quel type de terrain roulez-vous ?",
    subtitle: "Principalement",
    options: [
      { value: "road", label: "Routes et pistes cyclables", description: "Surfaces lisses", icon: TrainTrack },
      { value: "mixed", label: "Un peu de tout", description: "Ville + chemins", icon: Building },
      { value: "offroad", label: "Chemins et terrains varies", description: "Tout-terrain", icon: Mountain },
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
  if (answers.budget === "entry") return "Excellent rapport qualite/prix";
  if (answers.budget === "premium") return "Performance et finitions haut de gamme";
  if (answers.terrain === "offroad") return "Concue pour les terrains varies";
  if (answers.usage === "commute") return "Ideale pour les trajets quotidiens";
  if (product.isFeatured) return "Notre coup de coeur";
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

const RANK_LABELS = ["MEILLEUR CHOIX", "EXCELLENT CHOIX", "AUSSI RECOMMANDE"];

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
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="w-14 h-14 mx-auto flex items-center justify-center bg-neon text-void mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <p className="spec-label text-neon mb-2">RESULTAT</p>
          <h1 className="heading-lg mb-3">VOS RECOMMANDATIONS</h1>
          <p className="font-mono text-sm text-text-muted max-w-lg mx-auto">
            Basees sur vos reponses, voici les trottinettes en stock qui vous correspondent le mieux.
          </p>
        </div>

        {loadingReco ? (
          <div className="bg-surface border border-border p-16 text-center mb-8">
            <Loader2 className="w-8 h-8 animate-spin text-neon mx-auto mb-3" />
            <p className="font-mono text-sm text-text-muted">Recherche des meilleures trottinettes...</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="bg-surface border border-border p-16 text-center mb-8">
            <ShoppingBag className="w-10 h-10 text-text-dim mx-auto mb-3" />
            <p className="font-mono text-sm text-text-muted mb-2">
              Aucune trottinette ne correspond exactement a votre profil pour le moment.
            </p>
            <p className="font-mono text-xs text-text-dim mb-6">
              Parcourez le catalogue ou contactez-nous pour un conseil personnalise.
            </p>
            <Link href="/produits" className="btn-neon">
              VOIR LE CATALOGUE
            </Link>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {recommendations.map((rec, i) => (
            <div
              key={rec.slug}
              className={cn(
                "bg-surface border overflow-hidden flex flex-col transition-all duration-200 group",
                i === 0 ? "border-neon md:-translate-y-2 shadow-[0_0_30px_rgba(0,255,209,0.1)]" : "border-border hover:border-neon"
              )}
            >
              {/* Rank label */}
              <div className={cn(
                "px-4 py-2 text-center",
                i === 0 ? "bg-neon text-void" : "bg-surface-2 border-b border-border"
              )}>
                <span className={cn(
                  "font-mono text-[11px] font-bold uppercase tracking-wider",
                  i === 0 ? "text-void" : "text-text-dim"
                )}>
                  {RANK_LABELS[i] || `#${i + 1}`}
                </span>
              </div>

              {/* Product image */}
              <div className="relative aspect-square bg-void border-b border-border overflow-hidden">
                {rec.imageUrl ? (
                  <Image
                    src={rec.imageUrl}
                    alt={rec.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    style={{ objectFit: "contain", padding: "16px" }}
                    className="group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Zap className="w-12 h-12 text-border" />
                  </div>
                )}
                {!rec.inStock && (
                  <div className="absolute top-3 right-3">
                    <span className="font-mono text-[10px] text-warning border border-warning/30 bg-void/90 px-2 py-1">
                      SUR COMMANDE
                    </span>
                  </div>
                )}
              </div>

              {/* Product info */}
              <div className="p-5 flex-1 flex flex-col">
                <p className="spec-label text-neon mb-1">{rec.brand}</p>
                <h3 className="font-display font-bold text-text text-lg mb-2 line-clamp-2">{rec.name}</h3>
                <p className="font-mono text-xs text-text-muted flex items-center gap-1 mb-4">
                  <Star className="w-3 h-3 text-neon flex-shrink-0" />
                  {rec.highlight}
                </p>

                <div className="mt-auto">
                  <p className="price-main text-xl mb-4">{rec.price}</p>
                  <Link
                    href={`/produits/${rec.slug}`}
                    className={cn(
                      "w-full text-center cursor-pointer",
                      i === 0 ? "btn-neon" : "btn-outline"
                    )}
                  >
                    VOIR CE MODELE
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center mb-8">
          <button onClick={reset} className="btn-outline cursor-pointer">
            <RotateCcw className="w-4 h-4" />
            REFAIRE LE QUIZ
          </button>
          <Link href="/produits" className="btn-neon">
            VOIR TOUT LE CATALOGUE
          </Link>
        </div>

        <div className="bg-surface-2 border border-border p-6 text-center">
          <p className="font-mono text-sm text-text mb-2">Pas sur de votre choix ?</p>
          <p className="font-mono text-xs text-text-muted mb-4">
            Venez essayer en boutique. Reservez un creneau et testez avant d&apos;acheter.
          </p>
          <Link href="/urgence" className="font-mono text-xs text-neon hover:underline cursor-pointer transition-colors duration-200 inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
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
        <div className="w-12 h-12 mx-auto flex items-center justify-center bg-neon-dim border border-neon/30 mb-4">
          <Zap className="w-6 h-6 text-neon" />
        </div>
        <p className="spec-label text-neon mb-2">QUIZ</p>
        <h1 className="heading-lg mb-3">TROUVEZ VOTRE TROTTINETTE</h1>
        <p className="font-mono text-sm text-text-muted">
          5 questions, 30 secondes, 3 recommandations personnalisees.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-xs text-text-dim">Question {currentStep + 1}/{QUESTIONS.length}</span>
          <span className="font-mono text-xs text-neon font-bold">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-1.5 bg-surface-2 overflow-hidden">
          <div
            className="h-full bg-neon transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex justify-between mt-2">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 transition-all duration-200",
                i < currentStep ? "bg-neon" : i === currentStep ? "bg-neon animate-neon-pulse" : "bg-border"
              )}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="mb-8">
        <h2 className="font-display font-bold text-text text-xl mb-2">{question.title}</h2>
        <p className="font-mono text-sm text-text-muted">{question.subtitle}</p>
      </div>

      {/* Options as big cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {question.options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              onClick={() => handleAnswer(option.value)}
              className="bg-surface p-6 text-left border border-border hover:border-neon transition-all duration-200 cursor-pointer group hover:-translate-y-1 hover:shadow-[0_0_24px_rgba(0,255,209,0.08)]"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-surface-2 border border-border group-hover:border-neon group-hover:bg-neon-dim mb-4 transition-all duration-200">
                <Icon className="w-5 h-5 text-text-dim group-hover:text-neon transition-colors duration-200" />
              </div>
              <p className="font-display font-bold text-text group-hover:text-neon transition-colors duration-200 mb-1">
                {option.label}
              </p>
              <p className="font-mono text-xs text-text-dim">{option.description}</p>
            </button>
          );
        })}
      </div>

      {/* Back button */}
      {currentStep > 0 && (
        <button
          onClick={() => setCurrentStep(currentStep - 1)}
          className="font-mono text-sm text-neon hover:underline mt-8 flex items-center gap-1 cursor-pointer transition-colors duration-200"
        >
          <ArrowLeft className="w-3 h-3" />
          Question precedente
        </button>
      )}
    </div>
  );
}
