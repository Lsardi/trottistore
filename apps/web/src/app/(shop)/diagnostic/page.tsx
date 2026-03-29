"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap, Battery, Disc, Monitor, Settings, AlertTriangle,
  ChevronRight, RotateCcw, Wrench, ArrowRight, CheckCircle2, Phone
} from "lucide-react";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const SYMPTOM_CATEGORIES = [
  {
    id: "electrical",
    icon: Zap,
    label: "Electrique",
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

export default function DiagnosticPage() {
  const [step, setStep] = useState<DiagStep>("category");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSymptom, setSelectedSymptom] = useState("");

  const category = SYMPTOM_CATEGORIES.find((c) => c.id === selectedCategory);
  const symptom = category?.symptoms.find((s) => s.id === selectedSymptom);
  const solution = selectedSymptom ? SOLUTIONS[selectedSymptom] : null;
  const severityConfig = symptom ? SEVERITY_CONFIG[symptom.severity as Severity] : null;

  function reset() {
    setStep("category");
    setSelectedCategory("");
    setSelectedSymptom("");
  }

  return (
    <div className="min-h-[80vh]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="heading-lg mb-3">DIAGNOSTIC</h1>
          <p className="font-mono text-sm text-text-muted">
            Repondez en 2 clics. On vous donne le diagnostic, le cout estime et la solution.
          </p>
        </div>

        {/* Step 1: Category */}
        {step === "category" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {SYMPTOM_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setStep("symptom"); }}
                  className="bg-surface-2 p-6 text-center border border-border hover:border-neon transition-all group"
                >
                  <div className="w-14 h-14 mx-auto bg-void border border-border flex items-center justify-center mb-3 group-hover:border-neon transition-colors">
                    <Icon className="w-7 h-7 text-text-dim group-hover:text-neon transition-colors" />
                  </div>
                  <p className="font-display font-bold text-text">{cat.label}</p>
                  <p className="font-mono text-xs text-text-dim mt-1">{cat.symptoms.length} symptomes</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Symptom */}
        {step === "symptom" && category && (
          <div>
            <button onClick={() => setStep("category")} className="font-mono text-sm text-neon hover:underline mb-6 flex items-center gap-1">
              &larr; Autre categorie
            </button>
            <h2 className="heading-md text-text mb-2 flex items-center gap-2">
              {(() => { const Icon = category.icon; return <Icon className="w-6 h-6 text-neon" />; })()}
              {category.label}
            </h2>
            <p className="font-mono text-sm text-text-muted mb-6">Decrivez le symptome</p>
            <div className="space-y-3">
              {category.symptoms.map((sym) => {
                const sev = SEVERITY_CONFIG[sym.severity as Severity];
                return (
                  <button
                    key={sym.id}
                    onClick={() => { setSelectedSymptom(sym.id); setStep("result"); }}
                    className="w-full bg-surface p-5 text-left border border-border hover:border-neon transition-all group flex items-center justify-between"
                  >
                    <div>
                      <p className="font-mono text-sm font-bold text-text group-hover:text-neon transition-colors">
                        {sym.label}
                      </p>
                      <span className={cn("mt-1 inline-block", sev.badgeClass)}>
                        {sev.label}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-dim group-hover:text-neon transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "result" && solution && severityConfig && symptom && (
          <div>
            <button onClick={reset} className="font-mono text-sm text-neon hover:underline mb-6 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Nouveau diagnostic
            </button>

            {/* Severity banner */}
            {symptom.severity === "critical" && (
              <div className="border border-danger bg-danger/10 p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-mono text-sm font-bold text-danger">Attention — Probleme critique</p>
                  <p className="font-mono text-xs text-danger/80">Cessez d&rsquo;utiliser votre trottinette et contactez-nous immediatement.</p>
                </div>
              </div>
            )}

            {/* Diagnosis card */}
            <div className="bg-surface border border-border overflow-hidden">
              <div className="border-t-2 border-t-neon px-6 py-4 bg-surface-2">
                <p className="spec-label">Diagnostic pour</p>
                <p className="font-display font-bold text-text text-lg mt-1">{symptom.label}</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Solution */}
                <div>
                  <h3 className="font-display font-bold text-text text-lg mb-2">{solution.title}</h3>
                  <p className="font-mono text-sm text-text-muted">{solution.description}</p>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-surface-2 border border-border p-4 text-center">
                    <p className="spec-label mb-1">Cout estime</p>
                    <p className="price-main text-base">{solution.estimatedCost}</p>
                  </div>
                  <div className="bg-surface-2 border border-border p-4 text-center">
                    <p className="spec-label mb-1">Duree</p>
                    <p className="font-mono text-sm font-bold text-text">{severityConfig.estimate}</p>
                  </div>
                  <div className="bg-surface-2 border border-border p-4 text-center">
                    <p className="spec-label mb-1">Faisable soi-meme ?</p>
                    <p className={cn("font-mono text-sm font-bold", solution.diy ? "text-neon" : "text-warning")}>
                      {solution.diy ? "Oui" : "Atelier"}
                    </p>
                  </div>
                </div>

                {/* Devis cliquable */}
                <div className="border-t-2 border-t-neon bg-surface-2 -mx-6 -mb-6 p-6 mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-neon" />
                    <p className="font-display font-bold text-text uppercase text-sm">Devis estimatif</p>
                  </div>

                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-mono text-sm text-text-muted">{solution.title}</span>
                    <span className="price-main text-lg">{solution.estimatedCost}</span>
                  </div>
                  <p className="font-mono text-xs text-text-dim mb-5">
                    Diagnostic gratuit. Prix final apres examen en atelier.
                  </p>

                  <div className="flex gap-3">
                    <Link
                      href={`/reparation?issue=${encodeURIComponent(symptom.label)}&diag=${encodeURIComponent(solution.title)}&cost=${encodeURIComponent(solution.estimatedCost)}&duration=${encodeURIComponent(severityConfig.estimate)}&category=${encodeURIComponent(category?.label || "")}`}
                      className="btn-neon flex-1"
                    >
                      <Wrench className="w-5 h-5" />
                      ACCEPTER — DEPOSER MON TICKET
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
