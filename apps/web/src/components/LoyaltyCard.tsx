"use client";

import { Award, Star, Zap, Crown } from "lucide-react";

interface LoyaltyCardProps {
  tier: string;
  points: number;
  totalSpent: string | number;
  totalOrders: number;
}

const TIERS = {
  BRONZE: {
    icon: Award,
    color: "#CD7F32",
    nextTier: "SILVER",
    nextThreshold: 500,
    benefits: ["Diagnostic gratuit", "Newsletter exclusive"],
  },
  SILVER: {
    icon: Star,
    color: "#C0C0C0",
    nextTier: "GOLD",
    nextThreshold: 2000,
    benefits: ["Diagnostic gratuit", "-10% sur les pièces", "Priorité RDV atelier"],
  },
  GOLD: {
    icon: Crown,
    color: "#FFD700",
    nextTier: null,
    nextThreshold: null,
    benefits: [
      "Diagnostic gratuit",
      "-15% sur les pièces",
      "Priorité RDV atelier",
      "1 réparation express offerte / an",
      "Livraison offerte",
    ],
  },
} as const;

export default function LoyaltyCard({ tier, points, totalSpent, totalOrders }: LoyaltyCardProps) {
  const tierKey = (tier?.toUpperCase() || "BRONZE") as keyof typeof TIERS;
  const config = TIERS[tierKey] || TIERS.BRONZE;
  const Icon = config.icon;
  const spent = typeof totalSpent === "string" ? parseFloat(totalSpent) : totalSpent;

  // Progress vers le prochain tier
  const nextThreshold = config.nextThreshold;
  const progress = nextThreshold ? Math.min((spent / nextThreshold) * 100, 100) : 100;
  const remaining = nextThreshold ? Math.max(nextThreshold - spent, 0) : 0;

  return (
    <div
      className="border overflow-hidden"
      style={{ borderColor: config.color + "40" }}
    >
      {/* Header avec tier */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ backgroundColor: config.color + "10" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center"
            style={{ backgroundColor: config.color + "20", border: `1px solid ${config.color}40` }}
          >
            <Icon style={{ width: 20, height: 20, color: config.color }} />
          </div>
          <div>
            <p className="font-display font-bold text-text uppercase text-sm tracking-wide">
              {tierKey}
            </p>
            <p className="font-mono text-xs" style={{ color: config.color }}>
              {points} points
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs text-text-dim">{totalOrders} commande{totalOrders > 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Barre de progression */}
      {config.nextTier && (
        <div className="px-5 py-3 border-t" style={{ borderColor: config.color + "20" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] text-text-dim uppercase">
              Prochain palier : {config.nextTier}
            </span>
            <span className="font-mono text-[10px] text-text-muted">
              {remaining.toFixed(0)} EUR restants
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-2 overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: config.color,
              }}
            />
          </div>
        </div>
      )}

      {/* Avantages */}
      <div className="px-5 py-3 border-t" style={{ borderColor: config.color + "20" }}>
        <p className="font-mono text-[10px] text-text-dim uppercase mb-2">Vos avantages</p>
        <div className="flex flex-wrap gap-2">
          {config.benefits.map((benefit) => (
            <span
              key={benefit}
              className="font-mono text-[10px] px-2 py-0.5 border"
              style={{
                borderColor: config.color + "30",
                color: config.color,
                backgroundColor: config.color + "08",
              }}
            >
              <Zap style={{ width: 8, height: 8, display: "inline", marginRight: 3 }} />
              {benefit}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
