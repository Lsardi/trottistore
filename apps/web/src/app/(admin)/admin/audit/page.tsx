import { FeaturePlaceholder } from "@/components/admin/FeaturePlaceholder";

export default function AdminAuditPage() {
  return (
    <FeaturePlaceholder
      title="Journal d'audit"
      purpose="Qui a fait quoi dans l'admin, quand, et sur quelle ressource."
      whatItWillDo={
        <>
          Indispensable dès qu&apos;on est plusieurs dans l&apos;admin — protège l&apos;équipe
          et satisfait la CNIL :
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>Log de toutes les mutations admin (création, édition, suppression)</li>
            <li>Qui ? Quoi ? Quand ? Avant / après</li>
            <li>Filtre par utilisateur, par ressource, par période</li>
            <li>
              Export/suppression données client RGPD (art. 15 &amp; 17) en self-service
            </li>
            <li>Rétention configurable, purge automatique</li>
          </ul>
        </>
      }
    />
  );
}
