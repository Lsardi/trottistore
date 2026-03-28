# TODO Tech Lead — Fond En Comble

Date: 2026-03-28  
Branch: `techlead/fond-comble-audit`

## P0 — Sécurité / Contrats critiques

- [x] Réactiver un périmètre auth homogène sur `crm`, `sav`, `analytics`.
- [x] Isoler Playwright du boot monorepo complet.
- [x] Rendre `pnpm audit --audit-level=high` bloquant en CI.
- [ ] Ajouter des tests d'autorisation négatifs sur endpoints sensibles CRM/SAV/Analytics.

## P1 — Type contracts (en cours)

- [x] Retirer `any` sur helpers critiques checkout/cart (`services/ecommerce/routes/orders`, `services/ecommerce/routes/cart`).
- [x] Retirer `any` sur extraction `error.code` dans handlers globaux (4 services).
- [ ] Retirer `any` sur `services/crm/routes/customers`.
- [ ] Retirer `any` sur `services/crm/routes/segments`.
- [ ] Retirer `any` sur `services/ecommerce/routes/products` et `categories` (`where/orderBy` Prisma).
- [ ] Retirer `any` sur `services/ecommerce/routes/admin` (catch/updateData).

## P1 — CI / Qualité

- [x] Reporter Playwright HTML + artifacts upload en CI.
- [ ] Exécuter une vraie passe E2E complète en GitHub Actions et analyser les flakiness.
- [ ] Ajouter une commande lint non-interactive pour `apps/web` (éviter le prompt `next lint`).

## P2 — Opérations

- [x] Ajouter runbook release + rollback.
- [ ] Ajouter template postmortem incident (SLA, timeline, action items).
- [ ] Ajouter checklist “go/no-go” PR release dans `.github/PULL_REQUEST_TEMPLATE.md`.

## Rythme d'exécution proposé

1. Finaliser `audit-p1-type-contracts` (reste CRM + ecommerce admin/products).
2. Lancer `audit-p1-e2e-hardening` complet en CI.
3. Ouvrir batch `audit-p2-ops-governance` (templates + checklists).
