# Challenge Audit Run 3 — 2026-04-12

## Scope
- Run 3 only (no duplicates Run 1 / Run 2)
- Bugs réels, reproductibles, avec preuve `file:line`
- Focus: RBAC CRM, auth e-commerce, intégrité données, déploiement

## Findings (Run 3)

| ID | Severity | Bug | Evidence | Impact |
|---|---|---|---|---|
| R3-01 | CRITICAL | CRM RBAC: `PUT /customers/:id/status` est accessible à tout rôle non-CLIENT et peut suspendre/bannir n'importe quel utilisateur | `services/crm/src/index.ts:146-155` (guard global = bloque seulement `CLIENT`) + `services/crm/src/routes/customers/index.ts:595-618` (update status sans contrôle de rôle/permission) + `packages/shared/src/auth.ts:109-114` (STAFF n'a que `customers:read`) | Un STAFF/TECHNICIAN peut désactiver des comptes arbitraires (y compris backoffice). |
| R3-02 | CRITICAL | CRM RBAC + intégrité: `POST /customers/merge` permet de fusionner des comptes arbitraires (pas limité aux clients) | `services/crm/src/routes/customers/index.ts:637-653` (aucun check sur rôle des comptes) + `services/crm/src/routes/customers/index.ts:668-687` (réassignation commandes/tickets/adresses/reviews) + `services/crm/src/index.ts:146-155` | Prise de contrôle/fusion abusive de comptes internes, corruption transverse des données. |
| R3-03 | HIGH | CRM RBAC: écriture segments ouverte à tous les non-CLIENT | `services/crm/src/routes/segments/index.ts:76` (`POST /segments`) + `services/crm/src/routes/segments/index.ts:99` (`POST /segments/:id/evaluate`) + `services/crm/src/index.ts:146-155` + `packages/shared/src/auth.ts:93-103` (`MANAGER` = `segments:read` uniquement) | Segmentation marketing modifiable par des rôles non autorisés. |
| R3-04 | HIGH | CRM RBAC: envoi de campagne (`POST /campaigns/:id/send`) ouvert à tous les non-CLIENT | `services/crm/src/routes/campaigns/index.ts:266` (pas de preHandler RBAC) + `services/crm/src/routes/campaigns/index.ts:338-343` (envoi email effectif) + `services/crm/src/index.ts:146-155` + `packages/shared/src/auth.ts:98-99` (`MANAGER` = `campaigns:read` seulement) | Un rôle non habilité peut déclencher des envois massifs. |
| R3-05 | HIGH | CRM RBAC: export newsletter admin accessible sans contrôle de rôle fin | `services/crm/src/routes/newsletter/index.ts:156` (commentaire "ADMIN+"), `services/crm/src/routes/newsletter/index.ts:224` (route sans guard) + `services/crm/src/index.ts:146-155` | Exfiltration possible de la base abonnés (emails + statuts RGPD) par rôles non autorisés. |
| R3-06 | CRITICAL | Escalade de privilège: un `ADMIN` peut créer/promouvoir un `SUPERADMIN` | `services/ecommerce/src/routes/admin-users/index.ts:50` (`ADMIN` autorisé sur route) + `services/ecommerce/src/routes/admin-users/index.ts:21` (`SUPERADMIN` autorisé dans `STAFF_ROLES`) + `services/ecommerce/src/routes/admin-users/index.ts:183` (create role direct) + `services/ecommerce/src/routes/admin-users/index.ts:263` (update role direct) | Élévation de privilège verticale sans garde-fou. |
| R3-07 | HIGH | Auth crash: staff invité peut provoquer un 500 au login (hash null) | `services/ecommerce/src/routes/admin-users/index.ts:185-186` (`passwordHash: null`, `status: ACTIVE`) + `services/ecommerce/src/routes/auth/index.ts:254` (`bcrypt.compare` sans garde) | Login casse en 500 avant onboarding mot de passe. |
| R3-08 | HIGH | RGPD suppression compte: mauvaises interactions supprimées (ou aucune) | `services/ecommerce/src/routes/auth/index.ts:682` (`customerId: profile.id`) + `packages/database/prisma/schema.prisma:622` (`customerId`) + `packages/database/prisma/schema.prisma:631` (`customerId` réfère `User.id`) + `packages/database/prisma/schema.prisma:580-582` (`profile.id` ≠ `userId`) | Données d'interactions personnelles potentiellement conservées après "suppression" compte. |
| R3-09 | HIGH | Double comptage CRM pour commandes guest payées | `services/ecommerce/src/routes/orders/index.ts:918-924` (initialise `totalOrders=1`, `totalSpent=totalTtc` dès création) + `services/ecommerce/src/routes/checkout/index.ts:782-783` (ré-incrémente `totalOrders` + `totalSpent` au webhook paiement) | `totalOrders`/`totalSpent` gonflés sur le profil client guest. |
| R3-10 | MEDIUM | Commande manuelle `DELIVERY` stocke adresses vides | `services/ecommerce/src/routes/orders/index.ts:1981` (DELIVERY autorisé) + `services/ecommerce/src/routes/orders/index.ts:2060-2061` (`shippingAddress: {}`, `billingAddress: {}`) | Livraison/facturation manuelle sans adresse exploitable. |
| R3-11 | MEDIUM | Script de déploiement: health check port faux pour 3 services | `infra/deploy.sh:27` (utilise `3001` pour `crm`, `analytics`, `sav`) | Vérification santé post-déploiement fausse (`PENDING`/KO fantômes). |

## Summary
- Nouveaux bugs trouvés dans ce run: **11**
- Priorités immédiates: **R3-01, R3-02, R3-06, R3-08, R3-09**
- Zones chaudes: **RBAC CRM**, **admin-users privilege boundary**, **lifecycle data integrity**
