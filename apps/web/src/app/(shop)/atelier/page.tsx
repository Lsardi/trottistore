import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { Wrench, Zap, Shield, Clock, MapPin, Phone, Star, Award, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: `Atelier reparation trottinette | ${brand.name}`,
  description: `Atelier specialise reparation trottinettes electriques a ${brand.address.city}. Diagnostic 30€, toutes marques, pieces en stock. Ouvert lundi-samedi 10h-19h.`,
};

const PROCESS_STEPS = [
  {
    icon: Zap,
    title: "DIAGNOSTIC",
    description: "Identification de la panne en 15 minutes. Gratuit et sans engagement.",
    duration: "15 min",
  },
  {
    icon: Shield,
    title: "DEVIS",
    description: "Devis detaille par email ou SMS. Vous acceptez avant qu'on touche a quoi que ce soit.",
    duration: "Immediat",
  },
  {
    icon: Wrench,
    title: "REPARATION",
    description: "Intervention avec pieces d'origine. Suivi en temps reel depuis votre espace client.",
    duration: "1h a 3 jours",
  },
  {
    icon: Clock,
    title: "RETRAIT",
    description: "Notification par SMS quand c'est pret. Vous passez recuperer, c'est tout.",
    duration: "Sur notification",
  },
];

const STATS = [
  { value: "7", suffix: "ans", label: "d'experience" },
  { value: "2000", suffix: "+", label: "reparations" },
  { value: "15", suffix: "+", label: "marques" },
  { value: "700", suffix: "+", label: "pieces en stock" },
];

const BRANDS_REPAIRED = [
  "Dualtron", "Xiaomi", "Ninebot", "Kaabo", "Vsett", "Segway",
  "Inokim", "Minimotors", "Teverun", "Kuickwheel",
];

const GOOGLE_MAPS_DIR = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  `${brand.address.street}, ${brand.address.postalCode} ${brand.address.city}`
)}`;

function isOpenNow(): { open: boolean; label: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sunday
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour * 60 + minute;

  if (day === 0) return { open: false, label: "Ferme — dimanche" };
  if (time < 600) return { open: false, label: "Ferme — ouvre a 10h" };
  if (time >= 1140) return { open: false, label: "Ferme — ouvre demain a 10h" };
  if (time >= 1110) return { open: true, label: "Ouvert — ferme dans 30min" };
  return { open: true, label: "Ouvert maintenant" };
}

export default function AtelierPage() {
  const status = isOpenNow();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-void">
          <div className="absolute inset-0 hero-grid-bg" />
          <div className="hero-glow" style={{ top: "30%", left: "20%" }} />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 flex items-center justify-center bg-neon text-void">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <p className="spec-label text-neon">ATELIER SPECIALISE</p>
              <p className="font-mono text-xs text-text-dim">Depuis {brand.since}</p>
            </div>
          </div>

          <h1 className="heading-xl mb-6 max-w-3xl">
            NOTRE ATELIER<br />
            <span className="text-outline">A {brand.address.cityShort}</span>
          </h1>

          <p className="font-mono text-sm text-text-muted max-w-xl mb-8 leading-relaxed">
            Diagnostic 30€, reparation toutes marques, pieces en stock.
            On repare votre trottinette pendant que vous prenez un cafe.
          </p>

          {/* Open/closed indicator */}
          <div className="flex items-center gap-2 mb-8">
            <span className={`w-2.5 h-2.5 rounded-full ${status.open ? "bg-neon animate-neon-pulse" : "bg-danger"}`} />
            <span className={`font-mono text-sm font-bold ${status.open ? "text-neon" : "text-danger"}`}>
              {status.label}
            </span>
          </div>

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
        </div>
      </section>

      {/* Stats */}
      <section style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="mx-auto max-w-5xl grid grid-cols-2 sm:grid-cols-4">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="py-8 text-center"
              style={{ borderRight: i < STATS.length - 1 ? "1px solid var(--color-border)" : "none" }}
            >
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-display font-bold text-3xl text-neon">{stat.value}</span>
                <span className="font-display font-bold text-lg text-neon">{stat.suffix}</span>
              </div>
              <p className="spec-label mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process — Visual Timeline */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="heading-md text-text mb-2 uppercase">Comment ca marche</h2>
        <p className="font-mono text-sm text-text-muted mb-12">4 etapes simples, du diagnostic au retrait.</p>

        <div className="relative">
          {/* Timeline connector (hidden on mobile) */}
          <div className="hidden lg:block absolute top-10 left-0 right-0 h-px bg-border" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROCESS_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative">
                  {/* Step number + icon */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="relative z-10 w-12 h-12 flex items-center justify-center bg-void border-2 border-neon">
                      <Icon className="w-5 h-5 text-neon" />
                    </div>
                    <div className="lg:hidden">
                      <span className="font-mono text-xs text-neon">{String(idx + 1).padStart(2, "0")}</span>
                    </div>
                  </div>
                  {/* Hidden step number for desktop */}
                  <span className="hidden lg:block font-mono text-[11px] text-neon mb-2">{String(idx + 1).padStart(2, "0")}</span>

                  <h3 className="font-display font-bold text-text text-sm mb-2 uppercase">{step.title}</h3>
                  <p className="font-mono text-xs text-text-muted mb-3 leading-relaxed">{step.description}</p>
                  <span className="badge badge-neon">{step.duration}</span>

                  {/* Vertical connector for mobile between steps */}
                  {idx < PROCESS_STEPS.length - 1 && (
                    <div className="lg:hidden w-px h-6 bg-neon/30 ml-6 mt-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Marques */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="heading-md text-text mb-2 uppercase">Marques reparees</h2>
        <p className="font-mono text-sm text-text-muted mb-8">On repare toutes les marques. Voici les plus courantes.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {BRANDS_REPAIRED.map((b) => (
            <Link
              key={b}
              href={`/reparation/${b.toLowerCase()}`}
              className="bg-surface-2 border border-border hover:border-neon p-4 text-center transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
            >
              <div className="w-10 h-10 mx-auto flex items-center justify-center bg-void border border-border group-hover:border-neon/50 mb-2 transition-colors duration-200">
                <Award className="w-5 h-5 text-text-dim group-hover:text-neon transition-colors duration-200" />
              </div>
              <p className="font-mono text-xs font-bold text-text group-hover:text-neon transition-colors duration-200">{b}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Hours — Prominent */}
      <section style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Clock className="w-6 h-6 text-neon" />
                <h2 className="heading-md text-text uppercase">Horaires d&apos;ouverture</h2>
              </div>
              {/* Open status badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 border"
                style={{
                  borderColor: status.open ? "var(--color-neon)" : "var(--color-danger)",
                  backgroundColor: status.open ? "rgba(0,255,209,0.08)" : "rgba(255,59,48,0.08)",
                }}
              >
                <span className={`w-2 h-2 rounded-full ${status.open ? "bg-neon animate-neon-pulse" : "bg-danger"}`} />
                <span className={`font-mono text-sm font-bold ${status.open ? "text-neon" : "text-danger"}`}>
                  {status.label}
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { day: "Lundi", hours: "10h00 — 19h00", active: true },
                  { day: "Mardi", hours: "10h00 — 19h00", active: true },
                  { day: "Mercredi", hours: "10h00 — 19h00", active: true },
                  { day: "Jeudi", hours: "10h00 — 19h00", active: true },
                  { day: "Vendredi", hours: "10h00 — 19h00", active: true },
                  { day: "Samedi", hours: "10h00 — 19h00", active: true },
                  { day: "Dimanche", hours: "Ferme", active: false },
                ].map((row) => (
                  <div key={row.day} className="flex items-center justify-between py-2 border-b border-border">
                    <span className="font-mono text-sm text-text-muted">{row.day}</span>
                    <span className={`font-mono text-sm font-bold ${row.active ? "text-text" : "text-danger"}`}>
                      {row.hours}
                    </span>
                  </div>
                ))}
              </div>
            </div>

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
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-neon flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display font-bold text-text text-sm">CONTACT</p>
                    <a href={`tel:${brand.phoneIntl}`} className="font-mono text-sm text-neon hover:underline block mt-1 cursor-pointer transition-colors duration-200">
                      {brand.phone}
                    </a>
                    <a href={`mailto:${brand.email}`} className="font-mono text-sm text-text-muted hover:text-neon block mt-1 cursor-pointer transition-colors duration-200">
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
                      Lire les avis clients
                    </p>
                    <Link href="/avis" className="font-mono text-xs text-neon hover:underline mt-2 inline-block cursor-pointer transition-colors duration-200">
                      VOIR LES AVIS &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map */}
      <section>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="heading-md text-text mb-6 uppercase">Nous trouver</h2>
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
      </section>

      {/* Final CTA */}
      <section style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-neon mx-auto mb-4" />
          <h2 className="heading-md text-text mb-3 uppercase">Pret a reparer ?</h2>
          <p className="font-mono text-sm text-text-muted mb-8 max-w-lg mx-auto">
            Diagnostic 30€ et sans engagement. Deposez votre trottinette ou prenez rendez-vous en ligne.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/urgence" className="btn-neon">
              <Wrench className="w-4 h-4" />
              PRENDRE RDV
            </Link>
            <Link href="/diagnostic" className="btn-outline">
              <Zap className="w-4 h-4" />
              DIAGNOSTIC EN LIGNE
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
