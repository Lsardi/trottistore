import { FeaturePlaceholder } from "@/components/admin/FeaturePlaceholder";

export default function AdminFeedsPage() {
  return (
    <FeaturePlaceholder
      title="Feeds marketplaces"
      purpose="Export catalogue vers comparateurs et places de marché."
      whatItWillDo={
        <>
          Diffusion du catalogue vers des canaux tiers :
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>
              <strong>Google Shopping</strong> — feed XML produits éligibles, statut de
              diffusion, erreurs par item
            </li>
            <li>
              <strong>Back Market</strong> — critique sur le marché mobilité
              reconditionnée/occasion
            </li>
            <li><strong>Leboncoin Pro</strong> — pour la seconde vie</li>
            <li>Mapping attributs produit → schéma marketplace, synchronisation stock</li>
          </ul>
        </>
      }
    />
  );
}
