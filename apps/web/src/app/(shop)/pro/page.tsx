import Link from "next/link";

export const metadata = {
  title: "Offre PRO flottes",
  description: "Maintenance et réparation de flottes de trottinettes pour entreprises et livreurs.",
};

const plans = [
  { name: "Starter", desc: "Jusqu'à 10 trottinettes, diagnostic prioritaire", price: "À partir de 199€/mois" },
  { name: "Scale", desc: "Jusqu'à 50 trottinettes, SLA 24h", price: "À partir de 699€/mois" },
  { name: "Fleet+", desc: "Flotte illimitée, interlocuteur dédié", price: "Sur devis" },
];

export default function ProPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <p className="spec-label mb-3">B2B / FLOTTES</p>
      <h1 className="heading-lg mb-4">Maintenance pour pros</h1>
      <p className="font-mono text-sm text-text-muted max-w-3xl mb-8">
        Pour livreurs, entreprises et opérateurs locaux: entretien, réparations rapides et reporting mensuel.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {plans.map((plan) => (
          <div key={plan.name} className="bg-surface border border-border p-5">
            <h2 className="heading-md mb-2">{plan.name}</h2>
            <p className="font-mono text-sm text-text-muted mb-4">{plan.desc}</p>
            <p className="font-mono text-sm text-neon">{plan.price}</p>
          </div>
        ))}
      </div>

      <Link href="/urgence" className="btn-neon inline-flex">
        Demander un rappel pro
      </Link>
    </div>
  );
}
