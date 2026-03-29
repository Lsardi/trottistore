import Link from "next/link";

export default async function ReparationSeoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const label = slug.replace(/-/g, " ");

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <p className="spec-label mb-2">RÉPARATION SPÉCIALISÉE</p>
      <h1 className="heading-lg mb-4">Réparation trottinette {label}</h1>
      <p className="font-mono text-sm text-text-muted mb-8">
        Prise en charge rapide, devis transparent et suivi en temps réel pour les pannes {label}.
      </p>
      <div className="bg-surface border border-border p-5">
        <p className="font-mono text-sm text-text mb-4">
          Besoin urgent ? Lancez un ticket SAV et réservez votre créneau atelier.
        </p>
        <Link href="/urgence" className="btn-neon inline-flex">
          Démarrer une demande urgente
        </Link>
      </div>
    </div>
  );
}
