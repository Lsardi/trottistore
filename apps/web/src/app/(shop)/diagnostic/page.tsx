"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap, Battery, Disc, Monitor, Settings, AlertTriangle,
  ChevronRight, Check, RotateCcw, Wrench, ArrowRight
} from "lucide-react";
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

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; icon: typeof AlertTriangle; estimate: string }> = {
  low: { label: "Mineur", color: "bg-green-50 text-green-700 border-green-200", icon: Check, estimate: "30min - 1h" },
  medium: { label: "Moyen", color: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: AlertTriangle, estimate: "1h - 3h" },
  high: { label: "Important", color: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertTriangle, estimate: "3h - 1 jour" },
  critical: { label: "Critique", color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle, estimate: "Diagnostic approfondi requis" },
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

type Step = "category" | "symptom" | "result";

export default function DiagnosticPage() {
  const [step, setStep] = useState<Step>("category");
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
    <div className="min-h-[80vh] bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 text-sm font-medium px-4 py-2 rounded-full mb-4">
            <Wrench className="w-4 h-4" />
            Diagnostic intelligent
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3">
            Quel est le probl&egrave;me ?
          </h1>
          <p className="text-lg text-gray-500">
            R&eacute;pondez en 2 clics. On vous donne le diagnostic, le co&ucirc;t estim&eacute; et la solution.
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
                  className="bg-white rounded-2xl p-6 text-center border-2 border-transparent hover:border-teal-500 shadow-sm hover:shadow-lg transition-all group"
                >
                  <div className="w-14 h-14 mx-auto bg-gray-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-teal-50 transition-colors">
                    <Icon className="w-7 h-7 text-gray-400 group-hover:text-teal-500 transition-colors" />
                  </div>
                  <p className="font-semibold text-gray-900">{cat.label}</p>
                  <p className="text-xs text-gray-400 mt-1">{cat.symptoms.length} sympt&ocirc;mes</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Symptom */}
        {step === "symptom" && category && (
          <div>
            <button onClick={() => setStep("category")} className="text-sm text-teal-600 hover:underline mb-6 flex items-center gap-1">
              &larr; Autre cat&eacute;gorie
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              {(() => { const Icon = category.icon; return <Icon className="w-6 h-6 text-teal-500" />; })()}
              {category.label}
            </h2>
            <p className="text-gray-500 mb-6">D&eacute;crivez le sympt&ocirc;me</p>
            <div className="space-y-3">
              {category.symptoms.map((sym) => {
                const sev = SEVERITY_CONFIG[sym.severity as Severity];
                return (
                  <button
                    key={sym.id}
                    onClick={() => { setSelectedSymptom(sym.id); setStep("result"); }}
                    className="w-full bg-white rounded-xl p-5 text-left border-2 border-transparent hover:border-teal-500 shadow-sm hover:shadow-md transition-all group flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900 group-hover:text-teal-600 transition-colors">
                        {sym.label}
                      </p>
                      <span className={cn("inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium border", sev.color)}>
                        Gravit&eacute; : {sev.label}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-teal-500 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "result" && solution && severityConfig && symptom && (
          <div>
            <button onClick={reset} className="text-sm text-teal-600 hover:underline mb-6 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Nouveau diagnostic
            </button>

            {/* Severity banner */}
            {symptom.severity === "critical" && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800">Attention — Probl&egrave;me critique</p>
                  <p className="text-sm text-red-700">Cessez d&rsquo;utiliser votre trottinette et contactez-nous imm&eacute;diatement.</p>
                </div>
              </div>
            )}

            {/* Diagnosis card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-4">
                <p className="text-teal-100 text-sm">Diagnostic pour</p>
                <p className="text-white text-lg font-bold">{symptom.label}</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Solution */}
                <div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{solution.title}</h3>
                  <p className="text-gray-600">{solution.description}</p>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Co&ucirc;t estim&eacute;</p>
                    <p className="font-bold text-gray-900">{solution.estimatedCost}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Dur&eacute;e</p>
                    <p className="font-bold text-gray-900">{severityConfig.estimate}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Faisable soi-m&ecirc;me ?</p>
                    <p className={cn("font-bold", solution.diy ? "text-green-600" : "text-orange-600")}>
                      {solution.diy ? "Oui" : "Atelier"}
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex gap-3">
                  <Link
                    href={`/reparation?issue=${encodeURIComponent(symptom.label)}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-500 text-white px-6 py-4 rounded-xl font-semibold hover:bg-teal-600 transition shadow-lg shadow-teal-500/25"
                  >
                    <Wrench className="w-5 h-5" />
                    D&eacute;poser un ticket SAV
                  </Link>
                  {solution.diy && (
                    <Link
                      href="/produits"
                      className="inline-flex items-center gap-2 border-2 border-gray-200 px-6 py-4 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition"
                    >
                      Pi&egrave;ces
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
