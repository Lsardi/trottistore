/**
 * FAQ data — extracted for reuse in page metadata, JSON-LD schema, and search.
 */
export interface FaqQuestion {
  q: string;
  a: string;
}

export interface FaqSection {
  title: string;
  questions: FaqQuestion[];
}

export const FAQ_SECTIONS: FaqSection[] = [
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
