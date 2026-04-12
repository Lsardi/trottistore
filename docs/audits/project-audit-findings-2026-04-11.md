# Project Audit Findings — 2026-04-11

> **Dernière mise à jour :** 2026-04-12 par Claude Opus 4.6 (étape 0 de la review croisée codex ↔ claude).
> **Changelog :** voir section [Changelog 2026-04-12](#changelog-2026-04-12) en fin de document pour la traçabilité des modifications de cette passe.

## Scope
- Registry central for agent-based audit findings.
- Current sections backfilled from completed reviews:
  - Agent 1: Security / Auth / RBAC
  - Agent 2: Stock / Orders / Checkout / SAV
  - Agent 3: CRM / Cron / Newsletter
  - Agent 4: Build / Run / Deploy / Infra
  - Agent 5: DB / Scripts / Data Integrity
  - Agent 6: Frontend / UX / Accessibility
  - Agent 7: SEO / Performance
  - Agent 8: Privacy / Consent / Legal / Trust
  - Agent 9: Email / Messaging
  - Agent 10: Reliability / Load / Ops
- **Externes (review croisée 2026-04-12) :** 9 findings Claude (agent Explore) injectés avec préfixe `CL-*`, 1 finding UX externe `AX-01`.
- **User Testing plan (A11-*) :** sorti de ce registre vers [docs/user-testing/plan-2026-04-12.md](../user-testing/plan-2026-04-12.md) pour ne pas fausser le compteur P1.

## Finding Index

| ID | Severity | Domain | Title | Status | Owner | Source |
|---|---|---|---|---|---|---|
| A2-01 | P1 | Stock Integrity | `POST /stock/movements` non atomique | Open | TBD | Agent 2 |
| A2-02 | P1 | Stock Integrity | SAV `/repairs/:id/parts` décrément stock non guardé | Open | TBD | Agent 2 |
| A2-03 | P1 | Stock Integrity | `cancel -> full refund` peut double-restocker | Open | TBD | Agent 2 |
| A2-04 | P1 | Stock Integrity | Réserves installment sujettes aux races et au surbooking | Open | TBD | Agent 2 |
| A2-05 | P1 | Checkout Integrity | Un webhook Stripe tardif peut réactiver une commande annulée | Open | TBD | Agent 2 |
| CL-01 | **P0** | Payments / Prod Safety | **Stripe en mode TEST sur prod** — `STRIPE_SECRET_KEY=sk_test_...` sur Railway production. Aucune carte réelle ne peut être chargée | Open | TBD | Claude Cross-Review |
| CL-02 | P1 | Auth / IDOR | **IDOR `GET /orders/:id`** : check `user.role !== "ADMIN"` laisse MANAGER/TECHNICIAN lire les commandes de tous les clients | Open | TBD | Claude Cross-Review |
| CL-03 | P1 | Email / XSS | **XSS dans templates email** `services/ecommerce/src/emails/templates.ts` : interpolation `${i.name}` / `${data.customerName}` non échappée dans tous les emails transactionnels | Open | TBD | Claude Cross-Review |
| CL-04 | P1 | Checkout Integrity | **Race condition `loyaltyPoints`** : `findFirst` → `create` → `update` lus avant la transaction, double-attribution possible si webhook Stripe retry | Open | TBD | Claude Cross-Review |
| CL-05 | P1 | Auth / Abuse | **Brute-force `/repairs/:id/quote/accept-client`** : pas de rate-limit dédié, token comparé en clair en DB, pas invalidé après usage | Open | TBD | Claude Cross-Review |
| CL-06 | P1 | Auth / Enumeration | **Timing attack `/auth/forgot-password`** : pas de délai constant, énumération users possible via mesure de latence | Open | TBD | Claude Cross-Review |
| CL-07 | **P0** | Legal / Invoices | **Numérotation facture non conforme art. 289 CGI** : utilise `orderNumber` au lieu d'une séquence facture dédiée (FAC-YYYY-NNNNNN) avec continuité par exercice fiscal | Open | TBD | Claude Cross-Review |
| CL-08 | **P0** | Legal / Invoices | **Pas d'envoi auto facture par email après paiement** — art. 289-VII CGI exige émission au plus tard à la livraison | Open | TBD | Claude Cross-Review |
| CL-09 | P1 | Privacy / DPO | **DPO contact = `brand.email`** : mélange RGPD et SAV, risque demandes RGPD perdues (sanction CNIL) | Open | TBD | Claude Cross-Review |
| CL-10 | P2 | Payments / Idempotence | **Pas d'`Idempotency-Key` sur POST /orders + /checkout/payment-intent** : risque double commande / double charge si client retry sur réseau flaky | Open | TBD | Claude Cross-Review |
| AX-01 | P2 | UX / Forms | Pas d'autocomplétion d'adresse (BAN / Google Places / Stripe Address Element), pas de dropdown département, validation code postal ↔ ville absente | Open | TBD | External Audit |
| A1-01 | **P2** | Auth / RBAC | Routes CRM `customers` n'ont pas de `requireRole` local explicite (defense in depth). **Note :** le hook global `onRequest` CRM rejette déjà CLIENT → protégé au niveau service. Downgrade P1→P2 le 2026-04-12 | Open | TBD | Agent 1 |
| A1-02 | P2 | Auth / Session | `accessToken` stocké en `localStorage` | Open | TBD | Agent 1 |
| A1-03 | P2 | Auth / Session | `/cart` downgrade bearer invalide vers anonyme | Open | TBD | Agent 1 |
| A1-04 | **P2** | Auth / RBAC | Routes CRM `campaigns` et `segments` sans `requireRole` local explicite. **Même contexte que A1-01 :** hook global CRM couvre l'entrée du service. Downgrade P1→P2 le 2026-04-12 | Open | TBD | Agent 1 |
| A1-05 | P2 | Public Bypass / IDOR | `/appointments` accepte `ticketId` et `customerId` arbitraires sans preuve d'ownership | Open | TBD | Agent 1 |
| A4-01 | P1 | Build / Run | `infra/STAGING.md` documente encore des entrypoints `node dist/index.js` obsolètes | Open | TBD | Agent 4 |
| A4-02 | P1 | Deploy / DB | Runbook rollback/restore DB reste orienté Docker local, pas Railway prod | Open | TBD | Agent 4 |
| A4-03 | P2 | Ops / Cron | `cron-triggers-run.yml` est désactivé et la config `vars`/`secrets` est incohérente avec la doc | Open | TBD | Agent 4 |
| A4-04 | P2 | Deploy / Healthchecks | Les healthchecks post-deploy sont fragiles et partiels | Open | TBD | Agent 4 |
| A4-05 | P1 | Deploy / Staging | `deploy-staging.yml` vise encore des noms de services Railway différents de la prod documentée | Open | TBD | Agent 4 |
| A5-01 | P1 | Data Integrity | `stock_reserved` n'a aucune contrainte DB de non-négativité | Open | TBD | Agent 5 |
| A5-02 | P1 | Scripts / Prod Safety | `seed-demo.ts` n'est pas idempotent et peut dupliquer des données métier | Open | TBD | Agent 5 |
| A5-03 | P1 | Catalog Sync | `sync-woocommerce.ts` fait des refresh destructifs sans transaction | Open | TBD | Agent 5 |
| A5-04 | P2 | Scripts / Auth | `seed-demo.ts` garde un mot de passe hardcodé et ne met pas à jour les users existants | Open | TBD | Agent 5 |
| A5-05 | P2 | Seed / Data Integrity | `seed-scooters.ts` réécrit les stocks avec une valeur aléatoire à chaque relance | Open | TBD | Agent 5 |
| A3-01 | **P2** | CRM / RBAC | `campaigns` et `segments` sans distinction ADMIN vs MANAGER vs STAFF locale. **Note :** hook global CRM rejette déjà CLIENT. Downgrade P1→P2 le 2026-04-12 | Open | TBD | Agent 3 |
| A3-02 | **P2** | CRM / RBAC | `POST /triggers` autorise `STAFF` alors que le reste des triggers demande MANAGER+. Vraie incohérence mais pas P1 tant que STAFF n'est pas donné à des profils publics. Downgrade P1→P2 le 2026-04-12 | Open | TBD | Agent 3 |
| A3-03 | **P3** | Newsletter / Consent | ~~newsletter auto-confirme si l'email ne part pas~~ **ACCEPTED le 2026-04-12** : comportement volontaire documenté dans `services/crm/src/routes/newsletter/index.ts:67` ("auto-confirm so the feature works in dev/staging"). Vérifié end-to-end sur prod : Brevo configuré → status PENDING → double opt-in réel actif. Fallback graceful dev/staging seulement | **Accepted** | n/a | Agent 3 |
| A3-04 | P2 | Triggers / Idempotence | `POST /triggers/run` peut doubler des notifications en exécution concurrente | Open | TBD | Agent 3 |
| A6-01 | P1 | Accessibility / Forms | formulaires critiques reposent largement sur des placeholders sans labels explicites | Open | TBD | Agent 6 |
| A6-02 | P2 | Accessibility / Navigation | bouton menu mobile sans `aria-expanded`/`aria-controls` | Open | TBD | Agent 6 |
| A6-03 | P2 | Accessibility / Dialogs | `CookieBanner` expose un `role=\"dialog\"` sans `aria-modal` ni vraie gestion du focus | Open | TBD | Agent 6 |
| A6-04 | P2 | UX / Account Ops | `mon-compte` utilise `alert()` / `confirm()` pour export et suppression de compte | Open | TBD | Agent 6 |
| A6-05 | P2 | Mobile UX / Account | actions modifier/supprimer des adresses masquées au `hover` | Open | TBD | Agent 6 |
| A7-01 | P1 | SEO / Canonical | canonical racine `./` risque d'être hérité par beaucoup de pages publiques | Open | TBD | Agent 7 |
| A7-02 | P1 | SEO / Sitemap | sitemap produit dépend d'une API interne et échoue silencieusement en liste vide | Open | TBD | Agent 7 |
| A7-03 | P2 | SEO / Structured Data | `LocalBusiness` + `FAQPage` sont injectés globalement sur tout le site | Open | TBD | Agent 7 |
| A7-04 | P2 | SEO / Discoverability | index guides lie un slug inexistant vers une page `404` | Open | TBD | Agent 7 |
| A7-05 | P2 | SEO / Crawl Budget | `/reparation/[slug]` rend des soft-404 indexables pour des slugs arbitraires | Open | TBD | Agent 7 |
| A8-01 | P1 | Legal / Trust | mentions légales encore incomplètes avec placeholders publics | Open | TBD | Agent 8 |
| A8-02 | P1 | Privacy / Consent | politique cookies ne reflète pas le banner analytics ni les endpoints de tracking | Open | TBD | Agent 8 |
| A8-03 | P1 | Legal / Claims | promesses publiques livraison/retour/délai restent contradictoires ou insuffisamment qualifiées | Open | TBD | Agent 8 |
| A8-04 | P2 | Trust / Reviews | labels publics `avis vérifiés` sur-signalisent des avis Google et stats d'avis mixtes | Open | TBD | Agent 8 |
| A8-05 | P2 | Privacy / Notice | politique de confidentialité trop générique pour couvrir newsletter, formulaires SAV et consentements | Open | TBD | Agent 8 |
| A9-01 | P1 | Email / Reliability | emails transactionnels sont déclenchés en fire-and-forget sans retour utilisateur ni statut persistant | Open | TBD | Agent 9 |
| A9-02 | P1 | Email / Deliverability | expéditeurs et URLs de base sont dispersés et incohérents selon les modules | Open | TBD | Agent 9 |
| A9-03 | P2 | Messaging / Observability | absence de journalisation métier unifiée des emails hors SAV / campagnes | Open | TBD | Agent 9 |
| A10-01 | P1 | Ops / Recovery | backup DB existe mais aucun restore/runbook de restauration n'est couvert | Open | TBD | Agent 10 |
| A10-02 | P1 | Deploy / Reliability | healthchecks post-deploy sont trop courts et partiels pour fiabiliser un rollout multi-service | Open | TBD | Agent 10 |
| A10-03 | P2 | Ops / Monitoring | alerting Prometheus existe en infra mais pas relié à un runbook/owner visible dans le repo | Open | TBD | Agent 10 |
| A10-04 | P1 | Ops / Monitoring | alerte `DatabaseUnhealthy` non alimentée par la config Prometheus présente | Open | TBD | Agent 10 |

## Agent 1 — Security / Auth / RBAC

### Scope Audited
- [services/ecommerce/src/plugins/auth.ts](/home/lyes/trottistore/services/ecommerce/src/plugins/auth.ts:1)
- [services/crm/src/plugins/auth.ts](/home/lyes/trottistore/services/crm/src/plugins/auth.ts:1)
- [services/sav/src/plugins/auth.ts](/home/lyes/trottistore/services/sav/src/plugins/auth.ts:1)
- [services/analytics/src/plugins/auth.ts](/home/lyes/trottistore/services/analytics/src/plugins/auth.ts:1)
- [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:131)
- [services/ecommerce/src/routes/cart/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/cart/index.ts:168)
- [services/ecommerce/src/routes/checkout/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/checkout/index.ts:95)
- [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:238)
- [services/ecommerce/src/routes/admin-users/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/admin-users/index.ts:43)
- [services/ecommerce/src/routes/admin-invoices/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/admin-invoices/index.ts:132)
- [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:65)
- [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:73)
- [services/crm/src/routes/segments/index.ts](/home/lyes/trottistore/services/crm/src/routes/segments/index.ts:65)
- [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:48)
- [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:194)
- [apps/web/src/lib/api.ts](/home/lyes/trottistore/apps/web/src/lib/api.ts:58)

### Findings
1. `A1-01` `P1` Les routes CRM `customers` n’ont aucune garde locale explicite, y compris sur des actions de lecture/écriture sensibles (`GET`, `PUT`, ajout de points, interactions, merge). Dans le scope lu, rien ne force `MANAGER+` ou `ADMIN` sur ces endpoints.
   Réfs:
   - [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:65)
   - [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:189)
   - [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:266)
   - [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:391)
   - [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:637)
2. `A1-02` `P2` Le front stocke l’`accessToken` en `localStorage`, ce qui l’expose à toute XSS navigateur.
   Réfs:
   - [apps/web/src/lib/api.ts](/home/lyes/trottistore/apps/web/src/lib/api.ts:58)
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:213)
3. `A1-03` `P2` La route panier downgrade un bearer invalide vers anonyme au lieu de renvoyer `401`.
   Réf:
   - [services/ecommerce/src/routes/cart/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/cart/index.ts:171)
4. `A1-04` `P1` Les routes CRM `campaigns` et `segments` sont elles aussi sans garde locale explicite. Dans le scope lu, cela couvre la lecture, la création, la suppression, l’évaluation de segments, le preview et le déclenchement d’envoi de campagne.
   Réfs:
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:73)
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:228)
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:266)
   - [services/crm/src/routes/segments/index.ts](/home/lyes/trottistore/services/crm/src/routes/segments/index.ts:65)
   - [services/crm/src/routes/segments/index.ts](/home/lyes/trottistore/services/crm/src/routes/segments/index.ts:99)
5. `A1-05` `P2` La route publique `POST /appointments` accepte directement `ticketId` et `customerId` depuis le body et les persiste sans vérifier ownership, session liée ou `trackingToken`. Si un identifiant fuite, un tiers peut rattacher un rendez-vous à un ticket/compte qui n’est pas le sien.
   Réfs:
   - [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:100)
   - [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:454)

### Non-Findings
- Le refresh token est bien posé en cookie `httpOnly`, `sameSite: strict`, `secure` en prod.
  Réf:
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:108)
- La rotation du refresh token révoque l’ancien token et coupe toutes les sessions restantes en cas de réutilisation d’un token déjà révoqué.
  Réf:
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:355)
- `POST /auth/forgot-password` limite l’énumération: réponse uniforme `200` et rate limit dédié.
  Réf:
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:692)
- `POST /auth/reset-password` utilise un claim atomique du token puis révoque tous les refresh tokens du compte.
  Réf:
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:742)
- Le détail ticket SAV protège bien l’ownership `CLIENT` et `assignedTo` côté `TECHNICIAN`.
  Réf:
   - [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:500)

### Angles Not Verified
- Les hooks globaux `onRequest` et l’ordre d’enregistrement des routes hors `src/routes` n’étaient pas dans le scope autorisé
- Les flows front complets de refresh/logout au-delà de [apps/web/src/lib/api.ts](/home/lyes/trottistore/apps/web/src/lib/api.ts:1)
- Les tests d’abus sur `POST /appointments` avec `ticketId` / `customerId` d’un tiers
- La couverture de smoke tests authz sur `customers`, `campaigns` et `segments`
- La robustesse des tokens publics SAV en cas de fuite côté email/support

### Recommended Actions
- Ajouter des gardes explicites `MANAGER|ADMIN|SUPERADMIN` sur `customers`, `campaigns` et `segments`
- Sortir l’`accessToken` du `localStorage` si possible
- Faire échouer `/cart` avec `401` si bearer présent mais invalide
- Exiger une preuve d’ownership (`trackingToken`, session liée ou user courant) avant d’accepter `ticketId`/`customerId` sur `/appointments`

## Agent 2 — Stock / Orders / Checkout / SAV

### Scope Audited
- [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:128)
- [services/ecommerce/src/routes/checkout/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/checkout/index.ts:349)
- [services/ecommerce/src/routes/stock/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/stock/index.ts:69)
- [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:1005)
- Tests:
  - [services/ecommerce/src/routes/orders/orders.race.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/orders.race.test.ts:222)
  - [services/ecommerce/src/routes/orders/orders-admin.integration.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/orders-admin.integration.test.ts:131)
  - [services/ecommerce/src/routes/checkout/checkout.integration.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/checkout/checkout.integration.test.ts:375)
  - [services/sav/src/routes/tickets/tickets.integration.test.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/tickets.integration.test.ts:1)

### Findings
1. `A2-01` `P1` `POST /stock/movements` n’est pas atomique malgré le commentaire. Le code lit `stockQuantity`, calcule `stockAfter`, puis fait un `update` séparé; aucun lock SQL ni `updateMany ... where stockQuantity >= ...` n’est utilisé.
   Réf:
   - [services/ecommerce/src/routes/stock/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/stock/index.ts:69)
2. `A2-02` `P1` `POST /repairs/:id/parts` décrémente encore le stock sans garde atomique. Le flux SAV crée d’abord `repairPartUsed`, puis fait un `productVariant.update({ decrement })` brut.
   Réf:
   - [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:1005)
3. `A2-03` `P1` Un `cancel` puis un `full refund` peut double-restocker une commande.
   Réfs:
   - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:1406)
   - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:1539)
4. `A2-04` `P1` Les paiements fractionnés réservent `stockReserved` sur la base d’un contrôle de disponibilité fait avant transaction, puis incrémentent sans garde dans la transaction. Deux checkouts concurrents peuvent donc sur-réserver le même stock.
   Réfs:
   - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:404)
   - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:521)
   - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:709)
   - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:840)
5. `A2-05` `P1` Le flow Stripe n’impose pas que la commande soit encore payable. `POST /checkout/payment-intent` lit `status` mais ne le filtre pas, et `payment_intent.succeeded` remet ensuite la commande en `CONFIRMED` sans vérifier l’état courant. Un paiement ou webhook tardif peut donc réactiver une commande annulée.
   Réfs:
   - [services/ecommerce/src/routes/checkout/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/checkout/index.ts:107)
   - [services/ecommerce/src/routes/checkout/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/checkout/index.ts:365)

### Non-Findings
- Le décrément stock sur création de commande carte/auth/guest/admin est bien gardé atomiquement via `decrementStockOrThrow`.
  Réfs:
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:152)
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:529)
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:846)
- Les races de création de commande sont déjà couvertes par test pour auth, guest et admin.
  Réf:
  - [services/ecommerce/src/routes/orders/orders.race.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/orders.race.test.ts:222)
- La création/rejeu de `PaymentIntent` est idempotente pour un même `orderId` tant que le paiement reste `PENDING`.
  Réf:
  - [services/ecommerce/src/routes/checkout/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/checkout/index.ts:214)
- Le refund refuse correctement une commande déjà `REFUNDED`.
  Réfs:
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:1469)
  - [services/ecommerce/src/routes/orders/orders-admin.integration.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/orders-admin.integration.test.ts:158)
- L’annulation admin regroupe bien changement de statut, restitution de stock et annulation des échéances dans une même transaction.
  Réf:
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:1419)

### Angles Not Verified
- Test de contention sur `POST /stock/movements`
- Test SAV “stock insuffisant sur /parts”
- Test admin `cancel -> refund` sans double restock
- Test de contention sur `stockReserved`
- Webhook Stripe tardif sur commande déjà `CANCELLED`

### Recommended Actions
- Remplacer les updates stock bruts par des gardes atomiques `updateMany ... where`
- Appliquer le même garde sur `stockReserved` pour les flows installment auth + guest
- Interdire `payment-intent` et `payment_intent.succeeded` hors commandes encore `PENDING`
- Neutraliser le second restock sur `refund` après `cancel`
- Ajouter les tests de contention et de webhook tardif

## Agent 4 — Build / Run / Deploy / Infra

### Scope Audited
- [package.json](/home/lyes/trottistore/package.json:1)
- [services/ecommerce/package.json](/home/lyes/trottistore/services/ecommerce/package.json:1)
- [services/crm/package.json](/home/lyes/trottistore/services/crm/package.json:1)
- [services/sav/package.json](/home/lyes/trottistore/services/sav/package.json:1)
- [services/analytics/package.json](/home/lyes/trottistore/services/analytics/package.json:1)
- [services/ecommerce/Dockerfile](/home/lyes/trottistore/services/ecommerce/Dockerfile:1)
- [services/crm/Dockerfile](/home/lyes/trottistore/services/crm/Dockerfile:1)
- [services/sav/Dockerfile](/home/lyes/trottistore/services/sav/Dockerfile:1)
- [services/analytics/Dockerfile](/home/lyes/trottistore/services/analytics/Dockerfile:1)
- [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:1)
- [deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:1)
- [ci.yml](/home/lyes/trottistore/.github/workflows/ci.yml:1)
- [cron-triggers-run.yml](/home/lyes/trottistore/.github/workflows/cron-triggers-run.yml:1)
- [infra/Caddyfile](/home/lyes/trottistore/infra/Caddyfile:1)
- [infra/STAGING.md](/home/lyes/trottistore/infra/STAGING.md:1)
- [infra/alerting-rules.yml](/home/lyes/trottistore/infra/alerting-rules.yml:1)
- [infra/backup-db.sh](/home/lyes/trottistore/infra/backup-db.sh:1)
- [infra/deploy.sh](/home/lyes/trottistore/infra/deploy.sh:1)
- [infra/prometheus.yml](/home/lyes/trottistore/infra/prometheus.yml:1)
- [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:1)

### Findings
1. `A4-01` `P1` La doc staging reste calée sur `node dist/index.js` pour les 4 backends alors que les `start` scripts et les Dockerfiles exécutent désormais `node --import tsx src/index.ts`. Suivre la doc telle quelle expose un staging Railway à un crash au boot.
   Réfs:
   - [infra/STAGING.md](/home/lyes/trottistore/infra/STAGING.md:14)
   - [services/ecommerce/package.json](/home/lyes/trottistore/services/ecommerce/package.json:9)
   - [services/ecommerce/Dockerfile](/home/lyes/trottistore/services/ecommerce/Dockerfile:57)
2. `A4-02` `P1` Le runbook DB/rollback n’est pas aligné sur le déploiement réel Railway. La prod applique `pnpm --filter @trottistore/database db:deploy` via GitHub Actions, mais la restauration documentée repart sur `docker-compose.dev.yml`, `localhost` et `trottistore_dev`, ce qui ne fournit pas de procédure opérable pour un incident prod.
   Réfs:
   - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:40)
   - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:82)
   - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:71)
   - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:105)
3. `A4-03` `P2` Le workflow des triggers CRM est à moitié câblé: le `schedule` est commenté, le commentaire dit de configurer `TRIGGERS_RUN_URL` dans GitHub vars, alors que la doc staging le place dans les secrets. Le go-live checklist demande pourtant un cron actif toutes les heures.
   Réfs:
   - [cron-triggers-run.yml](/home/lyes/trottistore/.github/workflows/cron-triggers-run.yml:4)
   - [cron-triggers-run.yml](/home/lyes/trottistore/.github/workflows/cron-triggers-run.yml:29)
   - [infra/STAGING.md](/home/lyes/trottistore/infra/STAGING.md:79)
   - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:171)
4. `A4-04` `P2` Les healthchecks post-deploy sont fragiles et partiels dans les deux workflows Railway: attente fixe `sleep 30`, aucun retry borné, et seule la readiness ecommerce est vérifiée. Un démarrage lent ou une dépendance dégradée côté CRM/SAV/analytics peut passer ou échouer de manière peu fiable.
   Réfs:
   - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:171)
   - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:204)
   - [deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:79)
   - [deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:112)
5. `A4-05` `P1` Le workflow staging déploie encore vers les services Railway `web`, `ecommerce`, `crm`, `sav`, `analytics`, alors que le workflow production documente des noms réels `@trottistore/...`. Si le staging a été réaligné comme la prod, ce workflow cible les mauvais services.
   Réfs:
   - [deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:38)
   - [deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:46)
   - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:127)
   - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:145)

### Non-Findings
- Les `start` scripts des 4 services backend sont cohérents entre eux.
  Réf:
  - [services/ecommerce/package.json](/home/lyes/trottistore/services/ecommerce/package.json:9)
- Les 4 Dockerfiles backend sont alignés sur le même runtime `node --import tsx src/index.ts`.
  Réf:
  - [services/crm/Dockerfile](/home/lyes/trottistore/services/crm/Dockerfile:43)
- Le pipeline production sépare bien préparation DB optionnelle puis déploiement applicatif, avec blocage si `prepare-database` échoue.
  Réf:
  - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:105)
- La CI couvre build, validation Prisma, tests, scan sécurité et build Docker des 4 services.
  Réf:
  - [ci.yml](/home/lyes/trottistore/.github/workflows/ci.yml:73)
- Le repo contient des artefacts ops minimaux pour proxy, sauvegarde et alerting.
  Réfs:
  - [infra/Caddyfile](/home/lyes/trottistore/infra/Caddyfile:1)
  - [infra/backup-db.sh](/home/lyes/trottistore/infra/backup-db.sh:1)
  - [infra/alerting-rules.yml](/home/lyes/trottistore/infra/alerting-rules.yml:1)

### Angles Not Verified
- Noms de services Railway réellement présents en staging
- Variables/Secrets réellement définis dans GitHub et Railway
- Exécution réelle de `infra/deploy.sh` et `infra/backup-db.sh`
- Répétition réelle d’un restore DB sur environnement prod-like
- Couverture de readiness détaillée service par service au runtime

### Recommended Actions
- Aligner `infra/STAGING.md` sur les entrypoints `tsx` et sur les vrais noms de services Railway
- Documenter un rollback/restore DB Railway exécutable, pas un restore Docker local
- Réactiver ou retirer explicitement le cron CRM, avec convention unique `vars`/`secrets`
- Remplacer les `sleep 30` par des retries bornés et vérifier `/ready` sur chaque backend critique
- Aligner `deploy-staging.yml` sur la nomenclature service de la prod

## Agent 5 — DB / Scripts / Data Integrity

### Scope Audited
- [packages/database/prisma/schema.prisma](/home/lyes/trottistore/packages/database/prisma/schema.prisma:1)
- Migrations:
  - [20260410004818_init/migration.sql](/home/lyes/trottistore/packages/database/prisma/migrations/20260410004818_init/migration.sql:1)
  - [20260410151000_stock_quantity_non_negative/migration.sql](/home/lyes/trottistore/packages/database/prisma/migrations/20260410151000_stock_quantity_non_negative/migration.sql:1)
  - [20260410160000_order_item_product_variant_indexes/migration.sql](/home/lyes/trottistore/packages/database/prisma/migrations/20260410160000_order_item_product_variant_indexes/migration.sql:1)
  - [20260411170000_newsletter_subscribers/migration.sql](/home/lyes/trottistore/packages/database/prisma/migrations/20260411170000_newsletter_subscribers/migration.sql:1)
- Scripts:
  - [scripts/seed.ts](/home/lyes/trottistore/scripts/seed.ts:1)
  - [scripts/seed-demo.ts](/home/lyes/trottistore/scripts/seed-demo.ts:1)
  - [scripts/seed-orders.ts](/home/lyes/trottistore/scripts/seed-orders.ts:1)
  - [scripts/seed-scooters.ts](/home/lyes/trottistore/scripts/seed-scooters.ts:1)
  - [scripts/sync-woocommerce.ts](/home/lyes/trottistore/scripts/sync-woocommerce.ts:1)

### Findings
1. `A5-01` `P1` `stock_reserved` n’a aucune contrainte DB de non-négativité alors que `stock_quantity` en a une. Le schéma documente `stockReserved` comme stock bloqué par paiements fractionnés, mais seule la migration [stock_quantity_non_negative](/home/lyes/trottistore/packages/database/prisma/migrations/20260410151000_stock_quantity_non_negative/migration.sql:1) protège `stock_quantity`. Une régression applicative peut donc pousser `stock_reserved < 0` sans blocage DB.
   Réfs:
   - [schema.prisma](/home/lyes/trottistore/packages/database/prisma/schema.prisma:264)
   - [schema.prisma](/home/lyes/trottistore/packages/database/prisma/schema.prisma:265)
   - [20260410151000_stock_quantity_non_negative/migration.sql](/home/lyes/trottistore/packages/database/prisma/migrations/20260410151000_stock_quantity_non_negative/migration.sql:1)
2. `A5-02` `P1` `seed-demo.ts` n’est pas idempotent et peut dupliquer massivement des données métier si relancé sur une DB partagée. Les users/categories/brands principaux font `upsert`, mais une grande partie du script fait des `create` bruts sans garde sur `addresses`, `orders`, `payments`, `interactions`, `loyaltyPoints`, `segments`, `campaigns`, `repairTickets`, `repairStatusLog`, `repairPartUsed`.
   Réfs:
   - [seed-demo.ts](/home/lyes/trottistore/scripts/seed-demo.ts:57)
   - [seed-demo.ts](/home/lyes/trottistore/scripts/seed-demo.ts:294)
   - [seed-demo.ts](/home/lyes/trottistore/scripts/seed-demo.ts:317)
   - [seed-demo.ts](/home/lyes/trottistore/scripts/seed-demo.ts:391)
   - [seed-demo.ts](/home/lyes/trottistore/scripts/seed-demo.ts:451)
3. `A5-03` `P1` `sync-woocommerce.ts` fait des refresh destructifs sans transaction sur les images et catégories produit. Le script `deleteMany` puis `createMany` pour `product_images` et `product_categories` produit par produit. Un crash intermédiaire ou une erreur réseau laisse un catalogue partiellement synchronisé avec associations/images effacées.
   Réfs:
   - [sync-woocommerce.ts](/home/lyes/trottistore/scripts/sync-woocommerce.ts:313)
   - [sync-woocommerce.ts](/home/lyes/trottistore/scripts/sync-woocommerce.ts:324)
   - [sync-woocommerce.ts](/home/lyes/trottistore/scripts/sync-woocommerce.ts:331)
   - [sync-woocommerce.ts](/home/lyes/trottistore/scripts/sync-woocommerce.ts:343)
4. `A5-04` `P2` `seed-demo.ts` garde un mot de passe hardcodé (`demo1234`) et ne remet pas à jour les users existants (`update: {}`), donc un rerun n’aligne ni les hashes ni l’état `emailVerified` si la DB a dérivé.
   Réfs:
   - [seed-demo.ts](/home/lyes/trottistore/scripts/seed-demo.ts:10)
   - [seed-demo.ts](/home/lyes/trottistore/scripts/seed-demo.ts:42)
   - [seed-demo.ts](/home/lyes/trottistore/scripts/seed-demo.ts:44)
5. `A5-05` `P2` `seed-scooters.ts` n’est pas déterministe et peut corrompre la crédibilité des stocks de démo sur une DB partagée. Chaque relance recalcule `randomStock = Math.floor(Math.random() * 5) + 1` puis force `product_variants.stock_quantity` à cette valeur dans l’`upsert`, sans garde d’environnement ni marqueur “demo only”.
   Réfs:
   - [seed-scooters.ts](/home/lyes/trottistore/scripts/seed-scooters.ts:69)
   - [seed-scooters.ts](/home/lyes/trottistore/scripts/seed-scooters.ts:71)
   - [seed-scooters.ts](/home/lyes/trottistore/scripts/seed-scooters.ts:137)
   - [seed-scooters.ts](/home/lyes/trottistore/scripts/seed-scooters.ts:140)

### Non-Findings
- `seed.ts` exige désormais `SEED_ADMIN_PASSWORD` fort et met à jour `passwordHash` + `emailVerified` pour les users seedés existants.
  Réfs:
  - [seed.ts](/home/lyes/trottistore/scripts/seed.ts:141)
  - [seed.ts](/home/lyes/trottistore/scripts/seed.ts:183)
- La migration `stock_quantity_non_negative` protège bien `product_variants.stock_quantity >= 0`.
  Réfs:
  - [schema.prisma](/home/lyes/trottistore/packages/database/prisma/schema.prisma:264)
  - [20260410151000_stock_quantity_non_negative/migration.sql](/home/lyes/trottistore/packages/database/prisma/migrations/20260410151000_stock_quantity_non_negative/migration.sql:1)
- La table `crm.newsletter_subscribers` a les uniques nécessaires sur `email`, `confirm_token` et `unsubscribe_token`.
  Réfs:
  - [schema.prisma](/home/lyes/trottistore/packages/database/prisma/schema.prisma:704)
  - [20260411170000_newsletter_subscribers/migration.sql](/home/lyes/trottistore/packages/database/prisma/migrations/20260411170000_newsletter_subscribers/migration.sql:1)
- `seed-orders.ts` se protège explicitement contre une réexécution simple via un garde `orders >= 10` et marque les données créées avec `DEMO_SEED_DATA`.
  Réfs:
  - [seed-orders.ts](/home/lyes/trottistore/scripts/seed-orders.ts:17)
  - [seed-orders.ts](/home/lyes/trottistore/scripts/seed-orders.ts:69)
  - [seed-orders.ts](/home/lyes/trottistore/scripts/seed-orders.ts:158)
- La migration `order_item_product_variant_indexes` est désormais cohérente avec la décision DB “lock acceptable” et utilise `IF NOT EXISTS`.
  Réf:
  - [20260410160000_order_item_product_variant_indexes/migration.sql](/home/lyes/trottistore/packages/database/prisma/migrations/20260410160000_order_item_product_variant_indexes/migration.sql:1)

### Angles Not Verified
- Restore backup / rollback DB réels
- Taille et volumétrie futures des tables au-delà des mesures ponctuelles déjà faites
- Exécution réelle de `download-images.ts` contre un bucket cible non local
- Scripts annexes non critiques ici: `simulate-month.ts`, `crawl.ts`, `crawl-suppliers.ts`
- Effets d’un rerun `sync-woocommerce.ts` contre un catalogue prod réel
- Existence d’une politique centralisée de “demo data forbidden in prod”

### Recommended Actions
- Ajouter une contrainte DB `stock_reserved >= 0`
- Mettre un garde d’environnement explicite sur `seed-demo.ts` et/ou le rendre réellement idempotent
- Rendre `seed-scooters.ts` déterministe ou refuser toute exécution hors environnement de démo
- Encapsuler la sync WooCommerce produit par produit dans une transaction ou utiliser une stratégie non destructive
- Documenter quels scripts sont sûrs en prod, staging, demo only
- Aligner `seed-demo.ts` sur les mêmes règles auth que `seed.ts` si ce script reste utilisé

## Agent 3 — CRM / Cron / Newsletter

### Scope Audited
- [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:1)
- [services/crm/src/routes/segments/index.ts](/home/lyes/trottistore/services/crm/src/routes/segments/index.ts:1)
- [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:1)
- [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:1)
- [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:1)

### Findings
1. `A3-01` `P1` Les routes `campaigns` et `segments` sont accessibles à tout utilisateur authentifié non-`CLIENT`, y compris `TECHNICIAN` et `STAFF`, car elles n’ont aucune garde locale. Le hook global CRM ne bloque que `CLIENT`; un rôle backoffice faible peut donc créer des segments, lire des campagnes, envoyer des previews et lancer des campagnes marketing.
   Réfs:
   - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:135)
   - [services/crm/src/routes/segments/index.ts](/home/lyes/trottistore/services/crm/src/routes/segments/index.ts:56)
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:72)
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:227)
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:265)
2. `A3-02` `P1` `POST /triggers` autorise `STAFF` alors que `GET /triggers`, `GET /triggers/:id/logs`, `POST /triggers/run` et `PUT /triggers/:id/toggle` exigent manager+. La garde locale sur création ne bloque que `CLIENT` et `TECHNICIAN`.
   Réfs:
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:47)
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:66)
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:92)
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:131)
3. `A3-03` `P1` Le flow newsletter auto-confirme les abonnements si l’email de confirmation ne part pas. En cas de transport absent/mal configuré en prod, le système bascule silencieusement de double opt-in à single opt-in, ce qui casse la preuve de consentement attendue.
   Réfs:
   - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:66)
   - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:68)
   - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:71)
4. `A3-04` `P2` `POST /triggers/run` n’est pas idempotent sous concurrence. Le cron tourne in-process sur chaque instance CRM, l’endpoint est aussi déclenchable manuellement, et la protection anti-doublon fait un `findFirst` puis `send` puis `notificationLog.create` sans transaction ni contrainte unique visible dans ce scope. Deux runs simultanés peuvent donc envoyer le même rappel avant que le log n’existe.
   Réfs:
   - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:223)
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:92)
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:219)
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:345)

### Non-Findings
- Le bypass cron est désormais bien limité à `POST /triggers/run` avec secret nonce par process et ré-vérification locale.
  Réfs:
  - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:110)
  - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:119)
  - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:92)
- Les routes newsletter publiques sont explicitement et précisément scopées à `subscribe`, `confirm`, `unsubscribe`.
  Réf:
  - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:98)
- Le subscribe newsletter ne révèle pas si un email déjà `CONFIRMED` existe.
  Réfs:
  - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:58)
- Le cron capture et journalise l’échec global de l’exécution sans faire tomber le process CRM.
  Réf:
  - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:224)
- Le `campaignSend` évite déjà le ré-envoi séquentiel exact `campaignId + customerId` dans un rerun simple.
  Réf:
  - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:329)

### Angles Not Verified
- Rate limiting réel par IP/instance sur les endpoints newsletter publics au-delà du plugin global
- Configuration prod exacte `BREVO_API_KEY` / SMTP pour savoir si `A3-03` est actuellement exploitable
- Tous les rôles réellement émis par l’auth centrale vers le service CRM en prod
- Présence éventuelle d’une contrainte DB unique sur `notificationLog(triggerId, ticketId)` hors du scope autorisé
- Preuve de consentement/export CRM autour des abonnés newsletter

### Recommended Actions
- Ajouter des gardes explicites `MANAGER|ADMIN|SUPERADMIN` sur `segments` et `campaigns`
- Aligner `POST /triggers` sur la même politique manager+ que le reste du module
- Réserver l’auto-confirm newsletter aux environnements non-prod, ou le rendre opt-in via env explicite
- Rendre `triggers/run` atomique côté anti-doublon, par contrainte unique ou create transactionnel avant envoi

## Agent 6 — Frontend / UX / Accessibility

### Scope Audited
- [apps/web/src/app/layout.tsx](/home/lyes/trottistore/apps/web/src/app/layout.tsx:1)
- [apps/web/src/app/global-error.tsx](/home/lyes/trottistore/apps/web/src/app/global-error.tsx:1)
- [apps/web/src/app/(shop)/error.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/error.tsx:1)
- [apps/web/src/app/(admin)/error.tsx](/home/lyes/trottistore/apps/web/src/app/(admin)/error.tsx:1)
- [apps/web/src/app/(shop)/checkout/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/checkout/page.tsx:1)
- [apps/web/src/app/(shop)/panier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/panier/page.tsx:1)
- [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:1)
- [apps/web/src/components/Header.tsx](/home/lyes/trottistore/apps/web/src/components/Header.tsx:1)
- [apps/web/src/components/NewsletterForm.tsx](/home/lyes/trottistore/apps/web/src/components/NewsletterForm.tsx:1)
- [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:1)
- [apps/web/src/components/AddressSection.tsx](/home/lyes/trottistore/apps/web/src/components/AddressSection.tsx:1)
- [apps/web/src/components/SOSButton.tsx](/home/lyes/trottistore/apps/web/src/components/SOSButton.tsx:1)

### Findings
1. `A6-01` `P1` Les formulaires les plus critiques reposent encore sur des placeholders plutôt que sur des labels associés. C’est net sur `NewsletterForm` et sur le checkout invité / nouvelle adresse. Sur lecteur d’écran, dictée vocale et usage mobile, l’identification des champs devient fragile.
   Réfs:
   - [apps/web/src/components/NewsletterForm.tsx](/home/lyes/trottistore/apps/web/src/components/NewsletterForm.tsx:55)
   - [apps/web/src/app/(shop)/checkout/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/checkout/page.tsx:404)
   - [apps/web/src/app/(shop)/checkout/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/checkout/page.tsx:450)
2. `A6-02` `P2` Le bouton menu mobile ouvre bien un panneau modal, mais il n’expose ni `aria-expanded` ni `aria-controls`. L’état du contrôle n’est donc pas annoncé proprement aux technologies d’assistance.
   Réfs:
   - [apps/web/src/components/Header.tsx](/home/lyes/trottistore/apps/web/src/components/Header.tsx:291)
   - [apps/web/src/components/Header.tsx](/home/lyes/trottistore/apps/web/src/components/Header.tsx:366)
3. `A6-03` `P2` `CookieBanner` se présente comme un dialogue (`role="dialog"`) mais sans `aria-modal`, sans focus initial et sans trap de focus. Au clavier ou au lecteur d’écran, le focus peut continuer derrière la bannière.
   Réfs:
   - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:71)
   - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:88)
4. `A6-04` `P2` `mon-compte` repose encore sur `alert()` et double `confirm()` pour l’export et la suppression du compte. C’est fonctionnel, mais faible en recovery UX, non stylé et particulièrement fragile sur mobile/webview.
   Réfs:
   - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:186)
   - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:200)
   - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:209)
5. `A6-05` `P2` Dans `AddressSection`, les actions modifier/supprimer sont cachées en `opacity-0` et révélées seulement via `group-hover`. Sur tactile, ces actions deviennent peu découvrables et peuvent sembler absentes, ce qui dégrade un parcours compte pourtant critique.
   Réf:
   - [apps/web/src/components/AddressSection.tsx](/home/lyes/trottistore/apps/web/src/components/AddressSection.tsx:209)

### Non-Findings
- Le layout global définit bien `viewportFit: "cover"` et `device-width`, cohérent pour iPhone/mobile.
  Réf:
  - [apps/web/src/app/layout.tsx](/home/lyes/trottistore/apps/web/src/app/layout.tsx:39)
- `Header` et `SOSButton` ferment bien sur `Escape`, et les deux implémentent un focus trap minimal quand leur panneau est ouvert.
  Réfs:
  - [apps/web/src/components/Header.tsx](/home/lyes/trottistore/apps/web/src/components/Header.tsx:28)
  - [apps/web/src/components/SOSButton.tsx](/home/lyes/trottistore/apps/web/src/components/SOSButton.tsx:21)
- `mon-compte` expose correctement les erreurs de login et `AddressSection` les erreurs CRUD dans des conteneurs `role="alert"`.
  Réf:
  - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:367)
  - [apps/web/src/components/AddressSection.tsx](/home/lyes/trottistore/apps/web/src/components/AddressSection.tsx:122)
- Les écrans d’erreur `global`, `shop` et `admin` proposent tous une action explicite de reprise via `reset()`, et la variante shop ajoute un retour accueil.
  Réfs:
  - [apps/web/src/app/global-error.tsx](/home/lyes/trottistore/apps/web/src/app/global-error.tsx:47)
  - [apps/web/src/app/(shop)/error.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/error.tsx:22)
  - [apps/web/src/app/(admin)/error.tsx](/home/lyes/trottistore/apps/web/src/app/(admin)/error.tsx:20)
- `panier` garde un `h1` explicite hors loading state et un `aria-label` sur la suppression d’article.
  Réfs:
  - [apps/web/src/app/(shop)/panier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/panier/page.tsx:74)
  - [apps/web/src/app/(shop)/panier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/panier/page.tsx:159)

### Angles Not Verified
- Audit visuel réel sur iPhone/VoiceOver/zoom 200%
- Contrastes réels et ordre de focus sur toutes les pages publiques
- Parcours complet checkout Stripe dans un vrai navigateur
- Accessibilité de `GarageSection` et des longues pages marketing non relues ici
- Performance front et SEO détaillés, réservés à l’Agent 7

### Recommended Actions
- Ajouter des labels explicites et `id/htmlFor` à tous les champs du `checkout` et à `NewsletterForm`
- Ajouter `aria-expanded` et `aria-controls` au bouton menu mobile du header
- Soit déclasser `CookieBanner` en simple bannière, soit en faire un vrai dialog accessible avec focus management
- Remplacer `alert()/confirm()` sur `mon-compte` par des modales/alerts UI cohérentes
- Rendre les actions d’adresse visibles sans `hover` seul, au minimum sur mobile et au focus clavier

## Agent 7 — SEO / Performance

### Scope Audited
- SEO infra:
  - [apps/web/src/app/layout.tsx](/home/lyes/trottistore/apps/web/src/app/layout.tsx:1)
  - [apps/web/src/app/robots.ts](/home/lyes/trottistore/apps/web/src/app/robots.ts:1)
  - [apps/web/src/app/sitemap.ts](/home/lyes/trottistore/apps/web/src/app/sitemap.ts:1)
  - [apps/web/src/components/StructuredData.tsx](/home/lyes/trottistore/apps/web/src/components/StructuredData.tsx:1)
- Public pages metadata:
  - [apps/web/src/app/(shop)/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/page.tsx:1)
  - [apps/web/src/app/(shop)/produits/[slug]/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/produits/[slug]/page.tsx:1)
  - [apps/web/src/app/(shop)/a-propos/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/a-propos/page.tsx:1)
  - [apps/web/src/app/(shop)/atelier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/atelier/page.tsx:1)
  - [apps/web/src/app/(shop)/guide/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/guide/page.tsx:1)
  - [apps/web/src/app/(shop)/guide/[slug]/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/guide/[slug]/page.tsx:1)
  - [apps/web/src/app/(shop)/faq/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/faq/page.tsx:1)
  - [apps/web/src/app/(shop)/avis/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/avis/page.tsx:1)
  - [apps/web/src/app/(shop)/reparation/[slug]/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/[slug]/page.tsx:1)
- Private layouts:
  - [apps/web/src/app/(shop)/checkout/layout.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/checkout/layout.tsx:1)
  - [apps/web/src/app/(shop)/mon-compte/layout.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/layout.tsx:1)
  - [apps/web/src/app/(shop)/panier/layout.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/panier/layout.tsx:1)
- Config:
  - [apps/web/next.config.ts](/home/lyes/trottistore/apps/web/next.config.ts:1)

### Findings
1. `A7-01` `P1` Le layout racine définit `alternates.canonical: "./"` et beaucoup de pages publiques n’override pas ce champ. En metadata Next, ça risque de laisser une canonical racine héritée sur des pages comme `/atelier`, `/a-propos`, `/guide`, `/avis`, ce qui dilue l’indexation et peut auto-canoniser ces pages vers la home.
   Réfs:
   - [apps/web/src/app/layout.tsx](/home/lyes/trottistore/apps/web/src/app/layout.tsx:16)
   - [apps/web/src/app/(shop)/a-propos/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/a-propos/page.tsx:5)
   - [apps/web/src/app/(shop)/atelier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/atelier/page.tsx:5)
   - [apps/web/src/app/(shop)/guide/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/guide/page.tsx:5)
2. `A7-02` `P1` Le `sitemap` dépend d’un fetch runtime vers `ECOMMERCE_URL` et échoue silencieusement en liste vide si l’API n’est pas joignable. Avec le fallback `http://localhost:3001`, un environnement mal configuré peut publier un sitemap sans aucun produit actif, sans alerte.
   Réfs:
   - [apps/web/src/app/sitemap.ts](/home/lyes/trottistore/apps/web/src/app/sitemap.ts:53)
   - [apps/web/src/app/sitemap.ts](/home/lyes/trottistore/apps/web/src/app/sitemap.ts:73)
3. `A7-03` `P2` `StructuredData` injecte globalement `LocalBusiness` et un `FAQPage` hardcodé dans le layout racine, donc sur tout le site, y compris pages privées/noindex et pages qui ont déjà leur propre schema FAQ. Ça crée du JSON-LD dupliqué ou hors-contexte, et la page FAQ ajoute en plus un second `FAQPage`.
   Réfs:
   - [apps/web/src/components/StructuredData.tsx](/home/lyes/trottistore/apps/web/src/components/StructuredData.tsx:1)
   - [apps/web/src/app/layout.tsx](/home/lyes/trottistore/apps/web/src/app/layout.tsx:59)
   - [apps/web/src/app/(shop)/faq/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/faq/page.tsx:14)
4. `A7-04` `P2` L’index `/guide` pointe vers `/guide/panne-trottinette`, mais le routeur statique, le contenu et le sitemap ne connaissent que `panne-trottinette-que-faire`. On crée donc un lien interne cassé vers une `404` sur une page éditoriale censée pousser le maillage SEO.
   Réfs:
   - [apps/web/src/app/(shop)/guide/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/guide/page.tsx:25)
   - [apps/web/src/app/(shop)/guide/[slug]/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/guide/[slug]/page.tsx:161)
   - [apps/web/src/app/sitemap.ts](/home/lyes/trottistore/apps/web/src/app/sitemap.ts:4)
5. `A7-05` `P2` `/reparation/[slug]` ne renvoie pas `404` pour un slug inconnu. `generateMetadata()` fabrique un title/description pour n’importe quelle valeur, puis la page rend un contenu générique si `slug` n’est ni dans `BRAND_DATA` ni dans `ISSUE_DATA`. Cela ouvre des soft-404 indexables et du crawl waste.
   Réfs:
   - [apps/web/src/app/(shop)/reparation/[slug]/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/[slug]/page.tsx:121)
   - [apps/web/src/app/(shop)/reparation/[slug]/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/[slug]/page.tsx:215)

### Non-Findings
- Les layouts privés `checkout`, `panier` et `mon-compte` sont bien marqués `robots: { index: false, follow: false }`.
  Réfs:
  - [apps/web/src/app/(shop)/checkout/layout.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/checkout/layout.tsx:4)
  - [apps/web/src/app/(shop)/panier/layout.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/panier/layout.tsx:4)
  - [apps/web/src/app/(shop)/mon-compte/layout.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/layout.tsx:4)
- Les pages produit génèrent bien des metadata spécifiques avec canonical dédiée, OG et Twitter cards.
  Réf:
  - [apps/web/src/app/(shop)/produits/[slug]/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/produits/[slug]/page.tsx:91)
- `robots.ts` expose bien le sitemap et un `host` cohérent avec le domaine de marque.
  Réf:
  - [apps/web/src/app/robots.ts](/home/lyes/trottistore/apps/web/src/app/robots.ts:4)
- `next/image` est configuré pour les domaines distants attendus `trottistore.fr` et `www.trottistore.fr`.
  Réf:
  - [apps/web/next.config.ts](/home/lyes/trottistore/apps/web/next.config.ts:6)

### Angles Not Verified
- Core Web Vitals réels en prod
- Lighthouse/PageSpeed/WebPageTest réels
- Search Console / index coverage / canonicals effectifs rendus HTML
- Métadonnées de toutes les pages publiques non relues ici
- Rendu réel des balises `link rel=canonical` après merge metadata Next

### Recommended Actions
- Ajouter des canonicals explicites sur les pages publiques importantes, ou retirer la canonical racine globale
- Faire du `sitemap` un flux robuste: soit build-time avec source DB/API fiable, soit fail visible si les produits ne peuvent pas être listés
- Sortir le `FAQPage` du layout global et ne garder que les schemas contextuels par page
- Corriger le slug guide cassé pour aligner index, route dynamique et sitemap
- Faire retourner `notFound()` aux slugs `/reparation/[slug]` inconnus, ou forcer `dynamicParams = false`

## Agent 8 — Privacy / Consent / Legal / Trust

### Scope Audited
- [apps/web/src/components/ConsentCheckbox.tsx](/home/lyes/trottistore/apps/web/src/components/ConsentCheckbox.tsx:1)
- [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:1)
- [apps/web/src/components/NewsletterForm.tsx](/home/lyes/trottistore/apps/web/src/components/NewsletterForm.tsx:1)
- [apps/web/src/components/GoogleReviewsBadge.tsx](/home/lyes/trottistore/apps/web/src/components/GoogleReviewsBadge.tsx:1)
- [apps/web/src/app/(shop)/mentions-legales/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mentions-legales/page.tsx:1)
- [apps/web/src/app/(shop)/politique-confidentialite/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/politique-confidentialite/page.tsx:1)
- [apps/web/src/app/(shop)/cookies/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/cookies/page.tsx:1)
- [apps/web/src/app/(shop)/cgv/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/cgv/page.tsx:1)
- [apps/web/src/app/(shop)/livraison/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/livraison/page.tsx:1)
- [apps/web/src/app/(shop)/atelier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/atelier/page.tsx:1)
- [apps/web/src/app/(shop)/reparation/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/page.tsx:1)
- [apps/web/src/app/(shop)/urgence/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/urgence/page.tsx:1)
- [apps/web/src/app/(shop)/newsletter/confirm/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/newsletter/confirm/page.tsx:1)
- [apps/web/src/app/(shop)/newsletter/unsubscribe/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/newsletter/unsubscribe/page.tsx:1)
- [apps/web/src/app/(shop)/avis/AvisContent.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/avis/AvisContent.tsx:1)
- [apps/web/src/app/(shop)/produits/[slug]/AddToCartSection.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/produits/[slug]/AddToCartSection.tsx:90)
- [apps/web/src/lib/funnel-tracking.ts](/home/lyes/trottistore/apps/web/src/lib/funnel-tracking.ts:1)

### Findings
1. `A8-01` `P1` Les mentions légales sont encore incomplètes en production visible: `SIRET`, `RCS`, `capital social` et `directeur de publication` sont laissés en placeholders `[À COMPLÉTER]`. C’est un trou de conformité/trust simple et visible.
   Réf:
   - [apps/web/src/app/(shop)/mentions-legales/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mentions-legales/page.tsx:16)
2. `A8-02` `P1` La politique cookies ne reflète pas le comportement réel du site. Le banner propose un consentement `analytics`, le choix est stocké dans `cookie-consent`, et des pages publiques appellent `analyticsApi.trackFunnel`; pourtant `/cookies` ne documente que `refresh_token`.
   Réfs:
   - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:6)
   - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:80)
   - [apps/web/src/lib/funnel-tracking.ts](/home/lyes/trottistore/apps/web/src/lib/funnel-tracking.ts:11)
   - [apps/web/src/app/(shop)/cookies/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/cookies/page.tsx:14)
3. `A8-03` `P1` Certaines promesses publiques sont contradictoires ou insuffisamment qualifiées dans le même périmètre relu. Le metadata `/livraison` annonce `retour gratuit 14 jours` et `Livraison France 48h`, alors que le corps indique `48 à 72h ouvrées` et précise que les frais de retour sont à la charge du client sauf produit défectueux; ailleurs, le front pousse encore `Livraison 48h` et `Nous vous contacterons sous 24-48h`.
   Réfs:
   - [apps/web/src/app/(shop)/livraison/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/livraison/page.tsx:9)
   - [apps/web/src/app/(shop)/livraison/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/livraison/page.tsx:16)
   - [apps/web/src/app/(shop)/livraison/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/livraison/page.tsx:73)
   - [apps/web/src/app/(shop)/produits/[slug]/AddToCartSection.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/produits/[slug]/AddToCartSection.tsx:97)
   - [apps/web/src/app/(shop)/reparation/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/page.tsx:209)
4. `A8-04` `P2` Les signaux de confiance sur les avis sur-signalisent le caractère “vérifié”. Le badge Google plein affiche `{total} avis vérifiés` alors qu’il s’agit d’avis Google agrégés, et la page `/avis` affiche globalement `Avis vérifiés` alors que seul le sous-ensemble `review.verifiedPurchase` reçoit un badge `Achat vérifié` dans la liste.
   Réfs:
   - [apps/web/src/components/GoogleReviewsBadge.tsx](/home/lyes/trottistore/apps/web/src/components/GoogleReviewsBadge.tsx:63)
   - [apps/web/src/app/(shop)/avis/AvisContent.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/avis/AvisContent.tsx:90)
   - [apps/web/src/app/(shop)/avis/AvisContent.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/avis/AvisContent.tsx:135)
   - [apps/web/src/app/(shop)/atelier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/atelier/page.tsx:200)
5. `A8-05` `P2` La politique de confidentialité reste trop générique par rapport aux formulaires publics relus. Elle ne mentionne ni la newsletter, ni les formulaires SAV/urgence, ni la mesure d’audience soumise à consentement; et la section “base légale” n’évoque même pas explicitement le consentement alors que ces formulaires exigent une case RGPD avant envoi.
   Réfs:
   - [apps/web/src/app/(shop)/politique-confidentialite/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/politique-confidentialite/page.tsx:15)
   - [apps/web/src/components/NewsletterForm.tsx](/home/lyes/trottistore/apps/web/src/components/NewsletterForm.tsx:23)
   - [apps/web/src/app/(shop)/reparation/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/page.tsx:79)
   - [apps/web/src/app/(shop)/urgence/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/urgence/page.tsx:77)

### Non-Findings
- Les formulaires publics relus `newsletter`, `urgence` et `reparation` exigent bien une case de consentement explicite avant submit.
  Réfs:
  - [apps/web/src/components/ConsentCheckbox.tsx](/home/lyes/trottistore/apps/web/src/components/ConsentCheckbox.tsx:14)
  - [apps/web/src/components/NewsletterForm.tsx](/home/lyes/trottistore/apps/web/src/components/NewsletterForm.tsx:19)
  - [apps/web/src/app/(shop)/urgence/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/urgence/page.tsx:79)
  - [apps/web/src/app/(shop)/reparation/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/page.tsx:81)
- Le banner cookies laisse bien un choix granulaire `accepter / refuser / personnaliser` avant persistance du consentement.
  Réfs:
  - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:41)
  - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:50)
  - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:59)
- Les CGV mentionnent bien médiation, rétractation et garantie légale de conformité.
  Réf:
  - [apps/web/src/app/(shop)/cgv/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/cgv/page.tsx:42)
- Les parcours newsletter exposent bien une confirmation dédiée et une désinscription dédiée côté front.
  Réfs:
  - [apps/web/src/app/(shop)/newsletter/confirm/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/newsletter/confirm/page.tsx:17)
  - [apps/web/src/app/(shop)/newsletter/unsubscribe/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/newsletter/unsubscribe/page.tsx:17)

### Angles Not Verified
- Véracité business réelle des promesses de délai et de stock visibles
- Charge utile exacte et finalité serveur de `analyticsApi.trackFunnel`
- Preuve de consentement exploitable côté backoffice/CRM pour newsletter et formulaires
- Conformité juridique fine des mentions/CGV/privacy pour l’entité sociale exacte
- Wording légal des emails newsletter hors pages front relues

### Recommended Actions
- Compléter immédiatement les mentions légales avec les vraies informations société
- Aligner `/cookies` et `/politique-confidentialite` avec les formulaires publics, le stockage `cookie-consent` et le tracking réellement déclenché
- Nettoyer les promesses publiques non qualifiées ou contradictoires sur livraison, retours, délais de prise en charge et avis “vérifiés”

## Agent 9 — Email / Messaging

### Scope Audited
- Shared notifications:
  - [packages/shared/src/notifications/transport.ts](/home/lyes/trottistore/packages/shared/src/notifications/transport.ts:1)
  - [packages/shared/src/notifications/email.ts](/home/lyes/trottistore/packages/shared/src/notifications/email.ts:1)
  - [packages/shared/src/notifications/sms.ts](/home/lyes/trottistore/packages/shared/src/notifications/sms.ts:1)
- Ecommerce templates and routes:
  - [services/ecommerce/src/emails/templates.ts](/home/lyes/trottistore/services/ecommerce/src/emails/templates.ts:1)
  - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:193)
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:596)
  - [services/ecommerce/src/routes/admin-users/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/admin-users/index.ts:199)
- CRM newsletter:
  - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:1)
  - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:228)
- SAV notifications:
  - [services/sav/src/notifications/engine.ts](/home/lyes/trottistore/services/sav/src/notifications/engine.ts:1)
  - [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:249)
- Tests:
  - [services/ecommerce/src/routes/auth/emails.integration.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/emails.integration.test.ts:1)
  - [services/ecommerce/src/routes/orders/order-email.integration.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/order-email.integration.test.ts:1)
  - [services/crm/src/routes/newsletter/newsletter.integration.test.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/newsletter.integration.test.ts:1)

### Findings
1. `A9-01` `P1` Les messages transactionnels critiques restent du pur best-effort. `register`, `forgot-password`, confirmations de commande, invitations staff, resets admin et notifications SAV partent en fire-and-forget; l’échec est seulement logué, sans retry, sans outbox et sans statut persistant côté métier. Si SMTP/Brevo tombe, le produit continue à répondre `201/200` alors que le message peut être perdu.
   Réfs:
   - [packages/shared/src/notifications/email.ts](/home/lyes/trottistore/packages/shared/src/notifications/email.ts:24)
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:194)
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:733)
   - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:596)
   - [services/ecommerce/src/routes/admin-users/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/admin-users/index.ts:217)
   - [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:249)
   - [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:663)
2. `A9-02` `P1` Les expéditeurs et URLs publiques sont configurés de façon dispersée selon les modules. La couche partagée utilise `MAIL_FROM`, le SAV utilise `BREVO_SENDER_EMAIL`, les templates ecommerce et le suivi SAV utilisent `BASE_URL`, la newsletter CRM utilise `PUBLIC_WEB_URL`, et les campagnes forcent `marketing@trottistore.fr`. Ce morcellement augmente le risque de liens faux, de domaines d’envoi hétérogènes et d’alignement SPF/DKIM/DMARC incomplet.
   Réfs:
   - [packages/shared/src/notifications/email.ts](/home/lyes/trottistore/packages/shared/src/notifications/email.ts:16)
   - [services/ecommerce/src/emails/templates.ts](/home/lyes/trottistore/services/ecommerce/src/emails/templates.ts:6)
   - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:24)
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:254)
   - [services/sav/src/notifications/engine.ts](/home/lyes/trottistore/services/sav/src/notifications/engine.ts:117)
3. `A9-03` `P2` L’observabilité reste fragmentée: les campagnes CRM persistent `campaignSend`, les triggers CRM loguent `notificationLog`, mais les emails ecommerce simples et la newsletter n’écrivent aucun journal métier de tentative/résultat. En incident, il est difficile de prouver quels destinataires n’ont jamais reçu de reset, de confirmation ou de lien newsletter.
   Réfs:
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:338)
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:389)
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:733)
   - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:64)

### Non-Findings
- La couche partagée a bien un fallback SMTP -> Brevo -> warning, donc l’envoi ne dépend pas d’un seul transport.
  Réfs:
  - [packages/shared/src/notifications/transport.ts](/home/lyes/trottistore/packages/shared/src/notifications/transport.ts:42)
  - [packages/shared/src/notifications/email.ts](/home/lyes/trottistore/packages/shared/src/notifications/email.ts:34)
- Les routes newsletter gardent un vrai flow `subscribe -> confirm -> unsubscribe` avec tokens aléatoires et endpoints idempotents de confirmation/désinscription.
  Réfs:
  - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:20)
  - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:96)
  - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:127)
- Les tests couvrent bien le déclenchement de `sendEmail` sur inscription, forgot-password et confirmation de commande.
  Réfs:
  - [services/ecommerce/src/routes/auth/emails.integration.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/emails.integration.test.ts:1)
  - [services/ecommerce/src/routes/orders/order-email.integration.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/order-email.integration.test.ts:1)
- Les campagnes CRM persistent bien un statut par destinataire (`SENT`/`FAILED`), ce qui limite la perte silencieuse sur ce sous-flux précis.
  Réf:
  - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:343)
- Le moteur SAV est le sous-ensemble le plus robuste du scope: templates par statut, email + SMS, résultat structuré renvoyé par l’engine.
  Réfs:
  - [services/sav/src/notifications/engine.ts](/home/lyes/trottistore/services/sav/src/notifications/engine.ts:131)
  - [services/sav/src/notifications/engine.ts](/home/lyes/trottistore/services/sav/src/notifications/engine.ts:213)

### Angles Not Verified
- DNS réels SPF/DKIM/DMARC et réputation des domaines expéditeurs
- Bounce/webhook processing côté Brevo
- Templates réels Brevo utilisés par SAV si `BREVO_TPL_*` est configuré
- Boîte de réception réelle et classement spam
- Existence d’un flow contact dédié hors SAV/newsletter dans le scope lu

### Recommended Actions
- Définir quels messages sont critiques et leur donner au minimum une outbox légère ou un statut persistant
- Centraliser sender, domaine d’envoi et URL publique dans une config partagée unique
- Ajouter un journal métier minimal pour ecommerce/newsletter, aligné sur le niveau déjà présent côté SAV/campaigns

## Agent 10 — Reliability / Load / Ops

### Scope Audited
- [.github/workflows/deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:1)
- [.github/workflows/deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:1)
- [.github/workflows/cron-triggers-run.yml](/home/lyes/trottistore/.github/workflows/cron-triggers-run.yml:1)
- [infra/backup-db.sh](/home/lyes/trottistore/infra/backup-db.sh:1)
- [infra/STAGING.md](/home/lyes/trottistore/infra/STAGING.md:1)
- [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:1)
- [infra/alerting-rules.yml](/home/lyes/trottistore/infra/alerting-rules.yml:1)
- [infra/prometheus.yml](/home/lyes/trottistore/infra/prometheus.yml:1)
- [services/ecommerce/src/routes/health.ts](/home/lyes/trottistore/services/ecommerce/src/routes/health.ts:1)
- [services/crm/src/routes/health.ts](/home/lyes/trottistore/services/crm/src/routes/health.ts:1)
- [services/sav/src/routes/health.ts](/home/lyes/trottistore/services/sav/src/routes/health.ts:1)
- [services/analytics/src/routes/health.ts](/home/lyes/trottistore/services/analytics/src/routes/health.ts:1)
- [services/ecommerce/src/plugins/metrics.ts](/home/lyes/trottistore/services/ecommerce/src/plugins/metrics.ts:1)
- [services/crm/src/plugins/metrics.ts](/home/lyes/trottistore/services/crm/src/plugins/metrics.ts:1)
- [services/sav/src/plugins/metrics.ts](/home/lyes/trottistore/services/sav/src/plugins/metrics.ts:1)
- [services/analytics/src/plugins/metrics.ts](/home/lyes/trottistore/services/analytics/src/plugins/metrics.ts:1)
- [scripts/smoke-staging.sh](/home/lyes/trottistore/scripts/smoke-staging.sh:1)

### Findings
1. `A10-01` `P1` La procédure backup/restore n’est pas opérable telle qu’écrite. Le script produit un dump SQL gzip (`.sql.gz`) depuis `docker-compose.prod.yml`, alors que le runbook documente un restore `pg_restore` sur un dump custom `.dump` et un environnement `docker-compose.dev.yml` local. Le backup généré n’est donc pas restorable avec la procédure publiée, et rien ne couvre un restore Railway réaliste.
   Réfs:
   - [infra/backup-db.sh](/home/lyes/trottistore/infra/backup-db.sh:4)
   - [infra/backup-db.sh](/home/lyes/trottistore/infra/backup-db.sh:12)
   - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:90)
   - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:102)
2. `A10-02` `P1` Les healthchecks post-deploy restent trop courts et partiels pour un rollout multi-service fiable. Les workflows attendent `30s`, contrôlent `/health` sur les 4 backends mais ne valident `/ready` que pour ecommerce. Un backend peut donc passer le déploiement tout en étant vivant sans dépendances prêtes, et un boot un peu lent échoue sans retry structuré.
   Réfs:
   - [.github/workflows/deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:171)
   - [.github/workflows/deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:180)
   - [.github/workflows/deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:204)
   - [.github/workflows/deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:79)
   - [.github/workflows/deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:88)
   - [.github/workflows/deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:112)
3. `A10-03` `P2` L’alerting Prometheus existe côté infra, mais le repo ne montre ni propriétaire, ni procédure d’escalade, ni runbook d’action associé aux alertes `ServiceDown`, `HighErrorRate`, `HighLatency`, `DatabaseUnhealthy`. L’outillage de monitoring est présent, la boucle opérationnelle ne l’est pas.
   Réfs:
   - [infra/alerting-rules.yml](/home/lyes/trottistore/infra/alerting-rules.yml:1)
   - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:127)
   - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:141)
4. `A10-04` `P1` L’alerte `DatabaseUnhealthy` n’est pas alimentée par la configuration Prometheus présente. La règle attend `probe_success{job="readiness"}`, mais `prometheus.yml` ne déclare que 4 scrapes `/metrics` et aucun job `readiness` ni blackbox exporter. En l’état, l’alerte DB/Redis critique ne peut pas se déclencher sur cette stack.
   Réfs:
   - [infra/alerting-rules.yml](/home/lyes/trottistore/infra/alerting-rules.yml:34)
   - [infra/prometheus.yml](/home/lyes/trottistore/infra/prometheus.yml:4)

### Non-Findings
- Les 4 services backend exposent bien `/health` et `/ready`, et les routes `ready` vérifient PostgreSQL et Redis avant de répondre `200`.
  Réfs:
  - [services/ecommerce/src/routes/health.ts](/home/lyes/trottistore/services/ecommerce/src/routes/health.ts:6)
  - [services/ecommerce/src/routes/health.ts](/home/lyes/trottistore/services/ecommerce/src/routes/health.ts:13)
  - [services/crm/src/routes/health.ts](/home/lyes/trottistore/services/crm/src/routes/health.ts:6)
  - [services/sav/src/routes/health.ts](/home/lyes/trottistore/services/sav/src/routes/health.ts:6)
  - [services/analytics/src/routes/health.ts](/home/lyes/trottistore/services/analytics/src/routes/health.ts:6)
- Les plugins metrics sont homogènes entre services et exposent `/metrics`, des métriques process par défaut et des histogrammes/counters HTTP, en excluant les endpoints de santé des stats de trafic.
  Réf:
  - [services/ecommerce/src/plugins/metrics.ts](/home/lyes/trottistore/services/ecommerce/src/plugins/metrics.ts:5)
  - [services/ecommerce/src/plugins/metrics.ts](/home/lyes/trottistore/services/ecommerce/src/plugins/metrics.ts:26)
  - [services/ecommerce/src/plugins/metrics.ts](/home/lyes/trottistore/services/ecommerce/src/plugins/metrics.ts:45)
- Le repo contient déjà un smoke script staging plus complet que les workflows de déploiement, avec contrôle des `/ready` sur les 4 services et quelques sondes web/API utiles.
  Réf:
  - [scripts/smoke-staging.sh](/home/lyes/trottistore/scripts/smoke-staging.sh:80)

### Angles Not Verified
- Vraies sauvegardes prod et fréquence effective
- Restore test réel sur un environnement isolé
- Load testing / p95 réels sous trafic
- Câblage réel Prometheus vers Alertmanager ou autre canal de notification
- Journalisation centralisée et exploitation incident au-delà des métriques/healthchecks

### Recommended Actions
- Aligner format de backup et procédure de restore, puis tester un restore sur un environnement isolé proche de Railway
- Étendre les healthchecks post-deploy avec retries bornés et `/ready` pour les 4 services
- Ajouter un mapping simple `alerte -> owner -> action immédiate`, puis brancher réellement la sonde `readiness` ou corriger la règle `DatabaseUnhealthy`

## Agent 11 — User Testing

> **Déplacé le 2026-04-12** vers [docs/user-testing/plan-2026-04-12.md](../user-testing/plan-2026-04-12.md).
>
> Raison : les `A11-*` sont des **hypothèses à valider par test utilisateur**, pas des findings de code review. Les garder dans le registre central faussait le compteur P1 et créait de la confusion lors des revues (finding code vs hypothèse UX). Ils restent actifs, mais dans leur propre document vivant.

---

## Changelog 2026-04-12

> Traçabilité complète de la passe de review croisée Claude ↔ Codex du 2026-04-12.

### Nouveaux findings ajoutés (10)

Issus de la cross-review Claude (10 sub-agents Explore) qui a trouvé des angles morts du batch codex initial :

| ID | Sévérité | Domaine | Résumé | Origine |
|---|---|---|---|---|
| `CL-01` | **P0** | Payments / Prod Safety | Stripe en mode TEST (`sk_test_...`) sur Railway production | Cross-review Claude |
| `CL-02` | P1 | Auth / IDOR | `GET /orders/:id` MANAGER/TECHNICIAN bypass ownership check | Cross-review Claude |
| `CL-03` | P1 | Email / XSS | XSS dans templates ecommerce (interpolation non échappée) | Cross-review Claude |
| `CL-04` | P1 | Checkout Integrity | Race condition double-attribution `loyaltyPoints` | Cross-review Claude |
| `CL-05` | P1 | Auth / Abuse | Brute-force `/repairs/:id/quote/accept-client` sans rate-limit dédié | Cross-review Claude |
| `CL-06` | P1 | Auth / Enumeration | Timing attack `/auth/forgot-password` | Cross-review Claude |
| `CL-07` | **P0** | Legal / Invoices | Numérotation facture non conforme art. 289 CGI | Cross-review Claude |
| `CL-08` | **P0** | Legal / Invoices | Pas d'envoi auto facture par email après paiement | Cross-review Claude |
| `CL-09` | P1 | Privacy / DPO | DPO contact = `brand.email` (mélange RGPD et SAV) | Cross-review Claude |
| `CL-10` | P2 | Payments / Idempotence | Pas d'`Idempotency-Key` sur POST /orders + /payment-intent | Cross-review Claude |
| `AX-01` | P2 | UX / Forms | Pas d'autocomplétion d'adresse BAN/Google Places, pas de dropdown département | External Audit (humain) |

**Total :** 3 P0, 6 P1, 2 P2 injectés.

### Findings downgradés (4)

Sévérité P1 → P2 car le hook global `onRequest` du service CRM rejette déjà CLIENT en 403 pour tout le périmètre de service. Les findings restent valides en defense in depth mais ne méritent pas le statut P1.

| ID | Avant | Après | Justification |
|---|---|---|---|
| `A1-01` | P1 | **P2** | Hook global CRM couvre déjà l'entrée de service → `requireRole` local est de la defense in depth, pas un fix de sécu critique |
| `A1-04` | P1 | **P2** | Idem — `campaigns` / `segments` protégés par le hook global |
| `A3-01` | P1 | **P2** | Doublon partiel avec A1-04, même couverture par hook global |
| `A3-02` | P1 | **P2** | Incohérence STAFF vs MANAGER+ sur `POST /triggers` mais STAFF n'est pas donné à des profils publics aujourd'hui |

### Finding passé en Accepted (1)

| ID | Avant | Après | Justification |
|---|---|---|---|
| `A3-03` | P1 Open | **P3 Accepted** | Comportement volontaire documenté dans `services/crm/src/routes/newsletter/index.ts:67` ("auto-confirm so the feature works in dev/staging"). Vérifié end-to-end sur prod le 2026-04-11 : Brevo configuré → status PENDING sur subscribe → double opt-in réel actif. Le fallback auto-confirm n'opère qu'en dev/staging sans SMTP ni Brevo. Pas un bug, une feature de continuité de service. |

### Findings déplacés (4)

Les hypothèses user testing `A11-*` sortent du registre central vers un document séparé :

| ID | Déplacé vers |
|---|---|
| `A11-01` | [docs/user-testing/plan-2026-04-12.md](../user-testing/plan-2026-04-12.md) |
| `A11-02` | [docs/user-testing/plan-2026-04-12.md](../user-testing/plan-2026-04-12.md) |
| `A11-03` | [docs/user-testing/plan-2026-04-12.md](../user-testing/plan-2026-04-12.md) |
| `A11-04` | [docs/user-testing/plan-2026-04-12.md](../user-testing/plan-2026-04-12.md) |

Le contenu détaillé (personas, devices, tâches critiques, mesures obligatoires) a été préservé 1:1 dans le nouveau doc.

### Décompte après mise à jour

**Avant cross-review (50 findings) :**
- P0 : 0
- P1 : 29
- P2 : 17
- P3 : 0
- Hypotheses : 4 (A11-*)

**Après cross-review (56 findings code + 4 hypotheses déplacées) :**
- **P0 : 3** (CL-01, CL-07, CL-08 — bloqueurs go-live commercial)
- **P1 : 27** (6 nouveaux CL-* + 25 existants - 4 downgradés)
- **P2 : 25** (4 downgrades A1/A3 + CL-10 + AX-01 + 19 existants)
- **P3 Accepted : 1** (A3-03)
- **Hypotheses (hors registre) : 4** (A11-* dans user testing plan)

### Prochain mouvement

Plan de PR partagé Claude ↔ Codex (validé 2026-04-12) :

| PR | Owner | Findings couverts |
|---|---|---|
| **PR-S1** Sécurité quick wins | Claude | CL-02 + CL-05 + CL-06 |
| **PR-S2** XSS email hardening | Claude | CL-03 |
| **PR-S3** Stock integrity unifié | **Codex** | A2-01 + A2-02 + A2-03 + CL-04 + A5-01 |
| **PR-O1** Monitoring DB + staging fix | Claude | A10-04 + A4-05 + A4-04 |
| **PR-L1** Mentions légales data-driven | Claude | A8-01 + CL-09 |
| **PR-L2** Factures conformes | Codex (après S3) | CL-07 + CL-08 + A9-01 (partiel) |
| **PR-UX1** Address autocomplete BAN | Claude | AX-01 |
| **PR-CRM1** RBAC distinction MANAGER/ADMIN | **Codex** | A1-01 + A1-04 + A3-01 + A3-02 |

---

*Registry vivant. Toute modification doit être tracée dans ce changelog. Mainteneurs : Claude Opus 4.6 + Codex.*
