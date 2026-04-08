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
        <p className="font-mono text-sm text-text-muted">
          Identite, coordonnees, adresses, donnees de commande, donnees SAV, donnees de connexion.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Finalites</p>
        <p className="font-mono text-sm text-text-muted">
          Gestion des commandes, livraison, service apres-vente, relation client, securite et prevention de la fraude.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">Durées de conservation</p>
        <p className="font-mono text-sm text-text-muted">
          Les donnees sont conservees pendant la duree necessaire a la finalite et aux obligations legales applicables.
        </p>
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
          Email: {brand.email}
          <br />
          Adresse: {brand.address.street}, {brand.address.postalCode} {brand.address.city}
        </p>
      </section>
    </div>
  );
}
