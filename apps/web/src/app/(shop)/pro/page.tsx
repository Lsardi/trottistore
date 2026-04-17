"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wrench, Shield, Clock, BarChart3, Users, Check, Phone, Send, Loader2, Bike,
  Building2, Star, ArrowRight, Minus
} from "lucide-react";
import { brand } from "@/lib/brand";
import { leadsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import ConsentCheckbox from "@/components/ConsentCheckbox";

const PLANS = [
  {
    name: "Starter",
    price: "199",
    unit: "EUR/mois",
    fleet: "Jusqu'a 10 trottinettes",
    highlight: false,
    features: [
      "Diagnostic prioritaire (48h)",
      "Tarif pieces remise -10%",
      "Reporting mensuel",
      "Support email",
    ],
  },
  {
    name: "Scale",
    price: "699",
    unit: "EUR/mois",
    fleet: "Jusqu'a 50 trottinettes",
    highlight: true,
    features: [
      "Intervention prioritaire",
      "Tarif pieces remise -20%",
      "Reporting hebdo + dashboard",
      "Interlocuteur dedie",
      "Trottinettes de pret",
      "Entretien preventif inclus",
    ],
  },
  {
    name: "Fleet+",
    price: "Sur devis",
    unit: "",
    fleet: "Flotte illimitee",
    highlight: false,
    features: [
      "SLA 4h (jours ouvres)",
      "Pieces au prix coutant",
      "Dashboard temps reel",
      "Account manager dedie",
      "Flotte de pret illimitee",
      "Entretien preventif + predictif",
      "Formation equipe terrain",
    ],
  },
];

const USE_CASES = [
  {
    icon: Bike,
    title: "Livreurs independants",
    desc: "Uber Eats, Deliveroo, Stuart — votre trottinette est votre outil de travail. Zero downtime.",
  },
  {
    icon: Users,
    title: "Flottes d'entreprise",
    desc: "Vous gerez une flotte de mobilite pour vos employes ? On s'occupe de l'entretien.",
  },
  {
    icon: BarChart3,
    title: "Operateurs de location",
    desc: "Maintenance preventive et curative pour operateurs de trottinettes en libre-service.",
  },
];

const ADVANTAGES = [
  { icon: Clock, title: "Zero downtime", desc: "Trottinettes de pret pendant la reparation" },
  { icon: Shield, title: "Engagement qualite", desc: "Garantie 6 mois sur chaque intervention" },
  { icon: BarChart3, title: "Reporting", desc: "Dashboard avec couts, historique et previsions" },
  { icon: Wrench, title: "Preventif", desc: "Entretien planifie pour eviter les pannes" },
];

/** Features for comparison table */
const COMPARISON_FEATURES = [
  { label: "Diagnostic prioritaire", starter: "48h", scale: "24h", fleet: "4h SLA" },
  { label: "Remise pieces", starter: "-10%", scale: "-20%", fleet: "Prix coutant" },
  { label: "Reporting", starter: "Mensuel", scale: "Hebdo + dashboard", fleet: "Temps reel" },
  { label: "Interlocuteur dedie", starter: false, scale: true, fleet: true },
  { label: "Trottinettes de pret", starter: false, scale: true, fleet: "Illimite" },
  { label: "Entretien preventif", starter: false, scale: true, fleet: true },
  { label: "Entretien predictif", starter: false, scale: false, fleet: true },
  { label: "Formation equipe", starter: false, scale: false, fleet: true },
];

const TESTIMONIALS = [
  {
    quote: "Depuis qu'on travaille avec TrottiStore, notre flotte tourne sans interruption. Le reporting nous permet de planifier nos budgets maintenance.",
    author: "Responsable logistique",
    company: "Flotte 30+ trottinettes",
  },
  {
    quote: "En tant que livreur, je ne peux pas me permettre d'avoir ma trottinette en panne plus d'une journee. Le service pro est exactement ce qu'il me fallait.",
    author: "Livreur independant",
    company: "Deliveroo / Uber Eats",
  },
  {
    quote: "L'equipe connait nos modeles par coeur. Les interventions sont rapides et les trottinettes de pret nous sauvent la mise.",
    author: "Directeur operations",
    company: "Operateur de location",
  },
];

export default function ProPage() {
  const [formData, setFormData] = useState({
    company: "",
    contact: "",
    email: "",
    phone: "",
    fleetSize: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [consent, setConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setSubmitError("Veuillez accepter la politique de confidentialite.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);

    try {
      await leadsApi.createPro({
        company: formData.company,
        contact: formData.contact,
        email: formData.email,
        phone: formData.phone || undefined,
        fleetSize: formData.fleetSize || undefined,
        message: formData.message || undefined,
      });
      setSubmitted(true);
    } catch {
      setSubmitError("Impossible d'envoyer la demande. Reessayez dans un instant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-void">
          <div className="absolute inset-0 hero-grid-bg" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 flex items-center justify-center bg-neon text-void">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="spec-label text-neon">B2B / FLOTTES</span>
          </div>
          <h1 className="heading-xl mb-4 max-w-3xl">
            MAINTENANCE<br />
            <span className="text-outline">PROFESSIONNELLE</span>
          </h1>
          <p className="font-mono text-sm text-text-muted max-w-2xl mb-8 leading-relaxed">
            Livreurs, entreprises, operateurs : entretien preventif, reparations express
            et reporting. Un interlocuteur dedie, zero prise de tete.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#contact" className="btn-neon">
              DEMANDER UN DEVIS
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href={`tel:${brand.phoneIntl}`} className="btn-outline">
              <Phone className="w-4 h-4" />
              APPELER
            </a>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="heading-md text-text mb-2 uppercase">Pour qui ?</h2>
          <p className="font-mono text-sm text-text-muted mb-8">Des solutions adaptees a chaque besoin professionnel.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {USE_CASES.map((uc) => {
              const Icon = uc.icon;
              return (
                <div key={uc.title} className="bg-surface-2 border border-border p-6 transition-all duration-200 hover:border-neon/30 hover:-translate-y-0.5">
                  <div className="w-12 h-12 flex items-center justify-center bg-neon-dim border border-neon/20 mb-4">
                    <Icon className="w-6 h-6 text-neon" />
                  </div>
                  <h3 className="font-display font-bold text-text text-sm mb-2">{uc.title}</h3>
                  <p className="font-mono text-xs text-text-muted leading-relaxed">{uc.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="heading-md text-text mb-8 uppercase">Nos engagements</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {ADVANTAGES.map((adv) => {
            const Icon = adv.icon;
            return (
              <div key={adv.title} className="text-center p-4">
                <div className="w-14 h-14 mx-auto flex items-center justify-center bg-neon-dim border border-neon/20 mb-4">
                  <Icon className="w-7 h-7 text-neon" />
                </div>
                <p className="font-display font-bold text-text text-xs uppercase mb-1">{adv.title}</p>
                <p className="font-mono text-[11px] text-text-muted">{adv.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-10">
            <h2 className="heading-md text-text mb-2 uppercase">Formules</h2>
            <p className="font-mono text-sm text-text-muted">Choisissez la formule adaptee a votre flotte.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "border p-6 flex flex-col transition-all duration-200 relative",
                  plan.highlight
                    ? "border-neon bg-neon-dim/20 md:-translate-y-3 shadow-[0_0_40px_rgba(0,255,209,0.1)]"
                    : "border-border bg-surface-2 hover:border-border-light"
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="badge badge-neon px-4 py-1">POPULAIRE</span>
                  </div>
                )}
                <h3 className="font-display font-bold text-text text-xl mb-1 mt-1">{plan.name}</h3>
                <p className="font-mono text-xs text-text-muted mb-5">{plan.fleet}</p>
                <div className="mb-6">
                  <span className={cn(
                    "font-display font-bold text-3xl",
                    plan.highlight ? "text-neon" : "text-text"
                  )}>{plan.price}</span>
                  {plan.unit && (
                    <span className="font-mono text-xs text-text-dim ml-1">{plan.unit}</span>
                  )}
                </div>
                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((feat) => (
                    <li key={feat} className="font-mono text-xs text-text-muted flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-neon flex-shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <a href="#contact" className={cn(
                  "w-full text-center cursor-pointer",
                  plan.highlight ? "btn-neon" : "btn-outline"
                )}>
                  DEMANDER UN DEVIS
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="heading-md text-text mb-2 uppercase">Comparatif detaille</h2>
        <p className="font-mono text-sm text-text-muted mb-8">Toutes les fonctionnalites par formule.</p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 pr-4 font-mono text-xs text-text-dim uppercase tracking-wider w-1/3">Fonctionnalite</th>
                <th className="text-center py-3 px-4 font-mono text-xs text-text-dim uppercase tracking-wider">Starter</th>
                <th className="text-center py-3 px-4 font-mono text-xs text-neon uppercase tracking-wider">Scale</th>
                <th className="text-center py-3 px-4 font-mono text-xs text-text-dim uppercase tracking-wider">Fleet+</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FEATURES.map((feat) => (
                <tr key={feat.label} className="border-b border-border/50">
                  <td className="py-3 pr-4 font-mono text-xs text-text-muted">{feat.label}</td>
                  {(["starter", "scale", "fleet"] as const).map((plan) => {
                    const val = feat[plan];
                    return (
                      <td key={plan} className={cn(
                        "text-center py-3 px-4",
                        plan === "scale" ? "bg-neon-dim/10" : ""
                      )}>
                        {val === true ? (
                          <Check className="w-4 h-4 text-neon mx-auto" />
                        ) : val === false ? (
                          <Minus className="w-4 h-4 text-text-dim mx-auto" />
                        ) : (
                          <span className="font-mono text-xs text-text">{val}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="heading-md text-text mb-2 uppercase">Ils nous font confiance</h2>
          <p className="font-mono text-sm text-text-muted mb-8">Retours de nos clients professionnels.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.author} className="bg-surface-2 border border-border p-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 text-neon fill-neon" />
                  ))}
                </div>
                <p className="font-mono text-xs text-text-muted leading-relaxed mb-4 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="border-t border-border pt-3">
                  <p className="font-display font-bold text-text text-xs">{t.author}</p>
                  <p className="font-mono text-[11px] text-text-dim">{t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client logos placeholder */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <p className="spec-label text-center mb-8">NOS PARTENAIRES & CLIENTS</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {["Deliveroo", "Uber Eats", "Stuart", "Getir", "Frichti", "Coursier.fr"].map((name) => (
            <div key={name} className="flex items-center justify-center py-4 px-3 border border-border bg-surface-2 hover:border-neon/30 transition-colors duration-200">
              <span className="font-mono text-[11px] text-text-dim text-center">{name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Contact form */}
      <section id="contact" style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <div className="w-12 h-12 mx-auto flex items-center justify-center bg-neon text-void mb-4">
              <Send className="w-5 h-5" />
            </div>
            <h2 className="heading-md text-text mb-2 uppercase">Contactez-nous</h2>
            <p className="font-mono text-sm text-text-muted">Reponse sous 24h. Sans engagement.</p>
          </div>

          {submitted ? (
            <div className="bg-surface border border-neon/30 p-8 text-center">
              <Check className="w-12 h-12 text-neon mx-auto mb-4" />
              <h3 className="font-display font-bold text-neon text-lg mb-2">Demande envoyee</h3>
              <p className="font-mono text-sm text-text-muted">
                Nous vous recontacterons rapidement avec une proposition adaptee.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-surface-2 border border-border p-6 sm:p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pro-company" className="spec-label block mb-2">Entreprise *</label>
                  <input
                    id="pro-company"
                    required
                    className="input-dark w-full"
                    placeholder="Nom de l'entreprise"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="pro-contact" className="spec-label block mb-2">Nom du contact *</label>
                  <input
                    id="pro-contact"
                    required
                    className="input-dark w-full"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pro-email" className="spec-label block mb-2">Email *</label>
                  <input
                    id="pro-email"
                    type="email"
                    required
                    className="input-dark w-full"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="pro-phone" className="spec-label block mb-2">Telephone</label>
                  <input
                    id="pro-phone"
                    type="tel"
                    className="input-dark w-full"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="pro-fleet" className="spec-label block mb-2">Taille de flotte</label>
                <select
                  id="pro-fleet"
                  className="input-dark w-full"
                  value={formData.fleetSize}
                  onChange={(e) => setFormData({ ...formData, fleetSize: e.target.value })}
                >
                  <option value="">Selectionner</option>
                  <option value="1-5">1 a 5 trottinettes</option>
                  <option value="5-10">5 a 10</option>
                  <option value="10-50">10 a 50</option>
                  <option value="50+">Plus de 50</option>
                </select>
              </div>
              <div>
                <label htmlFor="pro-message" className="spec-label block mb-2">Message</label>
                <textarea
                  id="pro-message"
                  rows={4}
                  className="input-dark w-full resize-none"
                  placeholder="Decrivez votre besoin..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>
              {submitError && (
                <p role="alert" className="font-mono text-xs text-danger">{submitError}</p>
              )}
              <ConsentCheckbox checked={consent} onChange={setConsent} id="pro-consent" />
              <button type="submit" disabled={submitting || !consent} className="btn-neon w-full disabled:opacity-60 cursor-pointer">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                ENVOYER LA DEMANDE
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
