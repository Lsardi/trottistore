import { brand } from "@/lib/brand";

export const metadata = {
  title: "Atelier trottinette",
  description: "Atelier TrottiStore: diagnostic, réparation, entretien toutes marques.",
};

export default function AtelierPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <p className="spec-label mb-3">ATELIER LOCAL</p>
      <h1 className="heading-lg mb-4">L&apos;atelier TrottiStore</h1>
      <p className="font-mono text-sm text-text-muted max-w-3xl">
        Diagnostic, devis transparent et réparation sur place à {brand.address.city}. Notre équipe traite les pannes
        urgentes et les entretiens préventifs du lundi au samedi.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="bg-surface border border-border p-4">
          <p className="spec-label mb-2">Adresse</p>
          <p className="font-mono text-sm">{brand.address.street}</p>
          <p className="font-mono text-sm">{brand.address.postalCode} {brand.address.city}</p>
        </div>
        <div className="bg-surface border border-border p-4">
          <p className="spec-label mb-2">Horaires</p>
          <p className="font-mono text-sm">Lun - Sam: 10:00 - 19:00</p>
          <p className="font-mono text-sm">Dimanche: fermé</p>
        </div>
        <div className="bg-surface border border-border p-4">
          <p className="spec-label mb-2">Contact</p>
          <p className="font-mono text-sm">{brand.phone}</p>
          <p className="font-mono text-sm">{brand.email}</p>
        </div>
      </div>
    </div>
  );
}
