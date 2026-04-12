import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Mentions legales | ${brand.name}`,
  description: `Mentions legales de ${brand.name}`,
};

/**
 * Mentions légales — LCEN art. 6-III.
 *
 * All legal values are read from NEXT_PUBLIC_LEGAL_* env vars.
 * The site owner sets them in the deployment dashboard (Railway, Vercel, etc.)
 * without touching the code. If a value is empty, "Non renseigné" is shown.
 */
function legal(value: string, fallback = "Non renseigné"): string {
  return value || fallback;
}

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <h1 className="heading-lg">MENTIONS LÉGALES</h1>

      <section className="space-y-3">
        <p className="spec-label">Éditeur du site</p>
        <p className="font-mono text-sm text-text-muted">
          Raison sociale : {brand.name}
          <br />
          Forme juridique : {legal(brand.legal.legalForm)}
          <br />
          SIRET : {legal(brand.legal.siret)}
          <br />
          RCS : {legal(brand.legal.rcs)}
          <br />
          Capital social : {legal(brand.legal.capital)}
          <br />
          TVA intracommunautaire : {legal(brand.legal.tvaIntracom)}
          <br />
          Adresse : {brand.address.street}, {brand.address.postalCode} {brand.address.city}
          <br />
          Téléphone : {brand.phone}
          <br />
          Email : {brand.email}
        </p>
      </section>

      <section className="space-y-3">
        <p className="spec-label">Direction de la publication</p>
        <p className="font-mono text-sm text-text-muted">
          Directeur de publication : {legal(brand.legal.director)}
        </p>
      </section>

      <section className="space-y-3">
        <p className="spec-label">Hébergeur</p>
        <p className="font-mono text-sm text-text-muted">
          Railway Corp. — railway.app
          <br />
          548 Market St, San Francisco, CA 94104, USA
        </p>
      </section>

      <section className="space-y-3">
        <p className="spec-label">Contact DPO</p>
        <p className="font-mono text-sm text-text-muted">
          Email DPO : {brand.dpoEmail}
          <br />
          Courrier : {brand.address.street}, {brand.address.postalCode} {brand.address.city}
        </p>
      </section>

      <section className="space-y-3">
        <p className="spec-label">Propriété intellectuelle</p>
        <p className="font-mono text-sm text-text-muted">
          L&apos;ensemble du contenu de ce site est protégé par les lois françaises et internationales
          relatives à la propriété intellectuelle. Toute reproduction est interdite sauf autorisation
          écrite préalable.
        </p>
      </section>

      <section className="space-y-3">
        <p className="spec-label">Données personnelles</p>
        <p className="font-mono text-sm text-text-muted">
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, de suppression
          et de portabilité de vos données personnelles. Contactez notre DPO à {brand.dpoEmail}.
        </p>
      </section>
    </div>
  );
}
