import { FeaturePlaceholder } from "@/components/admin/FeaturePlaceholder";

export default function AdminFournisseursPage() {
  return (
    <FeaturePlaceholder
      title="Fournisseurs"
      purpose="Base fournisseurs, bons de commande, marge réelle par produit."
      whatItWillDo={
        <>
          Le volet achats qui manque aujourd&apos;hui — sans ça, impossible de connaître
          ta vraie marge :
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>Base fournisseurs (contact, délais, conditions de paiement, devise)</li>
            <li>Bons de commande (PO) avec suivi état livraison</li>
            <li>Coût d&apos;achat moyen pondéré par variante (CMP)</li>
            <li>Marge réelle par produit / catégorie / fournisseur</li>
            <li>Alerte reliquat : &laquo; fournisseur en retard &raquo;</li>
          </ul>
        </>
      }
    />
  );
}
