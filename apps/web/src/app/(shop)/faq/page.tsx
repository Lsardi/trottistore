import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Questions fréquentes | ${brand.name}`,
  description:
    "Réponses aux questions fréquentes sur la livraison, le paiement, la réparation et le SAV TrottiStore.",
};

const FAQ_SECTIONS = [
  {
    title: "COMMANDE & PAIEMENT",
    questions: [
      {
        q: "Quels moyens de paiement acceptez-vous ?",
        a: "Carte bancaire (Visa, Mastercard), Apple Pay, Google Pay, Link et virement bancaire. Paiement en 3x et 4x sans frais disponible à partir de 300 €.",
      },
      {
        q: "Comment fonctionne le paiement en plusieurs fois ?",
        a: "Le paiement en 3x ou 4x sans frais est disponible pour les commandes de plus de 300 €. La première échéance est prélevée à la commande, les suivantes mensuellement.",
      },
      {
        q: "Puis-je commander sans créer de compte ?",
        a: "Oui, nous proposons le checkout invité. Vous renseignez votre email et votre adresse de livraison directement lors de la commande.",
      },
    ],
  },
  {
    title: "LIVRAISON & RETOURS",
    questions: [
      {
        q: "Quels sont les délais de livraison ?",
        a: "Livraison standard en 48 à 72h ouvrées via Colissimo suivi. Retrait en boutique disponible sous 1h à L'Île-Saint-Denis.",
      },
      {
        q: "Les frais de port sont-ils offerts ?",
        a: "Oui, la livraison est gratuite pour toute commande supérieure à 100 € HT. En dessous, les frais de port sont de 6,90 €.",
      },
      {
        q: "Comment retourner un produit ?",
        a: "Vous disposez de 14 jours après réception pour retourner un article. Contactez-nous par email ou téléphone pour obtenir un bon de retour. Le remboursement est effectué sous 14 jours.",
      },
    ],
  },
  {
    title: "RÉPARATION & SAV",
    questions: [
      {
        q: "Quelles marques de trottinettes réparez-vous ?",
        a: "Toutes les marques : Dualtron, Xiaomi, Ninebot, Kaabo, Vsett, Segway, Inokim, Minimotors, Teverun, Kuickwheel et plus encore.",
      },
      {
        q: "Combien coûte une réparation ?",
        a: "Le diagnostic est gratuit. Les réparations courantes (pneu, frein, display) vont de 10 € à 150 €. Les interventions lourdes (contrôleur, batterie) de 100 € à 400 €. Utilisez notre outil de diagnostic en ligne pour une estimation.",
      },
      {
        q: "Quel est le délai de réparation ?",
        a: "Réparations simples : 1 à 2 heures. Interventions complexes : 1 à 3 jours ouvrés. Vous pouvez suivre l'avancement en temps réel depuis votre espace client.",
      },
      {
        q: "La réparation est-elle garantie ?",
        a: "Oui, chaque intervention est garantie 6 mois pièces et main d'œuvre.",
      },
    ],
  },
  {
    title: "GARANTIE",
    questions: [
      {
        q: "Quelle est la garantie sur les produits ?",
        a: "Tous nos produits bénéficient de la garantie légale de conformité de 2 ans. Certains fabricants offrent une garantie constructeur supplémentaire.",
      },
      {
        q: "Comment faire jouer la garantie ?",
        a: "Déposez un ticket SAV sur notre page réparation en précisant le numéro de série et la description du problème. Notre équipe vous contactera sous 24h.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="heading-xl mb-2">QUESTIONS FRÉQUENTES</h1>
      <p className="font-mono text-sm text-text-muted mb-10">
        Vous ne trouvez pas la réponse ? Contactez-nous au{" "}
        <a href={`tel:${brand.phoneIntl}`} className="text-neon">{brand.phone}</a>.
      </p>

      {FAQ_SECTIONS.map((section) => (
        <section key={section.title} className="mb-10">
          <p className="spec-label mb-4">{section.title}</p>
          <div className="space-y-3">
            {section.questions.map((faq) => (
              <details
                key={faq.q}
                className="bg-surface border border-border group"
              >
                <summary
                  className="font-mono text-sm text-text font-bold px-5 py-4 cursor-pointer select-none list-none flex items-center justify-between"
                >
                  {faq.q}
                  <span className="text-text-dim ml-4 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-4 font-mono text-sm text-text-muted">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <div className="divider my-8" />
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/reparation" className="btn-neon">DÉPOSER UN TICKET SAV</Link>
        <Link href="/diagnostic" className="btn-outline">DIAGNOSTIC EN LIGNE</Link>
      </div>

      {/* FAQ Schema.org (en plus de celui du layout global) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_SECTIONS.flatMap((s) =>
              s.questions.map((faq) => ({
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: { "@type": "Answer", text: faq.a },
              }))
            ),
          }),
        }}
      />
    </main>
  );
}
