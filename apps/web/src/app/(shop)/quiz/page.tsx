"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, RotateCcw, Zap, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";

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
  score: number;
}

function getRecommendations(answers: Record<string, string>): Recommendation[] {
  // Score-based recommendation engine
  const products: (Recommendation & { tags: string[] })[] = [
    { name: "Xiaomi Mi 4", brand: "Xiaomi", price: "449 EUR", highlight: "Meilleur rapport qualité/prix", slug: "xiaomi-mi-4", score: 0, tags: ["commute", "leisure", "short", "medium", "entry", "light", "road"] },
    { name: "Ninebot Max G30", brand: "Ninebot", price: "599 EUR", highlight: "Autonomie record (65 km)", slug: "ninebot-max-g30", score: 0, tags: ["commute", "delivery", "medium", "long", "mid", "medium", "road", "mixed"] },
    { name: "Xiaomi Pro 2", brand: "Xiaomi", price: "399 EUR", highlight: "Le classique indémodable", slug: "xiaomi-pro-2", score: 0, tags: ["commute", "leisure", "short", "entry", "light", "road"] },
    { name: "Vsett 9+", brand: "Vsett", price: "999 EUR", highlight: "Double suspension, polyvalent", slug: "vsett-9-plus", score: 0, tags: ["commute", "leisure", "medium", "long", "mid", "medium", "mixed"] },
    { name: "Dualtron Mini", brand: "Dualtron", price: "1 199 EUR", highlight: "Compact mais puissant", slug: "dualtron-mini", score: 0, tags: ["commute", "performance", "medium", "high", "light", "road", "mixed"] },
    { name: "Dualtron Thunder 2", brand: "Dualtron", price: "2 899 EUR", highlight: "La référence performance", slug: "dualtron-thunder-2", score: 0, tags: ["performance", "long", "vlong", "premium", "heavy", "mixed", "offroad"] },
    { name: "Kaabo Mantis King GT", brand: "Kaabo", price: "1 699 EUR", highlight: "Double moteur, tout terrain", slug: "kaabo-mantis-king-gt", score: 0, tags: ["performance", "delivery", "long", "vlong", "high", "premium", "heavy", "mixed", "offroad"] },
    { name: "Vsett 10+", brand: "Vsett", price: "1 499 EUR", highlight: "Excellent compromis puissance/confort", slug: "vsett-10-plus", score: 0, tags: ["commute", "performance", "delivery", "medium", "long", "high", "medium", "heavy", "mixed", "offroad"] },
    { name: "Ninebot F2 Pro", brand: "Ninebot", price: "549 EUR", highlight: "Léger et fiable pour la ville", slug: "ninebot-f2-pro", score: 0, tags: ["commute", "leisure", "short", "medium", "mid", "light", "road"] },
    { name: "Inokim OXO", brand: "Inokim", price: "1 899 EUR", highlight: "Premium, finitions haut de gamme", slug: "inokim-oxo", score: 0, tags: ["commute", "performance", "medium", "long", "high", "premium", "medium", "road", "mixed"] },
  ];

  // Score each product
  for (const product of products) {
    for (const answer of Object.values(answers)) {
      if (product.tags.includes(answer)) {
        product.score += 1;
      }
    }
  }

  return products
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export default function QuizPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const question = QUESTIONS[currentStep];
  const progress = ((currentStep) / QUESTIONS.length) * 100;
  const recommendations = showResults ? getRecommendations(answers) : [];

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
  }

  if (showResults) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <p className="spec-label text-neon mb-2">RESULTAT</p>
          <h1 className="heading-lg mb-3">VOS RECOMMANDATIONS</h1>
          <p className="font-mono text-sm text-text-muted">
            Basées sur vos réponses, voici les 3 trottinettes qui vous correspondent le mieux.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {recommendations.map((rec, i) => (
            <div
              key={rec.slug}
              className={cn(
                "bg-surface border p-6 flex items-center justify-between gap-4 transition-colors",
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
                <div className="min-w-0">
                  <p className="spec-label mb-0.5">{rec.brand}</p>
                  <p className="font-display font-bold text-text text-lg truncate">{rec.name}</p>
                  <p className="font-mono text-xs text-text-muted flex items-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-neon" />
                    {rec.highlight}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="price-main text-lg">{rec.price}</p>
                <Link
                  href={`/produits?search=${encodeURIComponent(rec.name)}`}
                  className="font-mono text-xs text-neon hover:underline mt-1 inline-block"
                >
                  VOIR &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>

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
