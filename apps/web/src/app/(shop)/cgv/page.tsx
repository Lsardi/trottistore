import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `CGV | ${brand.name}`,
  description: `Conditions generales de vente de ${brand.name}`,
};

export default function CgvPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <h1 className="heading-lg">CONDITIONS GENERALES DE VENTE (CGV)</h1>

      <section className="space-y-2">
        <p className="spec-label">1. Objet</p>
        <p className="font-mono text-sm text-text-muted">
          Les presentes CGV regissent les ventes conclues sur {brand.name} ({brand.domain}).
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">2. Prix</p>
        <p className="font-mono text-sm text-text-muted">
          Les prix affiches sont exprimes en euros TTC, hors frais de livraison le cas echeant.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">3. Paiement</p>
        <p className="font-mono text-sm text-text-muted">
          Le paiement est exigible a la commande via les moyens proposes au checkout.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">4. Livraison</p>
        <p className="font-mono text-sm text-text-muted">
          Les conditions et delais de livraison/retrait sont precises lors de la commande.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">5. Droit de retractation</p>
        <p className="font-mono text-sm text-text-muted">
          Conformement au Code de la consommation, le client dispose d&apos;un delai de retractation de 14 jours.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">6. Garantie legale</p>
        <p className="font-mono text-sm text-text-muted">
          Les produits beneficient de la garantie legale de conformite de 2 ans et de la garantie contre les vices caches.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">7. Médiation</p>
        <p className="font-mono text-sm text-text-muted">
          Conformément aux articles L611-1 et suivants du Code de la consommation, en cas de litige non résolu,
          vous pouvez recourir gratuitement au service de médiation FEVAD (Fédération du e-commerce et de la vente à distance) :
          mediateurduecommerce.fr — 60 rue La Boétie, 75008 Paris.
          Avant de saisir le médiateur, vous devez avoir contacté notre service client pour tenter de résoudre le litige.
        </p>
      </section>

      <section className="space-y-2">
        <p className="spec-label">8. Loi applicable</p>
        <p className="font-mono text-sm text-text-muted">Les presentes CGV sont soumises au droit francais.</p>
      </section>
    </div>
  );
}
