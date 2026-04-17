"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap, Battery, Disc, Monitor, Settings, AlertTriangle,
  ChevronRight, RotateCcw, Wrench, ArrowRight, CheckCircle2, Phone, BarChart3, CalendarCheck
} from "lucide-react";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { trackFunnelEvent } from "@/lib/funnel-tracking";
import { repairsApi } from "@/lib/api";

const CATEGORY_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  electrical: { border: "border-yellow-400/50", bg: "bg-yellow-400/10", text: "text-yellow-400", glow: "hover:shadow-[0_0_30px_rgba(250,204,21,0.15)]" },
  battery: { border: "border-green-400/50", bg: "bg-green-400/10", text: "text-green-400", glow: "hover:shadow-[0_0_30px_rgba(74,222,128,0.15)]" },
  braking: { border: "border-red-400/50", bg: "bg-red-400/10", text: "text-red-400", glow: "hover:shadow-[0_0_30px_rgba(248,113,113,0.15)]" },
  display: { border: "border-blue-400/50", bg: "bg-blue-400/10", text: "text-blue-400", glow: "hover:shadow-[0_0_30px_rgba(96,165,250,0.15)]" },
  mechanical: { border: "border-orange-400/50", bg: "bg-orange-400/10", text: "text-orange-400", glow: "hover:shadow-[0_0_30px_rgba(251,146,60,0.15)]" },
};

const SYMPTOM_CATEGORIES = [
  {
    id: "electrical",
    icon: Zap,
    label: "Electrique",
    description: "Controleur, carte mere, alimentation",
    symptoms: [
      { id: "no-start", label: "Ne demarre plus", severity: "high" },
      { id: "cuts-off", label: "S'eteint en roulant", severity: "high" },
      { id: "low-power", label: "Perte de puissance", severity: "medium" },
      { id: "error-code", label: "Code erreur au display", severity: "medium" },
      { id: "throttle", label: "Accelerateur ne repond plus", severity: "high" },
    ],
  },
  {
    id: "battery",
    icon: Battery,
    label: "Batterie",
    description: "Charge, autonomie, BMS",
    symptoms: [
      { id: "no-charge", label: "Ne charge plus", severity: "high" },
      { id: "low-range", label: "Autonomie reduite", severity: "medium" },
      { id: "slow-charge", label: "Charge tres lente", severity: "low" },
      { id: "battery-swell", label: "Batterie gonflee", severity: "critical" },
    ],
  },
  {
    id: "braking",
    icon: Disc,
    label: "Freinage",
    description: "Plaquettes, etriers, leviers",
    symptoms: [
      { id: "brake-noise", label: "Bruit au freinage", severity: "medium" },
      { id: "brake-weak", label: "Freinage faible", severity: "high" },
      { id: "brake-stuck", label: "Frein bloque", severity: "high" },
      { id: "brake-lever", label: "Levier mou / casse", severity: "medium" },
    ],
  },
  {
    id: "display",
    icon: Monitor,
    label: "Display / Eclairage",
    description: "Ecran, LED, connectiques",
    symptoms: [
      { id: "display-off", label: "Ecran ne s'allume plus", severity: "medium" },
      { id: "display-flicker", label: "Ecran clignote", severity: "low" },
      { id: "lights-off", label: "Eclairage defaillant", severity: "medium" },
    ],
  },
  {
    id: "mechanical",
    icon: Settings,
    label: "Mecanique",
    description: "Pneus, direction, suspension",
    symptoms: [
      { id: "flat-tire", label: "Crevaison / pneu a plat", severity: "low" },
      { id: "wobble", label: "Direction qui vibre", severity: "medium" },
      { id: "fold-loose", label: "Systeme de pliage lache", severity: "high" },
      { id: "noise", label: "Bruits anormaux", severity: "medium" },
      { id: "suspension", label: "Amortisseur HS", severity: "medium" },
    ],
  },
] as const;

type Severity = "low" | "medium" | "high" | "critical";

const SEVERITY_CONFIG: Record<Severity, { label: string; badgeClass: string; estimate: string }> = {
  low: { label: "Mineur", badgeClass: "badge badge-neon", estimate: "30min - 1h" },
  medium: { label: "Moyen", badgeClass: "badge badge-warning", estimate: "1h - 3h" },
  high: { label: "Important", badgeClass: "badge badge-danger", estimate: "3h - 1 jour" },
  critical: { label: "Critique", badgeClass: "badge badge-danger", estimate: "Diagnostic approfondi requis" },
};

const SOLUTIONS: Record<string, { title: string; description: string; estimatedCost: string; diy: boolean }> = {
  "no-start": { title: "Diagnostic controleur / carte mere", description: "Verification du controleur, connectiques et carte mere. Remplacement si necessaire.", estimatedCost: "50 - 200 EUR", diy: false },
  "cuts-off": { title: "Verification BMS + connectiques", description: "Le BMS (Battery Management System) peut couper l'alimentation en cas de surchauffe ou surtension.", estimatedCost: "30 - 150 EUR", diy: false },
  "low-power": { title: "Diagnostic batterie + controleur", description: "Test de capacite batterie et verification du controleur. Peut necessiter un remplacement.", estimatedCost: "50 - 300 EUR", diy: false },
  "error-code": { title: "Reset + mise a jour firmware", description: "Tentative de reset du display. Si le code persiste, diagnostic approfondi du composant concerne.", estimatedCost: "20 - 100 EUR", diy: true },
  "throttle": { title: "Remplacement accelerateur", description: "Accelerateur hors service. Remplacement par piece compatible.", estimatedCost: "15 - 50 EUR", diy: true },
  "no-charge": { title: "Test chargeur + port de charge", description: "Verification du chargeur, du port et du BMS. Remplacement du composant defaillant.", estimatedCost: "30 - 80 EUR", diy: false },
  "low-range": { title: "Test capacite batterie", description: "Mesure des cellules. Si capacite < 70%, remplacement recommande.", estimatedCost: "100 - 400 EUR", diy: false },
  "slow-charge": { title: "Verification chargeur", description: "Test de la puissance du chargeur. Remplacement si sous-performant.", estimatedCost: "25 - 60 EUR", diy: true },
  "battery-swell": { title: "REMPLACEMENT URGENT", description: "Batterie gonflee = danger. Ne pas utiliser. Remplacement immediat obligatoire.", estimatedCost: "200 - 500 EUR", diy: false },
  "brake-noise": { title: "Reglage / remplacement plaquettes", description: "Plaquettes usees ou disque voile. Reglage ou remplacement.", estimatedCost: "15 - 40 EUR", diy: true },
  "brake-weak": { title: "Purge + remplacement plaquettes", description: "Plaquettes usees ou huile de frein a remplacer (freins hydrauliques).", estimatedCost: "20 - 60 EUR", diy: false },
  "brake-stuck": { title: "Deblocage etrier + reglage", description: "Etrier de frein bloque. Nettoyage, reglage ou remplacement.", estimatedCost: "25 - 50 EUR", diy: false },
  "brake-lever": { title: "Remplacement levier de frein", description: "Levier casse ou cable detendu. Remplacement rapide.", estimatedCost: "10 - 35 EUR", diy: true },
  "display-off": { title: "Verification connectiques display", description: "Rebranchement ou remplacement du display.", estimatedCost: "20 - 80 EUR", diy: true },
  "display-flicker": { title: "Rebranchement connectique", description: "Faux contact probable. Verification et securisation de la connectique.", estimatedCost: "15 - 30 EUR", diy: true },
  "lights-off": { title: "Remplacement LED / ampoule", description: "LED HS ou connectique defaillante.", estimatedCost: "10 - 40 EUR", diy: true },
  "flat-tire": { title: "Reparation / remplacement pneu", description: "Crevaison reparable ou pneu a remplacer. Chambre a air disponible en stock.", estimatedCost: "10 - 35 EUR", diy: true },
  "wobble": { title: "Serrage direction + roulements", description: "Jeu dans le jeu de direction ou roulements uses.", estimatedCost: "20 - 60 EUR", diy: false },
  "fold-loose": { title: "Resserrage / remplacement collier", description: "Mecanisme de pliage lache. Securisation importante pour la securite.", estimatedCost: "15 - 45 EUR", diy: false },
  "noise": { title: "Diagnostic mecanique complet", description: "Identification de la source du bruit. Peut venir du moteur, des roulements ou du deck.", estimatedCost: "30 - 100 EUR", diy: false },
  "suspension": { title: "Remplacement amortisseur", description: "Amortisseur use ou casse. Remplacement par piece compatible.", estimatedCost: "30 - 80 EUR", diy: false },
};

type DiagStep = "category" | "symptom" | "result";

interface CategoryStats {
  category: string;
  count: number;
  avgCost: number | null;
  minCost: number | null;
  maxCost: number | null;
  avgDays: number | null;
}

export default function DiagnosticPage() {
  const [step, setStep] = useState<DiagStep>("category");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSymptom, setSelectedSymptom] = useState("");
  const [realStats, setRealStats] = useState<CategoryStats[]>([]);
  const [totalRepairs, setTotalRepairs] = useState(0);

  useEffect(() => {
    repairsApi.diagnosticStats().then((res) => {
      setRealStats(res.data.categories);
      setTotalRepairs(res.data.totalRepairs);
    }).catch(() => { /* fallback to static estimates */ });
  }, []);

  const category = SYMPTOM_CATEGORIES.find((c) => c.id === selectedCategory);
  const symptom = category?.symptoms.find((s) => s.id === selectedSymptom);
  const solution = selectedSymptom ? SOLUTIONS[selectedSymptom] : null;
  const severityConfig = symptom ? SEVERITY_CONFIG[symptom.severity as Severity] : null;

  /** Get real stats for the selected category, if available. */
  const categoryRealStats = realStats.find((s) => s.category === selectedCategory);

  /** Estimated cost: use real data when available, fallback to static. */
  function getEstimatedCost(): string {
    if (categoryRealStats && categoryRealStats.count >= 3 && categoryRealStats.avgCost !== null) {
      return `${categoryRealStats.minCost} - ${categoryRealStats.maxCost} EUR`;
    }
    return solution?.estimatedCost || "Sur devis";
  }

  /** Estimated duration: use real data when available. */
  function getEstimatedDuration(): string | null {
    if (categoryRealStats && categoryRealStats.avgDays !== null && categoryRealStats.count >= 3) {
      return categoryRealStats.avgDays <= 1 ? "~1 jour" : `~${categoryRealStats.avgDays} jours`;
    }
    return null;
  }

  function reset() {
    setStep("category");
    setSelectedCategory("");
    setSelectedSymptom("");
  }

  const stepIndex = step === "category" ? 0 : step === "symptom" ? 1 : 2;
  const categoryColor = selectedCategory ? CATEGORY_COLORS[selectedCategory] : null;

  return (
    <div className="min-h-[80vh]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="spec-label text-neon mb-3">DIAGNOSTIC EN LIGNE</p>
          <h1 className="heading-lg mb-4">GUIDE DE DEPANNAGE</h1>
          <p className="font-mono text-sm text-text-muted max-w-xl mx-auto">
            Decrivez votre probleme en 2 clics. On vous donne une estimation basee sur {totalRepairs > 0 ? `${totalRepairs} reparations reelles` : "notre experience"}.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {[
            { label: "Categorie", idx: 0 },
            { label: "Symptome", idx: 1 },
            { label: "Resultat", idx: 2 },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center text-xs font-mono font-bold transition-all border",
                    stepIndex === s.idx
                      ? "bg-neon text-void border-neon"
                      : stepIndex > s.idx
                        ? "bg-neon-dim text-neon border-neon/30"
                        : "bg-surface border-border text-text-dim"
                  )}
                >
                  {stepIndex > s.idx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={cn("font-mono text-xs uppercase tracking-wider hidden sm:inline", stepIndex === s.idx ? "text-neon" : "text-text-dim")}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div className={cn("w-8 h-px", stepIndex > i ? "bg-neon/50" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Category */}
        {step === "category" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SYMPTOM_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const color = CATEGORY_COLORS[cat.id];
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    void trackFunnelEvent("diagnostic_category_selected", { category: cat.id });
                    setSelectedCategory(cat.id);
                    setStep("symptom");
                  }}
                  className={cn(
                    "bg-surface-2 p-8 text-center border border-border transition-all duration-200 cursor-pointer group",
                    color.glow,
                    "hover:border-neon hover:-translate-y-1"
                  )}
                >
                  <div className={cn(
                    "w-16 h-16 mx-auto flex items-center justify-center mb-4 border transition-all duration-200",
                    color.bg,
                    color.border,
                    "group-hover:scale-110"
                  )}>
                    <Icon className={cn("w-8 h-8 transition-colors duration-200", color.text)} />
                  </div>
                  <p className="font-display font-bold text-text text-lg mb-1">{cat.label}</p>
                  <p className="font-mono text-xs text-text-dim mb-3">{cat.description}</p>
                  <span className="font-mono text-[11px] text-text-dim border border-border px-2 py-0.5">
                    {cat.symptoms.length} symptomes
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Symptom */}
        {step === "symptom" && category && (
          <div>
            <button onClick={() => setStep("category")} className="font-mono text-sm text-neon hover:underline mb-6 flex items-center gap-1 cursor-pointer transition-colors duration-200">
              &larr; Autre categorie
            </button>
            <div className="flex items-center gap-3 mb-2">
              {(() => {
                const Icon = category.icon;
                const color = CATEGORY_COLORS[category.id];
                return (
                  <div className={cn("w-10 h-10 flex items-center justify-center border", color.bg, color.border)}>
                    <Icon className={cn("w-5 h-5", color.text)} />
                  </div>
                );
              })()}
              <h2 className="heading-md text-text">{category.label}</h2>
            </div>
            <p className="font-mono text-sm text-text-muted mb-8">Selectionnez le symptome qui correspond</p>
            <div className="space-y-3">
              {category.symptoms.map((sym) => {
                const sev = SEVERITY_CONFIG[sym.severity as Severity];
                return (
                  <button
                    key={sym.id}
                    onClick={() => {
                      void trackFunnelEvent("diagnostic_result_viewed", {
                        category: category.id,
                        symptom: sym.id,
                        severity: sym.severity,
                        diy: SOLUTIONS[sym.id]?.diy ?? false,
                      });
                      setSelectedSymptom(sym.id);
                      setStep("result");
                    }}
                    className="w-full bg-surface p-6 text-left border border-border hover:border-neon transition-all duration-200 cursor-pointer group flex items-center justify-between hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(0,255,209,0.06)]"
                  >
                    <div>
                      <p className="font-mono text-sm font-bold text-text group-hover:text-neon transition-colors duration-200">
                        {sym.label}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={cn("inline-block", sev.badgeClass)}>
                          {sev.label}
                        </span>
                        <span className="font-mono text-[11px] text-text-dim">
                          {sev.estimate}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-dim group-hover:text-neon group-hover:translate-x-1 transition-all duration-200" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "result" && solution && severityConfig && symptom && (
          <div>
            <button onClick={reset} className="font-mono text-sm text-neon hover:underline mb-6 flex items-center gap-1 cursor-pointer transition-colors duration-200">
              <RotateCcw className="w-3 h-3" />
              Nouveau diagnostic
            </button>

            {/* Severity banner */}
            {symptom.severity === "critical" && (
              <div className="border border-danger bg-danger/10 p-5 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-sm font-bold text-danger">Attention — Probleme critique</p>
                  <p className="font-mono text-xs text-danger/80">Cessez d&rsquo;utiliser votre trottinette et contactez-nous immediatement.</p>
                </div>
              </div>
            )}

            {/* Diagnosis card */}
            <div className="bg-surface border border-border overflow-hidden">
              <div className="border-t-2 border-t-neon px-6 py-5 bg-surface-2">
                <p className="spec-label">Diagnostic pour</p>
                <p className="font-display font-bold text-text text-xl mt-1">{symptom.label}</p>
                {categoryColor && (
                  <div className="flex items-center gap-2 mt-2">
                    {(() => {
                      const Icon = category!.icon;
                      return <Icon className={cn("w-4 h-4", categoryColor.text)} />;
                    })()}
                    <span className="font-mono text-xs text-text-dim">{category!.label}</span>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-6">
                {/* Solution */}
                <div>
                  <h3 className="font-display font-bold text-text text-lg mb-2">{solution.title}</h3>
                  <p className="font-mono text-sm text-text-muted leading-relaxed">{solution.description}</p>
                </div>

                {/* Cost highlight */}
                <div className="bg-void border border-neon/30 p-6 text-center">
                  <p className="spec-label mb-2">Cout estime</p>
                  <p className="font-display font-bold text-3xl text-neon tracking-tight">{getEstimatedCost()}</p>
                  <p className="font-mono text-xs text-text-dim mt-2">Diagnostic gratuit. Prix final apres examen en atelier.</p>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-2 border border-border p-4 text-center">
                    <p className="spec-label mb-1">Duree</p>
                    <p className="font-mono text-sm font-bold text-text">{getEstimatedDuration() || severityConfig.estimate}</p>
                  </div>
                  <div className="bg-surface-2 border border-border p-4 text-center">
                    <p className="spec-label mb-1">Faisable soi-meme ?</p>
                    <p className={cn("font-mono text-sm font-bold", solution.diy ? "text-neon" : "text-warning")}>
                      {solution.diy ? "Oui" : "Atelier"}
                    </p>
                  </div>
                </div>
                {categoryRealStats && categoryRealStats.count >= 3 && (
                  <p className="flex items-center gap-1 font-mono text-[11px] text-neon mt-2">
                    <BarChart3 className="w-3 h-3" />
                    Estimation basee sur {categoryRealStats.count} reparations reelles
                  </p>
                )}

                {/* CTA section */}
                <div className="border-t-2 border-t-neon bg-surface-2 -mx-6 -mb-6 p-6 mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-neon" />
                    <p className="font-display font-bold text-text uppercase text-sm">Devis estimatif</p>
                  </div>

                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-mono text-sm text-text-muted">{solution.title}</span>
                    <span className="price-main text-lg">{getEstimatedCost()}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 mt-6">
                    <Link
                      href={`/reparation?issue=${encodeURIComponent(symptom.label)}&diag=${encodeURIComponent(solution.title)}&cost=${encodeURIComponent(solution.estimatedCost)}&duration=${encodeURIComponent(severityConfig.estimate)}&category=${encodeURIComponent(category?.label || "")}`}
                      onClick={() => {
                        void trackFunnelEvent("diagnostic_ticket_cta_clicked", {
                          symptom: symptom.id,
                          severity: symptom.severity,
                        });
                      }}
                      className="btn-neon flex-1"
                    >
                      <Wrench className="w-5 h-5" />
                      DEPOSER MON TICKET
                    </Link>
                    <Link
                      href="/urgence"
                      className="btn-outline flex-1 text-center"
                    >
                      <CalendarCheck className="w-4 h-4" />
                      PRENDRE RDV
                    </Link>
                  </div>

                  <div className="flex items-center gap-4 mt-4">
                    {solution.diy && (
                      <Link
                        href="/produits"
                        className="btn-outline flex-1 text-center"
                      >
                        PIECES DETACHEES
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                    <a
                      href={`tel:${brand.phoneIntl}`}
                      className="btn-outline flex-1 text-center"
                    >
                      <Phone className="w-4 h-4" />
                      APPELER
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
