import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { Wrench, Zap, Shield, Clock, MapPin, Phone, Star, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: `Atelier réparation trottinette | ${brand.name}`,
  description: `Atelier spécialisé réparation trottinettes électriques à ${brand.address.city}. Diagnostic gratuit, toutes marques, pièces en stock. Ouvert lundi-samedi 10h-19h.`,
};

const PROCESS_STEPS = [
  {
    icon: Zap,
    title: "1. DIAGNOSTIC",
    description: "Identification de la panne en 15 minutes. Gratuit et sans engagement.",
    duration: "15 min",
  },
  {
    icon: Shield,
    title: "2. DEVIS",
    description: "Devis détaillé par email ou SMS. Vous acceptez avant qu'on touche à quoi que ce soit.",
    duration: "Immédiat",
  },
  {
    icon: Wrench,
    title: "3. RÉPARATION",
    description: "Intervention avec pièces d'origine. Suivi en temps réel depuis votre espace client.",
    duration: "1h à 3 jours",
  },
  {
    icon: Clock,
    title: "4. RETRAIT",
    description: "Notification par SMS quand c'est prêt. Vous passez récupérer, c'est tout.",
    duration: "Sur notification",
  },
];

const STATS = [
  { value: "700+", label: "Pièces en stock" },
  { value: "48h", label: "Délai indicatif" },
  { value: brand.googleReviewCount, label: "Avis clients" },
  { value: brand.since, label: "Depuis" },
];

const BRANDS_REPAIRED = [
  "Dualtron", "Xiaomi", "Ninebot", "Kaabo", "Vsett", "Segway",
  "Inokim", "Minimotors", "Teverun", "Kuickwheel",
];

const GOOGLE_MAPS_EMBED = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(
  `${brand.address.street}, ${brand.address.postalCode} ${brand.address.city}`
)}&zoom=15`;

const GOOGLE_MAPS_DIR = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  `${brand.address.street}, ${brand.address.postalCode} ${brand.address.city}`
)}`;

export default function AtelierPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <p className="spec-label text-neon mb-3">ATELIER SPECIALISE</p>
        <h1 className="heading-lg mb-4">
          VOTRE ATELIER TROTTINETTE<br />
          A {brand.address.cityShort}
        </h1>
        <p className="font-mono text-sm text-text-muted max-w-2xl mb-8">
          Diagnostic gratuit, réparation toutes marques, pièces en stock.
          On répare votre trottinette pendant que vous prenez un café.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/urgence" className="btn-neon">
            <Wrench className="w-4 h-4" />
            PRENDRE RDV
          </Link>
          <Link href="/diagnostic" className="btn-outline">
            <Zap className="w-4 h-4" />
            DIAGNOSTIC EN LIGNE
          </Link>
          <a href={`tel:${brand.phoneIntl}`} className="btn-outline">
            <Phone className="w-4 h-4" />
            APPELER
          </a>
        </div>
      </section>

      {/* Stats */}
      <section style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="mx-auto max-w-5xl grid grid-cols-2 sm:grid-cols-4">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="py-6 text-center"
              style={{ borderRight: i < STATS.length - 1 ? "1px solid var(--color-border)" : "none" }}
            >
              <p className="font-display font-bold text-2xl text-text">{stat.value}</p>
              <p className="spec-label mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="heading-md text-text mb-8 uppercase">Comment ca marche</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROCESS_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="bg-surface border border-border p-5">
                <div className="w-10 h-10 flex items-center justify-center bg-neon-dim border border-neon/20 mb-4">
                  <Icon className="w-5 h-5 text-neon" />
                </div>
                <h3 className="font-display font-bold text-text text-sm mb-2">{step.title}</h3>
                <p className="font-mono text-xs text-text-muted mb-3">{step.description}</p>
                <span className="badge badge-neon">{step.duration}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Marques */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="heading-md text-text mb-6 uppercase">Marques reparees</h2>
        <div className="flex flex-wrap gap-2">
          {BRANDS_REPAIRED.map((b) => (
            <Link
              key={b}
              href={`/reparation/${b.toLowerCase()}`}
              className="font-mono text-xs px-4 py-2 border border-border hover:border-neon text-text-muted hover:text-neon transition-colors"
            >
              {b}
              <ChevronRight className="w-3 h-3 inline ml-1" />
            </Link>
          ))}
        </div>
      </section>

      {/* Infos pratiques + Map */}
      <section style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="heading-md text-text mb-6 uppercase">Infos pratiques</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Details */}
            <div className="space-y-4">
              <div className="border border-border p-5 bg-surface-2">
                <div className="flex items-start gap-3 mb-3">
                  <MapPin className="w-5 h-5 text-neon flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display font-bold text-text text-sm">ADRESSE</p>
                    <p className="font-mono text-sm text-text-muted">{brand.address.street}</p>
                    <p className="font-mono text-sm text-text-muted">{brand.address.postalCode} {brand.address.city}</p>
                  </div>
                </div>
                <a
                  href={GOOGLE_MAPS_DIR}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline w-full text-center mt-3"
                >
                  <MapPin className="w-4 h-4" />
                  ITINERAIRE GOOGLE MAPS
                </a>
              </div>

              <div className="border border-border p-5 bg-surface-2">
                <div className="flex items-start gap-3 mb-2">
                  <Clock className="w-5 h-5 text-neon flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display font-bold text-text text-sm">HORAIRES</p>
                    <div className="font-mono text-sm text-text-muted mt-2 space-y-1">
                      <p>Lundi — Vendredi : <span className="text-text">10h00 — 19h00</span></p>
                      <p>Samedi : <span className="text-text">10h00 — 19h00</span></p>
                      <p>Dimanche : <span className="text-danger">Fermé</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-border p-5 bg-surface-2">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-neon flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display font-bold text-text text-sm">CONTACT</p>
                    <a href={`tel:${brand.phoneIntl}`} className="font-mono text-sm text-neon hover:underline block mt-1">
                      {brand.phone}
                    </a>
                    <a href={`mailto:${brand.email}`} className="font-mono text-sm text-text-muted hover:text-neon block mt-1">
                      {brand.email}
                    </a>
                  </div>
                </div>
              </div>

              <div className="border border-border p-5 bg-surface-2">
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-neon flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display font-bold text-text text-sm">AVIS CLIENTS</p>
                    <p className="font-mono text-sm text-text-muted mt-1">
                      {brand.googleReviewCount} avis publiés
                    </p>
                    <Link href="/avis" className="font-mono text-xs text-neon hover:underline mt-2 inline-block">
                      VOIR LES AVIS &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Map placeholder */}
            <div className="border border-border overflow-hidden bg-surface-2 min-h-[400px] flex items-center justify-center">
              <div className="text-center p-8">
                <MapPin className="w-12 h-12 text-neon mx-auto mb-4" />
                <p className="font-display font-bold text-text text-sm mb-2">{brand.name}</p>
                <p className="font-mono text-xs text-text-muted mb-4">
                  {brand.address.street}<br />
                  {brand.address.postalCode} {brand.address.city}
                </p>
                <a
                  href={GOOGLE_MAPS_DIR}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-neon"
                >
                  OUVRIR DANS GOOGLE MAPS
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
