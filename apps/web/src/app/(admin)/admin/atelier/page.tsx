import { FeaturePlaceholder } from "@/components/admin/FeaturePlaceholder";

export default function AdminAtelierPage() {
  return (
    <FeaturePlaceholder
      title="Atelier"
      purpose="Hub atelier — ordres de réparation, devis, RMA, calendrier."
      whatItWillDo={
        <>
          Ce hub remplacera progressivement <code className="text-neon">/admin/sav</code> pour
          couvrir tout le workflow atelier :
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>Ordres de réparation (OR) avec main d&apos;œuvre + pièces consommées (décrément stock automatique)</li>
            <li>Devis client PDF signé avant travaux (obligation légale FR au-dessus d&apos;un seuil)</li>
            <li>Workflow RMA structuré (retour → diagnostic → réparation/remplacement/remboursement)</li>
            <li>Calendrier des rendez-vous atelier</li>
            <li>Suivi numéros de série par trottinette</li>
          </ul>
        </>
      }
    />
  );
}
