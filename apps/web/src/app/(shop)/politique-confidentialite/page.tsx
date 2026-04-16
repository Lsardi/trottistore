import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Politique de confidentialite | ${brand.name}`,
  description: `Politique de confidentialite et RGPD de ${brand.name}`,
};

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <h1 className="heading-lg">POLITIQUE DE CONFIDENTIALITE</h1>

      <section className="space-y-2">
        <p className="spec-label">Base legale</p>
        <p className="font-mono text-sm text-text-muted">
          Les traitements reposent sur l&apos;execution du contrat, l&apos;obligation legale et l&apos;interet legitime.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Categories de donnees</p>
        <ul className="font-mono text-sm text-text-muted list-disc list-inside space-y-1">
          <li>Identité et coordonnées (nom, email, téléphone)</li>
          <li>Adresses de livraison et facturation</li>
          <li>Données de commande et paiement</li>
          <li>Données SAV (tickets de réparation, devis, pièces)</li>
          <li>Données de connexion (IP, horodatage)</li>
          <li>Inscription newsletter (email, date, source, consentement)</li>
          <li>Avis clients (note, commentaire, achat vérifié)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Finalites</p>
        <ul className="font-mono text-sm text-text-muted list-disc list-inside space-y-1">
          <li>Gestion des commandes et livraison</li>
          <li>Service après-vente et suivi des réparations</li>
          <li>Relation client et programme de fidélité</li>
          <li>Envoi de la newsletter (avec consentement explicite)</li>
          <li>Mesure d&apos;audience et amélioration du site (avec consentement)</li>
          <li>Sécurité et prévention de la fraude</li>
        </ul>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Durées de conservation</p>
        <ul className="font-mono text-sm text-text-muted list-disc list-inside space-y-1">
          <li>Comptes clients : durée de la relation commerciale + 3 ans</li>
          <li>Données de commande : 10 ans (obligation comptable)</li>
          <li>Newsletter : jusqu&apos;au désabonnement</li>
          <li>Données de connexion : 12 mois</li>
          <li>Tickets SAV : 5 ans après clôture</li>
        </ul>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Vos droits RGPD</p>
        <p className="font-mono text-sm text-text-muted">
          Vous disposez des droits d&apos;acces, rectification, effacement, opposition, limitation, portabilite et retrait du consentement.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Contact DPO</p>
        <p className="font-mono text-sm text-text-muted">
          Email : {brand.dpoEmail}
          <br />
          Adresse : {brand.address.street}, {brand.address.postalCode} {brand.address.city}
        </p>
        <p className="font-mono text-xs text-text-dim">
          Pour exercer vos droits (accès, rectification, effacement, portabilité), envoyez un email au DPO
          avec une copie de votre pièce d&apos;identité. Réponse sous 30 jours.
        </p>
      </section>
    </div>
  );
}
