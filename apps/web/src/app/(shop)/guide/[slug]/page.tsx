import { notFound } from "next/navigation";

const GUIDES: Record<
  string,
  { title: string; description: string; content: string[] }
> = {
  "entretien-trottinette": {
    title: "Entretien trottinette électrique",
    description: "Les contrôles essentiels pour éviter les pannes coûteuses.",
    content: [
      "Vérifier la pression des pneus toutes les 2 semaines.",
      "Contrôler l'usure des freins tous les 500 km.",
      "Inspecter le jeu de direction et le système de pliage.",
      "Faire un check-up atelier tous les 6 mois.",
    ],
  },
  "choisir-trottinette": {
    title: "Quelle trottinette choisir",
    description: "Comment choisir selon votre usage réel (ville, distance, confort).",
    content: [
      "Trajets < 8 km/jour: privilégier le poids et la compacité.",
      "Trajets 8-20 km/jour: autonomie réelle et confort.",
      "Usage intensif: fiabilité SAV + disponibilité pièces.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = GUIDES[slug];
  if (!guide) return notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <p className="spec-label mb-2">GUIDE PRATIQUE</p>
      <h1 className="heading-lg mb-4">{guide.title}</h1>
      <p className="font-mono text-sm text-text-muted mb-8">{guide.description}</p>
      <div className="space-y-3">
        {guide.content.map((line) => (
          <p key={line} className="font-mono text-sm text-text">
            • {line}
          </p>
        ))}
      </div>
    </div>
  );
}
