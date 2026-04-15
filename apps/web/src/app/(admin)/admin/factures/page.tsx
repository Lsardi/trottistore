import { FeaturePlaceholder } from "@/components/admin/FeaturePlaceholder";

export default function AdminFacturesPage() {
  return (
    <FeaturePlaceholder
      title="Factures"
      purpose="Factures et avoirs conformes à la législation française."
      whatItWillDo={
        <>
          Aujourd&apos;hui une facture PDF est générée par commande. Cette page sera le
          registre centralisé :
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>Liste chronologique des factures (numérotation séquentielle non modifiable)</li>
            <li>Mentions légales FR obligatoires (SIRET, RCS, TVA intracom)</li>
            <li>Gestion des avoirs (rectification vs remboursement)</li>
            <li>TVA multi-taux par commande</li>
            <li>Recherche par numéro, client, date, statut paiement</li>
          </ul>
        </>
      }
    />
  );
}
