import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Mentions legales | ${brand.name}`,
  description: `Mentions legales de ${brand.name}`,
};

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <h1 className="heading-lg">MENTIONS LEGALES</h1>

      <section className="space-y-3">
        <p className="spec-label">Editeur du site</p>
        <p className="font-mono text-sm text-text-muted">
          Raison sociale: {brand.name}
          <br />
          SIRET: [SIRET À COMPLÉTER]
          <br />
          RCS: [RCS À COMPLÉTER]
          <br />
          Capital social: [CAPITAL À COMPLÉTER]
          <br />
          Adresse: {brand.address.street}, {brand.address.postalCode} {brand.address.city}
        </p>
      </section>

      <section className="space-y-3">
        <p className="spec-label">Direction de la publication</p>
        <p className="font-mono text-sm text-text-muted">Directeur de publication: [NOM À COMPLÉTER]</p>
      </section>

      <section className="space-y-3">
        <p className="spec-label">Hebergeur</p>
        <p className="font-mono text-sm text-text-muted">
          [HÉBERGEUR À COMPLÉTER]
          <br />
          [ADRESSE HÉBERGEUR À COMPLÉTER]
        </p>
      </section>

      <section className="space-y-3">
        <p className="spec-label">Contact</p>
        <p className="font-mono text-sm text-text-muted">
          Tel: {brand.phone}
          <br />
          Email: {brand.email}
        </p>
      </section>

      <section className="space-y-3">
        <p className="spec-label">Contact DPO</p>
        <p className="font-mono text-sm text-text-muted">
          Email DPO: {brand.email}
          <br />
          Courrier: {brand.address.street}, {brand.address.postalCode} {brand.address.city}
        </p>
      </section>
    </div>
  );
}
