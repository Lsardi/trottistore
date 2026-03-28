# TODO Tech Lead — Fond En Comble

Date: 2026-03-28  
Branch: `techlead/fond-comble-audit`

## P0 Sécurité

- [x] Périmètre auth de service appliqué (`crm`, `sav`, `analytics`).
- [x] CI security gate bloquant (`pnpm audit --audit-level=high`).
- [x] Ajouter tests d'autorisation négatifs sur endpoints sensibles.

## P1 Contrats TypeScript

- [x] Nettoyage `any` sur checkout/cart (`services/ecommerce/routes/orders`, `services/ecommerce/routes/cart`).
- [x] Nettoyage `any` sur handlers d'erreur globaux (4 services).
- [x] Nettoyage `any` CRM (`routes/customers`, `routes/segments`, `routes/campaigns`).
- [x] Nettoyage `any` `services/ecommerce/routes/products`.
- [x] Nettoyage `any` `services/ecommerce/routes/categories`.
- [x] Nettoyage `any` `services/ecommerce/routes/admin`.
- [x] Nettoyage `any` `services/ecommerce/routes/auth`.
- [x] Nettoyage `any` `services/sav/routes/tickets`.

## P1 Qualité CI/E2E

- [x] Reporter Playwright HTML en CI + artifacts upload.
- [ ] Exécuter passe E2E complète sur GitHub Actions et traiter les flaky tests.
- [x] Rendre lint web non-interactif (éviter prompt Next lint).

## P2 Ops

- [x] Runbook release/rollback documenté.
- [ ] Ajouter template postmortem incident.
- [ ] Ajouter checklist go/no-go release dans PR template.

## Next Batch immédiat

1. Passe E2E complète GitHub Actions + traitement flakiness.
2. Ajouter template postmortem incident.
3. Ajouter checklist go/no-go release dans PR template.
