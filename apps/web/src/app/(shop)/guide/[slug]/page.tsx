import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";

interface GuideSection {
  heading: string;
  paragraphs: string[];
}

interface Guide {
  title: string;
  description: string;
  sections: GuideSection[];
  cta: { label: string; href: string };
}

const GUIDES: Record<string, Guide> = {
  "entretien-trottinette": {
    title: "Guide complet d'entretien de votre trottinette électrique",
    description: "Les contrôles essentiels pour prolonger la durée de vie de votre trottinette et éviter les pannes coûteuses. Par les techniciens de TrottiStore.",
    sections: [
      {
        heading: "Pneus : vérification toutes les 2 semaines",
        paragraphs: [
          "La pression des pneus est le facteur n°1 de confort et d'autonomie. Un pneu sous-gonflé augmente la résistance au roulement de 15 à 20%, réduit votre autonomie et accélère l'usure.",
          "Pour les pneus gonflables : maintenez 2.5 à 3 bars (vérifiez la recommandation du fabricant sur le flanc). Pour les pneus pleins : inspectez l'usure visuelle tous les 1000 km.",
          "Astuce : gardez une mini-pompe avec manomètre dans votre sac. Un check de 30 secondes avant chaque trajet évite 90% des crevaisons.",
        ],
      },
      {
        heading: "Freins : contrôle tous les 500 km",
        paragraphs: [
          "Des freins en bon état, c'est votre sécurité. Les plaquettes de frein à disque s'usent progressivement — quand l'épaisseur passe sous 1mm, remplacez-les immédiatement.",
          "Freins à tambour : vérifiez que le levier ne vient pas en butée. Si vous devez serrer de plus en plus fort, c'est signe d'usure. Freins hydrauliques : vérifiez le niveau de liquide et purgez si le freinage devient spongieux.",
          "Coût moyen d'un remplacement de plaquettes chez TrottiStore : 15€ à 40€ selon le modèle. Bien moins cher qu'une chute.",
        ],
      },
      {
        heading: "Batterie : les bonnes pratiques de charge",
        paragraphs: [
          "La batterie est le composant le plus cher de votre trottinette (200 à 500€). Quelques règles prolongent sa durée de vie de 2 à 3 ans :",
          "1) Ne descendez jamais sous 10% de charge. 2) Ne laissez pas la trottinette branchée 24h. 3) Stockez-la entre 40 et 80% si vous ne roulez pas pendant plus d'une semaine. 4) Évitez de charger immédiatement après un long trajet — laissez refroidir 15 minutes.",
          "Si votre autonomie a baissé de plus de 30% par rapport au neuf, un test de cellules en atelier permet de savoir s'il faut remplacer la batterie ou simplement recalibrer le BMS.",
        ],
      },
      {
        heading: "Direction et pliage : check mensuel",
        paragraphs: [
          "Le jeu de direction (le mécanisme qui relie le guidon à la roue avant) se desserre avec les vibrations. Un jeu de 2mm peut devenir dangereux à haute vitesse.",
          "Le système de pliage est un point de stress mécanique majeur. Vérifiez qu'il ne bouge pas en position verrouillée. Si vous sentez le moindre jeu latéral, faites-le resserrer ou remplacer en atelier.",
        ],
      },
      {
        heading: "Check-up atelier : tous les 6 mois",
        paragraphs: [
          "Même avec un entretien régulier, un check-up professionnel détecte des problèmes invisibles à l'oeil nu : cellules de batterie déséquilibrées, roulements usés, connectiques oxydées.",
          "Chez TrottiStore, le check-up complet inclut : test batterie, inspection freins, serrage général, test moteur et contrôleur. Durée : 30 minutes. Le diagnostic est gratuit si une intervention est nécessaire.",
        ],
      },
    ],
    cta: { label: "PRENDRE RDV POUR UN CHECK-UP", href: "/urgence" },
  },
  "choisir-trottinette": {
    title: "Comment choisir sa trottinette électrique en 2026",
    description: "Le guide d'achat complet par les experts TrottiStore. Usage, budget, autonomie : les vrais critères qui comptent.",
    sections: [
      {
        heading: "Définissez votre usage réel",
        paragraphs: [
          "Avant de regarder les specs, posez-vous une question simple : quel est mon trajet quotidien ? La réponse détermine 80% de votre choix.",
          "Trajet domicile-travail (< 10 km) : priorité au poids et à la compacité. Vous allez la porter dans le métro, les escaliers, au bureau. Visez moins de 15 kg. Exemples : Xiaomi Mi 4, Ninebot F2 Pro.",
          "Trajet moyen (10-25 km) : l'autonomie réelle (pas celle du fabricant, qui est mesurée à 15 km/h sur du plat) et le confort deviennent prioritaires. Pneus 10 pouces minimum. Exemples : Ninebot Max G30, Vsett 9+.",
          "Usage intensif ou performance : double moteur, suspension, freins hydrauliques. Le poids n'est plus un critère. Exemples : Dualtron Thunder 2, Kaabo Mantis King GT.",
        ],
      },
      {
        heading: "Le budget : ce que les prix signifient vraiment",
        paragraphs: [
          "Moins de 500€ : entrée de gamme correcte pour des trajets courts. Attention à la qualité des freins et à la disponibilité des pièces de rechange.",
          "500 à 1 000€ : le sweet spot. Bonnes performances, construction solide, pièces disponibles. C'est la gamme la plus vendue chez TrottiStore.",
          "1 000 à 2 000€ : performances sérieuses, double suspension, gros pneus. Pour ceux qui roulent tous les jours et veulent du confort.",
          "Plus de 2 000€ : machines de performance. Double moteur, autonomie 60+ km, vitesse 60+ km/h. Pour les passionnés.",
          "N'oubliez pas : nous proposons le paiement en 3x et 4x sans frais à partir de 300€.",
        ],
      },
      {
        heading: "L'autonomie : lisez entre les lignes",
        paragraphs: [
          "L'autonomie annoncée par le fabricant est TOUJOURS optimiste. Elle est mesurée avec un pilote de 70 kg, sur du plat, à 15-20 km/h, sans vent.",
          "Règle simple : divisez l'autonomie annoncée par 1.5 pour avoir l'autonomie réelle en conditions urbaines (poids moyen, dénivelé, arrêts fréquents).",
          "Si le fabricant annonce 45 km, comptez 30 km en réel. C'est suffisant ? Alors c'est le bon choix.",
        ],
      },
      {
        heading: "Le critère oublié : la disponibilité des pièces",
        paragraphs: [
          "Une trottinette bon marché dont on ne trouve pas les pièces devient un déchet au premier pneu crevé. C'est le piège n°1 des acheteurs Amazon.",
          "Chez TrottiStore, on ne vend que des marques dont on stocke les pièces : Dualtron, Xiaomi, Ninebot, Kaabo, Vsett, Segway, Inokim, Minimotors, Teverun. Votre trottinette sera réparable dans 5 ans.",
          "Utilisez notre outil de compatibilité pour vérifier la disponibilité des pièces avant d'acheter.",
        ],
      },
      {
        heading: "Pas sûr ? Faites le quiz ou venez essayer",
        paragraphs: [
          "Notre quiz en ligne vous recommande 3 modèles en 30 secondes, basé sur votre usage réel.",
          "Et si vous êtes dans le coin, venez essayer en boutique. Rien ne remplace 5 minutes de test pour savoir si une trottinette vous convient. On est au " + brand.address.street + ", " + brand.address.city + ".",
        ],
      },
    ],
    cta: { label: "FAIRE LE QUIZ", href: "/quiz" },
  },
  "panne-trottinette-que-faire": {
    title: "Panne de trottinette : que faire ? Guide de premiers secours",
    description: "Votre trottinette ne démarre plus, le frein lâche, l'écran est éteint ? Voici quoi faire avant de paniquer.",
    sections: [
      {
        heading: "Elle ne démarre plus",
        paragraphs: [
          "C'est la panne n°1. Avant de vous affoler : 1) Vérifiez que la batterie n'est pas à plat (branchez-la 30 min). 2) Vérifiez que le bouton power n'est pas bloqué. 3) Essayez de la démarrer en la branchant au chargeur.",
          "Si rien ne fonctionne, c'est probablement le contrôleur ou la carte mère. N'essayez pas de la démonter vous-même — un mauvais branchement peut griller la batterie (200-500€).",
          "Utilisez notre diagnostic en ligne pour identifier le problème et obtenir une estimation avant de vous déplacer.",
        ],
      },
      {
        heading: "Le frein ne répond plus",
        paragraphs: [
          "URGENCE SÉCURITÉ. Ne roulez pas. Même à 20 km/h, un freinage d'urgence sans frein peut provoquer une chute grave.",
          "Frein à disque mécanique : vérifiez que le câble n'est pas coupé ou que la plaquette n'est pas complètement usée. Si le levier est mou mais le câble intact, c'est probablement la plaquette.",
          "Frein hydraulique : si le levier est spongieux, il y a de l'air dans le circuit. Ça nécessite une purge en atelier (20-40€).",
        ],
      },
      {
        heading: "L'écran est éteint ou clignote",
        paragraphs: [
          "Un écran éteint ne signifie pas toujours une panne grave. Souvent c'est un faux contact dans la connectique qui relie l'écran au contrôleur.",
          "Si l'écran clignote ou affiche un code erreur, notez le code et utilisez notre diagnostic en ligne — chaque code a une signification précise.",
          "Remplacement d'écran : 20 à 80€ selon le modèle. C'est une réparation rapide (15-30 minutes).",
        ],
      },
      {
        heading: "Crevaison en route",
        paragraphs: [
          "Si vous avez un pneu à chambre à air (la majorité des trottinettes) : vous pouvez utiliser une bombe anti-crevaison en dépannage, mais c'est temporaire.",
          "La vraie réparation nécessite de démonter la roue pour remplacer la chambre. C'est faisable en DIY si vous êtes bricoleur (comptez 30-45 min la première fois). Sinon, en atelier c'est 15-30€ et 20 minutes.",
          "Conseil : gardez toujours une chambre à air de rechange chez vous. On les vend à partir de 8€.",
        ],
      },
      {
        heading: "Quand NE PAS réparer soi-même",
        paragraphs: [
          "Tout ce qui touche à la batterie (gonflement, odeur, chaleur anormale) : DANGER. Ne tentez rien, apportez-la en atelier.",
          "Tout ce qui touche au contrôleur ou au câblage interne : un mauvais branchement = court-circuit = composants grillés.",
          "En cas de doute, notre diagnostic en ligne est gratuit et vous dira en 2 minutes si c'est du DIY ou de l'atelier.",
        ],
      },
    ],
    cta: { label: "DIAGNOSTIC GRATUIT EN LIGNE", href: "/diagnostic" },
  },
};

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = GUIDES[slug];
  if (!guide) return {};
  return {
    title: `${guide.title} | ${brand.name}`,
    description: guide.description,
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = GUIDES[slug];
  if (!guide) return notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    author: { "@type": "Organization", name: brand.name },
    publisher: { "@type": "Organization", name: brand.name },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <p className="spec-label text-neon mb-3">GUIDE PRATIQUE</p>
      <h1 className="heading-lg mb-4">{guide.title}</h1>
      <p className="font-mono text-sm text-text-muted mb-10 max-w-xl">{guide.description}</p>

      {/* Table des matières */}
      <nav className="bg-surface border border-border p-5 mb-10">
        <p className="spec-label mb-3">SOMMAIRE</p>
        <ul className="space-y-2">
          {guide.sections.map((section, i) => (
            <li key={i}>
              <a
                href={`#section-${i}`}
                className="font-mono text-sm text-text-muted hover:text-neon transition-colors"
              >
                {i + 1}. {section.heading}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <div className="space-y-10">
        {guide.sections.map((section, i) => (
          <section key={i} id={`section-${i}`}>
            <h2 className="font-display font-bold text-text text-xl mb-4 uppercase">
              {section.heading}
            </h2>
            <div className="space-y-4">
              {section.paragraphs.map((p, j) => (
                <p key={j} className="font-mono text-sm text-text-muted leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
            {i < guide.sections.length - 1 && <div className="divider mt-10" />}
          </section>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-12 bg-surface border border-neon/20 p-8 text-center">
        <p className="font-mono text-sm text-text-muted mb-4">
          Besoin d&apos;aide ?
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={guide.cta.href} className="btn-neon">
            {guide.cta.label}
          </Link>
          <Link href="/guide" className="btn-outline">
            AUTRES GUIDES
          </Link>
        </div>
      </div>

      {/* Autres guides */}
      <div className="mt-10">
        <p className="spec-label mb-4">AUTRES GUIDES</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(GUIDES)
            .filter(([key]) => key !== slug)
            .map(([key, g]) => (
              <Link
                key={key}
                href={`/guide/${key}`}
                className="bg-surface border border-border p-4 hover:border-neon transition-colors group"
              >
                <p className="font-display font-bold text-text text-sm group-hover:text-neon transition-colors mb-1">
                  {g.title}
                </p>
                <p className="font-mono text-xs text-text-dim line-clamp-2">{g.description}</p>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
