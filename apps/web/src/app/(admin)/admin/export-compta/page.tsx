import { FeaturePlaceholder } from "@/components/admin/FeaturePlaceholder";

export default function AdminExportComptaPage() {
  return (
    <FeaturePlaceholder
      title="Export comptable"
      purpose="Export des écritures pour l'expert-comptable."
      whatItWillDo={
        <>
          Générer les exports attendus par un cabinet comptable français :
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>
              <strong>FEC</strong> (Fichier des Écritures Comptables) — format officiel
              imposé par la DGFiP pour les contrôles
            </li>
            <li>Export Sage, Cegid, Pennylane, Quadra</li>
            <li>Période paramétrable (mois, trimestre, année fiscale)</li>
            <li>Écritures ventes, encaissements, remboursements, TVA collectée par taux</li>
            <li>Rapprochement avec le grand livre financier interne</li>
          </ul>
        </>
      }
    />
  );
}
