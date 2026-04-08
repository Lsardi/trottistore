import type { Metadata } from "next";
import Link from "next/link";
import { Truck, RotateCcw, Clock, MapPin } from "lucide-react";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Livraison & Retours | ${brand.name}`,
  description:
    "Conditions de livraison, délais, frais de port et politique de retour TrottiStore. Livraison France 48h, retour gratuit 14 jours.",
};

const DELIVERY_OPTIONS = [
  {
    icon: Truck,
    title: "Livraison standard",
    delay: "48 à 72h ouvrées",
    price: "6,90 € — Gratuit dès 100 € d'achat",
    details: "Colissimo suivi. Numéro de tracking envoyé par email dès l'expédition.",
  },
  {
    icon: MapPin,
    title: "Retrait en boutique",
    delay: "Disponible sous 1h",
    price: "Gratuit",
    details: `Retirez votre commande au ${brand.address.street}, ${brand.address.postalCode} ${brand.address.city}. Présentez votre email de confirmation.`,
  },
];

export default function LivraisonPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="heading-xl mb-2">LIVRAISON & RETOURS</h1>
      <p className="font-mono text-sm text-text-muted mb-10">
        Tout ce que vous devez savoir avant de commander.
      </p>

      {/* Delivery options */}
      <section className="space-y-4 mb-12">
        <p className="spec-label">MODES DE LIVRAISON</p>
        {DELIVERY_OPTIONS.map((opt) => (
          <div
            key={opt.title}
            className="bg-surface border border-border p-5"
          >
            <div className="flex items-start gap-4">
              <opt.icon style={{ width: 24, height: 24, color: "var(--color-neon)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <h2 className="font-display font-bold text-text text-sm mb-1">{opt.title}</h2>
                <p className="font-mono text-xs text-neon mb-1">{opt.delay}</p>
                <p className="font-mono text-xs text-text-muted mb-2">{opt.price}</p>
                <p className="font-mono text-xs text-text-dim">{opt.details}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Returns */}
      <section className="mb-12">
        <p className="spec-label mb-4">POLITIQUE DE RETOUR</p>
        <div className="bg-surface border border-border p-5">
          <div className="flex items-start gap-4">
            <RotateCcw style={{ width: 24, height: 24, color: "var(--color-neon)", flexShrink: 0, marginTop: 2 }} />
            <div className="space-y-3 font-mono text-sm text-text-muted">
              <p>
                <strong className="text-text">Retour sous 14 jours.</strong>{" "}
                Conformément au Code de la consommation, vous disposez d&apos;un délai de 14 jours
                à compter de la réception pour retourner votre article, sans avoir à justifier de motif.
              </p>
              <p>
                <strong className="text-text">Conditions :</strong>{" "}
                Le produit doit être retourné dans son emballage d&apos;origine, complet, non utilisé
                et en parfait état. Les frais de retour sont à la charge du client sauf produit défectueux.
              </p>
              <p>
                <strong className="text-text">Remboursement :</strong>{" "}
                Sous 14 jours après réception et vérification du retour. Même moyen de paiement que la commande.
              </p>
              <p>
                Pour initier un retour, contactez-nous à{" "}
                <a href={`mailto:${brand.email}`} className="text-neon underline">{brand.email}</a>{" "}
                ou au <a href={`tel:${brand.phoneIntl}`} className="text-neon">{brand.phone}</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Warranty */}
      <section className="mb-12">
        <p className="spec-label mb-4">GARANTIE</p>
        <div className="bg-surface border border-border p-5">
          <div className="flex items-start gap-4">
            <Clock style={{ width: 24, height: 24, color: "var(--color-neon)", flexShrink: 0, marginTop: 2 }} />
            <div className="space-y-3 font-mono text-sm text-text-muted">
              <p>
                <strong className="text-text">Garantie légale de conformité : 2 ans.</strong>{" "}
                Tous nos produits bénéficient de la garantie légale de conformité (articles L217-1 et suivants du Code de la consommation).
              </p>
              <p>
                <strong className="text-text">Garantie des vices cachés.</strong>{" "}
                Vous bénéficiez également de la garantie légale des vices cachés (articles 1641 à 1649 du Code civil).
              </p>
              <p>
                En cas de panne sous garantie, déposez un ticket SAV sur notre{" "}
                <Link href="/reparation" className="text-neon underline">page réparation</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="divider my-8" />
      <div className="text-center">
        <Link href="/produits" className="btn-neon">VOIR LE CATALOGUE</Link>
      </div>
    </main>
  );
}
