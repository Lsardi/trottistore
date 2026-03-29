"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wrench, Shield, Clock, BarChart3, Users, Check, Phone, Send, Loader2, Bike,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Starter",
    price: "199",
    unit: "EUR/mois",
    fleet: "Jusqu'à 10 trottinettes",
    highlight: false,
    features: [
      "Diagnostic prioritaire (48h)",
      "Tarif pièces remisé -10%",
      "Reporting mensuel",
      "Support email",
    ],
  },
  {
    name: "Scale",
    price: "699",
    unit: "EUR/mois",
    fleet: "Jusqu'à 50 trottinettes",
    highlight: true,
    features: [
      "SLA intervention 24h",
      "Tarif pièces remisé -20%",
      "Reporting hebdo + dashboard",
      "Interlocuteur dédié",
      "Trottinettes de prêt",
      "Entretien préventif inclus",
    ],
  },
  {
    name: "Fleet+",
    price: "Sur devis",
    unit: "",
    fleet: "Flotte illimitée",
    highlight: false,
    features: [
      "SLA 4h (jours ouvrés)",
      "Pièces au prix coûtant",
      "Dashboard temps réel",
      "Account manager dédié",
      "Flotte de prêt illimitée",
      "Entretien préventif + prédictif",
      "Formation équipe terrain",
    ],
  },
];

const USE_CASES = [
  {
    icon: Bike,
    title: "Livreurs indépendants",
    desc: "Uber Eats, Deliveroo, Stuart — votre trottinette est votre outil de travail. Zéro downtime.",
  },
  {
    icon: Users,
    title: "Flottes d'entreprise",
    desc: "Vous gérez une flotte de mobilité pour vos employés ? On s'occupe de l'entretien.",
  },
  {
    icon: BarChart3,
    title: "Opérateurs de location",
    desc: "Maintenance préventive et curative pour opérateurs de trottinettes en libre-service.",
  },
];

const ADVANTAGES = [
  { icon: Clock, title: "Zéro downtime", desc: "Trottinettes de prêt pendant la réparation" },
  { icon: Shield, title: "Engagement qualité", desc: "Garantie 6 mois sur chaque intervention" },
  { icon: BarChart3, title: "Reporting", desc: "Dashboard avec coûts, historique et prévisions" },
  { icon: Wrench, title: "Préventif", desc: "Entretien planifié pour éviter les pannes" },
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // TODO: POST to API when endpoint exists
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1000);
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <p className="spec-label text-neon mb-3">B2B / FLOTTES</p>
        <h1 className="heading-lg mb-4">
          MAINTENANCE PROFESSIONNELLE<br />
          POUR VOS FLOTTES
        </h1>
        <p className="font-mono text-sm text-text-muted max-w-2xl mb-8">
          Livreurs, entreprises, opérateurs : entretien préventif, réparations express
          et reporting. Un interlocuteur dédié, zéro prise de tête.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="#contact" className="btn-neon">DEMANDER UN DEVIS</a>
          <a href={`tel:${brand.phoneIntl}`} className="btn-outline">
            <Phone className="w-4 h-4" />
            APPELER
          </a>
        </div>
      </section>

      {/* Use cases */}
      <section style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="heading-md text-text mb-8 uppercase">Pour qui ?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {USE_CASES.map((uc) => {
              const Icon = uc.icon;
              return (
                <div key={uc.title} className="bg-surface-2 border border-border p-6">
                  <Icon className="w-8 h-8 text-neon mb-4" />
                  <h3 className="font-display font-bold text-text text-sm mb-2">{uc.title}</h3>
                  <p className="font-mono text-xs text-text-muted">{uc.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="heading-md text-text mb-8 uppercase">Nos engagements</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {ADVANTAGES.map((adv) => {
            const Icon = adv.icon;
            return (
              <div key={adv.title} className="text-center">
                <div className="w-12 h-12 mx-auto flex items-center justify-center bg-neon-dim border border-neon/20 mb-3">
                  <Icon className="w-6 h-6 text-neon" />
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
          <h2 className="heading-md text-text mb-8 uppercase">Formules</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "border p-6 flex flex-col",
                  plan.highlight ? "border-neon bg-neon-dim/20" : "border-border bg-surface-2"
                )}
              >
                {plan.highlight && (
                  <span className="badge badge-neon mb-3 self-start">POPULAIRE</span>
                )}
                <h3 className="font-display font-bold text-text text-xl mb-1">{plan.name}</h3>
                <p className="font-mono text-xs text-text-muted mb-4">{plan.fleet}</p>
                <div className="mb-6">
                  <span className="font-display font-bold text-neon text-2xl">{plan.price}</span>
                  {plan.unit && (
                    <span className="font-mono text-xs text-text-dim ml-1">{plan.unit}</span>
                  )}
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((feat) => (
                    <li key={feat} className="font-mono text-xs text-text-muted flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-neon flex-shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <a href="#contact" className={cn(
                  "w-full text-center",
                  plan.highlight ? "btn-neon" : "btn-outline"
                )}>
                  DEMANDER UN DEVIS
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section id="contact" className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="heading-md text-text mb-8 uppercase text-center">Contactez-nous</h2>

        {submitted ? (
          <div className="bg-surface border border-neon/30 p-8 text-center">
            <Check className="w-12 h-12 text-neon mx-auto mb-4" />
            <h3 className="font-display font-bold text-neon text-lg mb-2">Demande envoyée</h3>
            <p className="font-mono text-sm text-text-muted">
              Nous vous recontacterons sous 24h avec une proposition adaptée.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface border border-border p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="spec-label block mb-2">Entreprise *</label>
                <input
                  required
                  className="input-dark w-full"
                  placeholder="Nom de l'entreprise"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div>
                <label className="spec-label block mb-2">Nom du contact *</label>
                <input
                  required
                  className="input-dark w-full"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="spec-label block mb-2">Email *</label>
                <input
                  type="email"
                  required
                  className="input-dark w-full"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="spec-label block mb-2">Telephone</label>
                <input
                  type="tel"
                  className="input-dark w-full"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="spec-label block mb-2">Taille de flotte</label>
              <select
                className="input-dark w-full"
                value={formData.fleetSize}
                onChange={(e) => setFormData({ ...formData, fleetSize: e.target.value })}
              >
                <option value="">Sélectionner</option>
                <option value="1-5">1 à 5 trottinettes</option>
                <option value="5-10">5 à 10</option>
                <option value="10-50">10 à 50</option>
                <option value="50+">Plus de 50</option>
              </select>
            </div>
            <div>
              <label className="spec-label block mb-2">Message</label>
              <textarea
                rows={4}
                className="input-dark w-full resize-none"
                placeholder="Décrivez votre besoin..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-neon w-full disabled:opacity-60">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              ENVOYER LA DEMANDE
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
