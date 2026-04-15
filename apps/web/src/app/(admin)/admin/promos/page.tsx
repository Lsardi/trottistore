import { FeaturePlaceholder } from "@/components/admin/FeaturePlaceholder";

export default function AdminPromosPage() {
  return (
    <FeaturePlaceholder
      title="Promos & Bundles"
      purpose="Codes promo, packs produits, ventes croisées."
      whatItWillDo={
        <>
          Leviers de croissance côté catalogue :
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>Codes promo ciblés (client VIP, panier &gt; X€, première commande)</li>
            <li>Bundles &laquo; trottinette + casque + antivol &raquo; avec remise automatique</li>
            <li>Ventes croisées &laquo; les clients qui ont acheté X ont aussi pris Y &raquo;</li>
            <li>Campagnes temporaires (Black Friday, soldes)</li>
          </ul>
        </>
      }
    />
  );
}
