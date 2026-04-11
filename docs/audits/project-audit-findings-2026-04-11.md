# Project Audit Findings — 2026-04-11

## Scope
- Registry central for agent-based audit findings.
- Current sections backfilled from completed reviews:
  - Agent 1: Security / Auth / RBAC
  - Agent 2: Stock / Orders / Checkout / SAV
  - Agent 4: Build / Run / Deploy / Infra

## Finding Index

| ID | Severity | Domain | Title | Status | Owner | Source |
|---|---|---|---|---|---|---|
| A2-01 | P1 | Stock Integrity | `POST /stock/movements` non atomique | Open | TBD | Agent 2 |
| A2-02 | P1 | Stock Integrity | SAV `/repairs/:id/parts` décrément stock non guardé | Open | TBD | Agent 2 |
| A2-03 | P1 | Stock Integrity | `cancel -> full refund` peut double-restocker | Open | TBD | Agent 2 |
| A2-04 | P2 | Stock Integrity | Réserve installment non centralisée dans un helper partagé | Open | TBD | Agent 2 |
| A1-01 | P1 | Auth / RBAC | Routes CRM `customers` sur-exposées aux rôles non-clients | Open | TBD | Agent 1 |
| A1-02 | P2 | Auth / Session | `accessToken` stocké en `localStorage` | Open | TBD | Agent 1 |
| A1-03 | P2 | Auth / Session | `/cart` downgrade bearer invalide vers anonyme | Open | TBD | Agent 1 |
| A4-01 | P1 | Build / Run | `infra/STAGING.md` obsolète sur les commandes runtime | Open | TBD | Agent 4 |
| A4-02 | P1 | Deploy / DB | Runbook rollback DB trop générique pour `migrate deploy` | Open | TBD | Agent 4 |
| A4-03 | P2 | Ops / Cron | `cron-triggers-run.yml` désactivé et ambigu | Open | TBD | Agent 4 |
| A4-04 | P2 | Deploy / Healthchecks | `sleep 30` fixe avant healthchecks | Open | TBD | Agent 4 |
| A4-05 | P2 | Infra / Env | Convention `PORT_*` vs `PORT` duale | Open | TBD | Agent 4 |
| A5-01 | P1 | Data Integrity | `stock_reserved` n’a aucune contrainte DB de non-négativité | Open | TBD | Agent 5 |
| A5-02 | P1 | Scripts / Prod Safety | `seed-demo.ts` n’est pas idempotent et peut dupliquer des données métier | Open | TBD | Agent 5 |
| A5-03 | P1 | Catalog Sync | `sync-woocommerce.ts` fait des refresh destructifs sans transaction | Open | TBD | Agent 5 |
| A5-04 | P2 | Scripts / Auth | `seed-demo.ts` garde un mot de passe hardcodé et ne met pas à jour les users existants | Open | TBD | Agent 5 |
| A3-01 | P1 | CRM / RBAC | `campaigns` et `segments` sont accessibles à tout rôle non-CLIENT | Open | TBD | Agent 3 |
| A3-02 | P1 | CRM / RBAC | `POST /triggers` autorise `STAFF` alors que le reste des triggers demande manager+ | Open | TBD | Agent 3 |
| A3-03 | P1 | Newsletter / Consent | newsletter auto-confirme si l’email ne part pas | Open | TBD | Agent 3 |
| A3-04 | P2 | Campaigns / Abuse | preview et send permettent des envois arbitraires sans garde locale explicite | Open | TBD | Agent 3 |
| A6-01 | P1 | Accessibility / Forms | formulaires critiques reposent largement sur des placeholders sans labels explicites | Open | TBD | Agent 6 |
| A6-02 | P2 | Accessibility / Navigation | bouton menu mobile sans `aria-expanded`/`aria-controls` | Open | TBD | Agent 6 |
| A6-03 | P2 | Accessibility / Dialogs | `CookieBanner` expose un `role=\"dialog\"` sans `aria-modal` ni vraie gestion du focus | Open | TBD | Agent 6 |
| A6-04 | P2 | UX / Account Ops | `mon-compte` utilise `alert()` / `confirm()` pour export et suppression de compte | Open | TBD | Agent 6 |
| A7-01 | P1 | SEO / Canonical | canonical racine `./` risque d’être hérité par beaucoup de pages publiques | Open | TBD | Agent 7 |
| A7-02 | P1 | SEO / Sitemap | sitemap produit dépend d’une API interne et échoue silencieusement en liste vide | Open | TBD | Agent 7 |
| A7-03 | P2 | SEO / Structured Data | `LocalBusiness` + `FAQPage` sont injectés globalement sur tout le site | Open | TBD | Agent 7 |
| A8-01 | P1 | Legal / Trust | mentions légales encore incomplètes avec placeholders publics | Open | TBD | Agent 8 |
| A8-02 | P1 | Privacy / Consent | politique cookies ne reflète pas le banner analytics ni les endpoints de tracking | Open | TBD | Agent 8 |
| A8-03 | P1 | Legal / Claims | plusieurs claims marketing/délai persistent encore sur des pages publiques | Open | TBD | Agent 8 |
| A9-01 | P1 | Email / Reliability | emails transactionnels sont déclenchés en fire-and-forget sans retour utilisateur ni statut persistant | Open | TBD | Agent 9 |
| A9-02 | P1 | Email / Deliverability | expéditeurs et URLs de base sont dispersés et incohérents selon les modules | Open | TBD | Agent 9 |
| A9-03 | P2 | Messaging / Observability | absence de journalisation métier unifiée des emails hors SAV / campagnes | Open | TBD | Agent 9 |
| A10-01 | P1 | Ops / Recovery | backup DB existe mais aucun restore/runbook de restauration n’est couvert | Open | TBD | Agent 10 |
| A10-02 | P1 | Deploy / Reliability | healthchecks post-deploy sont trop courts et partiels pour fiabiliser un rollout multi-service | Open | TBD | Agent 10 |
| A10-03 | P2 | Ops / Monitoring | alerting Prometheus existe en infra mais pas relié à un runbook/owner visible dans le repo | Open | TBD | Agent 10 |
| A11-01 | P1 | User Testing / Checkout | parcours guest vs compte à valider sur device réel avant de conclure sur la friction checkout | Hypothesis | UX Owner | Agent 11 |
| A11-02 | P1 | User Testing / Repair Intake | parcours `reparation` / `urgence` à valider sur compréhension, confiance et recovery utilisateur | Hypothesis | Ops / UX | Agent 11 |
| A11-03 | P2 | User Testing / Backoffice | workflows admin commandes et SAV à mesurer sur vitesse d’exécution et erreurs opérateur | Hypothesis | Backoffice Owner | Agent 11 |

## Agent 1 — Security / Auth / RBAC

### Scope Audited
- [services/ecommerce/src/plugins/auth.ts](/home/lyes/trottistore/services/ecommerce/src/plugins/auth.ts:1)
- [services/crm/src/plugins/auth.ts](/home/lyes/trottistore/services/crm/src/plugins/auth.ts:1)
- [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:76)
- [services/sav/src/index.ts](/home/lyes/trottistore/services/sav/src/index.ts:69)
- [services/analytics/src/index.ts](/home/lyes/trottistore/services/analytics/src/index.ts:67)
- [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:65)
- [services/ecommerce/src/routes/cart/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/cart/index.ts:171)
- [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:108)
- [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:520)
- [apps/web/src/lib/api.ts](/home/lyes/trottistore/apps/web/src/lib/api.ts:58)

### Findings
1. `A1-01` `P1` Routes CRM `customers` sur-exposées à tout utilisateur authentifié non-`CLIENT`. Le hook global CRM ne bloque que `CLIENT`, et plusieurs routes n’ont pas de garde locale `MANAGER+/ADMIN`.
   Réfs:
   - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:123)
   - [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:65)
   - [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:266)
   - [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:595)
   - [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:637)
2. `A1-02` `P2` Le front stocke l’`accessToken` en `localStorage`, ce qui l’expose à toute XSS navigateur.
   Réfs:
   - [apps/web/src/lib/api.ts](/home/lyes/trottistore/apps/web/src/lib/api.ts:58)
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:108)
3. `A1-03` `P2` La route panier downgrade un bearer invalide vers anonyme au lieu de renvoyer `401`.
   Réf:
   - [services/ecommerce/src/routes/cart/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/cart/index.ts:171)

### Non-Findings
- Le refresh token est bien posé en cookie `httpOnly`, `sameSite: strict`, `secure` en prod.
  Réf:
  - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:108)
- Le bypass cron CRM est désormais bien scopé à `POST /triggers/run` avec nonce par process.
  Réf:
  - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:104)
- Le service analytics restreint correctement les routes privées à `SUPERADMIN|ADMIN|MANAGER`, sauf l’ingest public explicitement prévu.
  Réf:
  - [services/analytics/src/index.ts](/home/lyes/trottistore/services/analytics/src/index.ts:67)
- Le SAV isole explicitement ses endpoints publics dans le hook global, le reste passe par auth.
  Réf:
  - [services/sav/src/index.ts](/home/lyes/trottistore/services/sav/src/index.ts:81)
- Le détail ticket SAV protège bien l’ownership `CLIENT` et `assignedTo` côté `TECHNICIAN`.
  Réf:
  - [services/sav/src/routes/tickets/index.ts](/home/lyes/trottistore/services/sav/src/routes/tickets/index.ts:539)

### Angles Not Verified
- Routes CRM hors `customers`
- Flows front complets autour de `accessToken`
- Distribution réelle des JWT CRM par rôle en prod
- Rate limiting détaillé des endpoints publics SAV/analytics
- Politique CSP/XSS globale du front

### Recommended Actions
- Ajouter des gardes explicites `MANAGER|ADMIN|SUPERADMIN` sur les routes CRM `customers`
- Clarifier la matrice de rôles inter-services
- Sortir l’`accessToken` du `localStorage` si possible
- Faire échouer `/cart` avec `401` si bearer présent mais invalide
- Ajouter des smoke tests authz pour CRM `customers`

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
4. `A2-04` `P2` La réserve stock des paiements fractionnés est cohérente au create/cancel, mais elle n’est pas protégée par un helper partagé.
   Réfs:
   - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:521)
   - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:840)

### Non-Findings
- Le décrément stock sur création de commande carte/auth/guest/admin est bien gardé atomiquement via `decrementStockOrThrow`.
  Réfs:
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:152)
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:529)
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:846)
- Les races de création de commande sont déjà couvertes par test pour auth, guest et admin.
  Réf:
  - [services/ecommerce/src/routes/orders/orders.race.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/orders.race.test.ts:222)
- Le webhook Stripe ne décrémente plus le stock sur `main`; il confirme seulement paiement + statut.
  Réf:
  - [services/ecommerce/src/routes/checkout/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/checkout/index.ts:393)
- Le refund refuse correctement une commande déjà `REFUNDED`.
  Réfs:
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:1469)
  - [services/ecommerce/src/routes/orders/orders-admin.integration.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/orders-admin.integration.test.ts:158)

### Angles Not Verified
- Test de contention sur `POST /stock/movements`
- Test SAV “stock insuffisant sur /parts”
- Test admin `cancel -> refund` sans double restock
- Test de contention sur `stockReserved`
- Validation DB réelle/Testcontainers

### Recommended Actions
- Extraire `InsufficientStockError` + `decrementStockOrThrow` dans `@trottistore/shared`
- Réutiliser ce helper dans `SAV /parts`
- Corriger `POST /stock/movements` avec un décrément atomique guardé
- Neutraliser le second restock sur `refund` après `cancel`
- Ajouter les tests manquants

## Agent 4 — Build / Run / Deploy / Infra

### Scope Audited
- [package.json](/home/lyes/trottistore/package.json:1)
- [services/ecommerce/package.json](/home/lyes/trottistore/services/ecommerce/package.json:1)
- [services/crm/package.json](/home/lyes/trottistore/services/crm/package.json:1)
- [services/sav/package.json](/home/lyes/trottistore/services/sav/package.json:1)
- [services/analytics/package.json](/home/lyes/trottistore/services/analytics/package.json:1)
- Workflows:
  - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:1)
  - [ci.yml](/home/lyes/trottistore/.github/workflows/ci.yml:1)
  - [cron-triggers-run.yml](/home/lyes/trottistore/.github/workflows/cron-triggers-run.yml:1)
- Infra/docs:
  - [infra/STAGING.md](/home/lyes/trottistore/infra/STAGING.md:1)
  - [docker-compose.prod.yml](/home/lyes/trottistore/docker-compose.prod.yml:1)
  - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:1)
- Dockerfiles:
  - [services/ecommerce/Dockerfile](/home/lyes/trottistore/services/ecommerce/Dockerfile:1)
  - [services/crm/Dockerfile](/home/lyes/trottistore/services/crm/Dockerfile:1)
  - [services/sav/Dockerfile](/home/lyes/trottistore/services/sav/Dockerfile:1)
  - [services/analytics/Dockerfile](/home/lyes/trottistore/services/analytics/Dockerfile:1)

### Findings
1. `A4-01` `P1` La doc staging est obsolète sur les commandes de démarrage Fastify et peut induire des déploiements cassés hors du pipeline Railway actuel.
   Réfs:
   - [infra/STAGING.md](/home/lyes/trottistore/infra/STAGING.md:14)
   - [services/ecommerce/Dockerfile](/home/lyes/trottistore/services/ecommerce/Dockerfile:55)
2. `A4-02` `P1` Le runbook de rollback DB reste trop générique par rapport au CD réel qui exécute `prisma migrate deploy` directement sur prod avant déploiement.
   Réfs:
   - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:40)
   - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:49)
3. `A4-03` `P2` Le workflow `cron-triggers-run.yml` est désactivé et garde une configuration/documentation ambiguë.
   Réf:
   - [cron-triggers-run.yml](/home/lyes/trottistore/.github/workflows/cron-triggers-run.yml:1)
4. `A4-04` `P2` Le deploy production repose sur une attente fixe de 30 secondes avant healthchecks, sans vraie stratégie de retry longue.
   Réf:
   - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:171)
5. `A4-05` `P2` La configuration port/env est duale et facile à rater hors pipeline officiel.
   Réfs:
   - [services/ecommerce/src/index.ts](/home/lyes/trottistore/services/ecommerce/src/index.ts:40)
   - [docker-compose.prod.yml](/home/lyes/trottistore/docker-compose.prod.yml:44)

### Non-Findings
- Les `start` scripts des 4 services sont désormais alignés avec le runtime réel `node --import tsx src/index.ts`.
  Réf:
  - [services/ecommerce/package.json](/home/lyes/trottistore/services/ecommerce/package.json:6)
- Les Dockerfiles Fastify sont cohérents entre eux et alignés sur le runtime `tsx` documenté.
  Réf:
  - [services/crm/Dockerfile](/home/lyes/trottistore/services/crm/Dockerfile:32)
- Le pipeline production sépare correctement `prepare-database` et `deploy`, et bloque le déploiement si la préparation DB échoue.
  Réf:
  - [deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:40)
- La CI gate couvre lint, build, docker build, validate schema, unit, smoke, security scan et e2e PR.
  Réf:
  - [ci.yml](/home/lyes/trottistore/.github/workflows/ci.yml:220)
- Les services exposent bien `/health` et `/ready`, avec readiness DB+Redis au moins sur ecommerce/CRM.
  Réfs:
  - [services/ecommerce/src/routes/health.ts](/home/lyes/trottistore/services/ecommerce/src/routes/health.ts:9)
  - [services/crm/src/routes/health.ts](/home/lyes/trottistore/services/crm/src/routes/health.ts:9)

### Angles Not Verified
- Commandes Railway réelles service par service
- `deploy-staging.yml` complet
- Parité `/ready` sur tous les services
- Test réel rollback migration / restore backup
- Drift réel GitHub secrets/vars vs Railway envs

### Recommended Actions
- Mettre à jour [infra/STAGING.md](/home/lyes/trottistore/infra/STAGING.md:14)
- Écrire un runbook DB concret pour les migrations prod
- Clarifier le rôle du workflow [cron-triggers-run.yml](/home/lyes/trottistore/.github/workflows/cron-triggers-run.yml:1)
- Remplacer le `sleep 30` fixe par une boucle de retry bornée
- Harmoniser la convention `PORT_*` vs `PORT` ou la documenter explicitement

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
- Tous les scripts annexes `simulate-month.ts`, `crawl.ts`, `download-images.ts`
- Effets d’un rerun `sync-woocommerce.ts` contre un catalogue prod réel
- Existence d’une politique centralisée de “demo data forbidden in prod”

### Recommended Actions
- Ajouter une contrainte DB `stock_reserved >= 0`
- Mettre un garde d’environnement explicite sur `seed-demo.ts` et/ou le rendre réellement idempotent
- Encapsuler la sync WooCommerce produit par produit dans une transaction ou utiliser une stratégie non destructive
- Documenter quels scripts sont sûrs en prod, staging, demo only
- Aligner `seed-demo.ts` sur les mêmes règles auth que `seed.ts` si ce script reste utilisé

## Agent 3 — CRM / Cron / Newsletter

### Scope Audited
- [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:1)
- [services/crm/src/routes/customers/index.ts](/home/lyes/trottistore/services/crm/src/routes/customers/index.ts:1)
- [services/crm/src/routes/segments/index.ts](/home/lyes/trottistore/services/crm/src/routes/segments/index.ts:1)
- [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:1)
- [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:1)
- [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:1)
- Tests:
  - [services/crm/src/routes/smoke/authz.smoke.test.ts](/home/lyes/trottistore/services/crm/src/routes/smoke/authz.smoke.test.ts:1)
  - [services/crm/src/routes/campaigns/campaigns.integration.test.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/campaigns.integration.test.ts:1)
  - [services/crm/src/routes/segments/segments.integration.test.ts](/home/lyes/trottistore/services/crm/src/routes/segments/segments.integration.test.ts:1)
  - [services/crm/src/routes/newsletter/newsletter.integration.test.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/newsletter.integration.test.ts:1)
  - [services/crm/src/routes/triggers/triggers.integration.test.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/triggers.integration.test.ts:1)

### Findings
1. `A3-01` `P1` Les routes `campaigns` et `segments` sont accessibles à tout utilisateur authentifié non-`CLIENT`, y compris `TECHNICIAN` et `STAFF`, car elles n’ont aucune garde locale. Le hook global CRM ne bloque que `CLIENT`; un rôle backoffice faible peut donc créer des segments, lire des campagnes, envoyer des previews et lancer des campagnes marketing.
   Réfs:
   - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:123)
   - [services/crm/src/routes/segments/index.ts](/home/lyes/trottistore/services/crm/src/routes/segments/index.ts:61)
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:70)
   - [services/crm/src/routes/smoke/authz.smoke.test.ts](/home/lyes/trottistore/services/crm/src/routes/smoke/authz.smoke.test.ts:31)
2. `A3-02` `P1` `POST /triggers` autorise `STAFF` alors que `GET /triggers`, `GET /triggers/:id/logs`, `POST /triggers/run` et `PUT /triggers/:id/toggle` exigent manager+. La garde locale sur création ne bloque que `CLIENT` et `TECHNICIAN`.
   Réfs:
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:42)
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:60)
   - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:123)
3. `A3-03` `P1` Le flow newsletter auto-confirme les abonnements si l’email de confirmation ne part pas. En cas de transport absent/mal configuré en prod, le système bascule silencieusement de double opt-in à single opt-in, ce qui casse la preuve de consentement attendue.
   Réfs:
   - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:66)
   - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:69)
   - [services/crm/src/routes/newsletter/newsletter.integration.test.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/newsletter.integration.test.ts:49)
4. `A3-04` `P2` Les endpoints `campaigns/:id/preview` et `campaigns/:id/send` permettent des envois email réels sans garde locale explicite ni contrainte forte de rôle. Techniquement c’est une déclinaison de `A3-01`, mais c’est la surface d’abus la plus sensible: un rôle non-manager peut spammer une adresse arbitraire via preview ou lancer une campagne segmentée.
   Réfs:
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:227)
   - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:265)

### Non-Findings
- Le bypass cron est désormais bien limité à `POST /triggers/run` avec secret nonce par process et ré-vérification locale.
  Réfs:
  - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:98)
  - [services/crm/src/routes/triggers/index.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/index.ts:84)
  - [services/crm/src/routes/triggers/triggers.integration.test.ts](/home/lyes/trottistore/services/crm/src/routes/triggers/triggers.integration.test.ts:113)
- Les routes newsletter publiques sont explicitement et précisément scopées à `subscribe`, `confirm`, `unsubscribe`.
  Réf:
  - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:88)
- Le subscribe newsletter ne révèle pas si un email déjà `CONFIRMED` existe.
  Réfs:
  - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:58)
  - [services/crm/src/routes/newsletter/newsletter.integration.test.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/newsletter.integration.test.ts:80)
- Le `campaignSend` empêche déjà le double envoi exact `campaignId + customerId` via lookup d’idempotence avant création.
  Réf:
  - [services/crm/src/routes/campaigns/index.ts](/home/lyes/trottistore/services/crm/src/routes/campaigns/index.ts:329)

### Angles Not Verified
- Rate limiting réel par IP/instance sur les endpoints newsletter publics au-delà du plugin global
- Configuration prod exacte `BREVO_API_KEY` / SMTP pour savoir si `A3-03` est actuellement exploitable
- Tous les rôles réellement émis par l’auth centrale vers le service CRM en prod
- Comportement multi-instance du cron in-process si plusieurs pods CRM tournent simultanément
- Preuve de consentement/export CRM autour des abonnés newsletter

### Recommended Actions
- Ajouter des gardes explicites `MANAGER|ADMIN|SUPERADMIN` sur `segments` et `campaigns`
- Aligner `POST /triggers` sur la même politique manager+ que le reste du module
- Réserver l’auto-confirm newsletter aux environnements non-prod, ou le rendre opt-in via env explicite
- Ajouter des smoke tests authz par rôle sur `segments`, `campaigns` et `triggers`

## Agent 6 — Frontend / UX / Accessibility

### Scope Audited
- Layout global:
  - [apps/web/src/app/layout.tsx](/home/lyes/trottistore/apps/web/src/app/layout.tsx:1)
- Components:
  - [apps/web/src/components/Header.tsx](/home/lyes/trottistore/apps/web/src/components/Header.tsx:1)
  - [apps/web/src/components/NewsletterForm.tsx](/home/lyes/trottistore/apps/web/src/components/NewsletterForm.tsx:1)
  - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:1)
  - [apps/web/src/components/SOSButton.tsx](/home/lyes/trottistore/apps/web/src/components/SOSButton.tsx:1)
- Pages critiques:
  - [apps/web/src/app/(shop)/checkout/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/checkout/page.tsx:1)
  - [apps/web/src/app/(shop)/panier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/panier/page.tsx:1)
  - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:1)

### Findings
1. `A6-01` `P1` Plusieurs formulaires critiques reposent encore largement sur des placeholders au lieu de labels explicites, surtout sur `checkout` invité/nouvelle adresse et `NewsletterForm`. C’est un problème d’accessibilité et de robustesse UX: lecteur d’écran, dictée vocale et compréhension mobile sont dégradés.
   Réfs:
   - [apps/web/src/components/NewsletterForm.tsx](/home/lyes/trottistore/apps/web/src/components/NewsletterForm.tsx:55)
   - [apps/web/src/app/(shop)/checkout/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/checkout/page.tsx:401)
   - [apps/web/src/app/(shop)/checkout/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/checkout/page.tsx:450)
   - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:458)
2. `A6-02` `P2` Le bouton menu mobile du header n’expose pas `aria-expanded` ni `aria-controls`, alors qu’il ouvre un panneau modal de navigation. L’interface reste utilisable, mais l’état du contrôle n’est pas annoncé correctement aux technologies d’assistance.
   Réfs:
   - [apps/web/src/components/Header.tsx](/home/lyes/trottistore/apps/web/src/components/Header.tsx:291)
   - [apps/web/src/components/Header.tsx](/home/lyes/trottistore/apps/web/src/components/Header.tsx:366)
3. `A6-03` `P2` `CookieBanner` déclare un `role="dialog"` mais sans `aria-modal`, sans focus initial ni focus trap. Sur clavier/lecteur d’écran, ce n’est pas un vrai dialogue accessible; le focus peut continuer derrière la bannière.
   Réfs:
   - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:61)
   - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:73)
4. `A6-04` `P2` `mon-compte` s’appuie encore sur `alert()` et double `confirm()` pour l’export et la suppression de compte. C’est fonctionnel, mais pauvre en UX, non stylé, peu contrôlable et fragile sur mobile/webview.
   Réfs:
   - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:190)
   - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:199)
   - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:209)

### Non-Findings
- Le layout global définit bien `viewportFit: "cover"` et `device-width`, cohérent avec l’objectif iPhone/mobile.
  Réf:
  - [apps/web/src/app/layout.tsx](/home/lyes/trottistore/apps/web/src/app/layout.tsx:39)
- `Header` et `SOSButton` ferment bien sur `Escape`, et les deux implémentent un focus trap minimal quand leur panneau est ouvert.
  Réfs:
  - [apps/web/src/components/Header.tsx](/home/lyes/trottistore/apps/web/src/components/Header.tsx:28)
  - [apps/web/src/components/SOSButton.tsx](/home/lyes/trottistore/apps/web/src/components/SOSButton.tsx:21)
- `mon-compte` expose correctement les erreurs de login dans un conteneur `role="alert"`.
  Réf:
  - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:450)
- `panier` a un `h1` explicite hors loading state et un `aria-label` sur la suppression d’article.
  Réfs:
  - [apps/web/src/app/(shop)/panier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/panier/page.tsx:74)
  - [apps/web/src/app/(shop)/panier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/panier/page.tsx:159)

### Angles Not Verified
- Audit visuel réel sur iPhone/VoiceOver/zoom 200%
- Contrastes réels et ordre de focus sur toutes les pages publiques
- Parcours complet checkout Stripe dans un vrai navigateur
- Accessibilité des composants non relus ici (`AddressSection`, `GarageSection`, pages marketing longues)
- Performance front et SEO détaillés, réservés à l’Agent 7

### Recommended Actions
- Ajouter des labels explicites et `id/htmlFor` à tous les champs du `checkout` et à `NewsletterForm`
- Ajouter `aria-expanded` et `aria-controls` au bouton menu mobile du header
- Soit déclasser `CookieBanner` en simple bannière, soit en faire un vrai dialog accessible avec focus management
- Remplacer `alert()/confirm()` sur `mon-compte` par des modales/alerts UI cohérentes

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
  - [apps/web/src/app/(shop)/faq/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/faq/page.tsx:1)
  - [apps/web/src/app/(shop)/avis/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/avis/page.tsx:1)
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

## Agent 8 — Privacy / Consent / Legal / Trust

### Scope Audited
- Consent / cookies:
  - [apps/web/src/components/ConsentCheckbox.tsx](/home/lyes/trottistore/apps/web/src/components/ConsentCheckbox.tsx:1)
  - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:1)
- Pages légales / trust:
  - [apps/web/src/app/(shop)/politique-confidentialite/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/politique-confidentialite/page.tsx:1)
  - [apps/web/src/app/(shop)/cookies/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/cookies/page.tsx:1)
  - [apps/web/src/app/(shop)/mentions-legales/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mentions-legales/page.tsx:1)
  - [apps/web/src/app/(shop)/cgv/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/cgv/page.tsx:1)
  - [apps/web/src/app/(shop)/livraison/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/livraison/page.tsx:1)
  - [apps/web/src/app/(shop)/a-propos/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/a-propos/page.tsx:1)
  - [apps/web/src/app/(shop)/atelier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/atelier/page.tsx:1)
  - [apps/web/src/app/(shop)/avis/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/avis/page.tsx:1)
- Review of remaining claims via grep across `apps/web/src/app`, `apps/web/src/components`, `apps/web/src/lib`

### Findings
1. `A8-01` `P1` Les mentions légales sont encore incomplètes en production visible: `SIRET`, `RCS`, `capital social` et `directeur de publication` sont laissés en placeholders `[À COMPLÉTER]`. C’est un trou de conformité/trust simple et visible.
   Réf:
   - [apps/web/src/app/(shop)/mentions-legales/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mentions-legales/page.tsx:16)
2. `A8-02` `P1` La politique cookies ne reflète pas le comportement réel du site. Le banner propose un consentement `analytics`, et le front dispose d’un flow `analyticsApi.trackFunnel`, mais la page `/cookies` ne documente que `refresh_token` et ne liste ni finalité analytics, ni mécanisme de retrait, ni stockage du consentement `cookie-consent`.
   Réfs:
   - [apps/web/src/components/CookieBanner.tsx](/home/lyes/trottistore/apps/web/src/components/CookieBanner.tsx:80)
   - [apps/web/src/lib/funnel-tracking.ts](/home/lyes/trottistore/apps/web/src/lib/funnel-tracking.ts:1)
   - [apps/web/src/app/(shop)/cookies/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/cookies/page.tsx:13)
3. `A8-03` `P1` Plusieurs claims marketing/délai restent encore sur des pages publiques malgré le chantier C1: `diagnostic gratuit`, `Livraison France 48h`, `retour gratuit 14 jours`, `nous vous contacterons sous 24h/24-48h`, `Livraison 48h`, et des stats hardcodées type `2000+ références` / `700+ pièces`. Certaines sont peut-être vraies, mais elles restent des engagements ou promesses visibles qui demandent validation business/légale explicite.
   Réfs:
   - [apps/web/src/app/(shop)/atelier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/atelier/page.tsx:10)
   - [apps/web/src/app/(shop)/livraison/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/livraison/page.tsx:9)
   - [apps/web/src/app/(shop)/produits/[slug]/AddToCartSection.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/produits/[slug]/AddToCartSection.tsx:97)
   - [apps/web/src/app/(shop)/reparation/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/page.tsx:209)
   - [apps/web/src/app/(shop)/faq/faq-data.ts](/home/lyes/trottistore/apps/web/src/app/(shop)/faq/faq-data.ts:75)

### Non-Findings
- Les formulaires publics relus (`newsletter`, `urgence`, `reparation`, `pro`) exigent bien une case de consentement explicite avant submit.
  Réfs:
  - [apps/web/src/components/ConsentCheckbox.tsx](/home/lyes/trottistore/apps/web/src/components/ConsentCheckbox.tsx:14)
  - [apps/web/src/app/(shop)/urgence/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/urgence/page.tsx:79)
  - [apps/web/src/app/(shop)/reparation/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/page.tsx:81)
  - [apps/web/src/app/(shop)/pro/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/pro/page.tsx:101)
- La page `avis` n’affiche plus de wording “Google” trompeur, et l’atelier renvoie vers “avis vérifiés” sans compteur fictif visible dans le code relu.
  Réfs:
  - [apps/web/src/app/(shop)/avis/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/avis/page.tsx:5)
  - [apps/web/src/app/(shop)/atelier/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/atelier/page.tsx:202)
- Les CGV mentionnent bien médiation, rétractation et garantie légale de conformité.
  Réf:
  - [apps/web/src/app/(shop)/cgv/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/cgv/page.tsx:42)

### Angles Not Verified
- Véracité business réelle des chiffres/stats affichés (`2000+`, `700+`, `15+`)
- Conformité juridique fine du wording des pages légales au regard de l’entité exacte
- Présence éventuelle de scripts analytics tiers réels chargés ailleurs que dans le code relu ici
- CMP/consent logging côté serveur ou preuve horodatée exploitable
- Emails transactionnels et wording légal dans les templates hors périmètre web

### Recommended Actions
- Compléter immédiatement les mentions légales avec les vraies informations société
- Mettre la page `/cookies` à niveau avec le comportement réel du banner et des événements analytics
- Ouvrir un second passage “claims audit” ciblé sur les promesses de délai, gratuité et chiffres marketing encore visibles

## Agent 9 — Email / Messaging

### Scope Audited
- Shared notifications:
  - [packages/shared/src/notifications/transport.ts](/home/lyes/trottistore/packages/shared/src/notifications/transport.ts:1)
  - [packages/shared/src/notifications/email.ts](/home/lyes/trottistore/packages/shared/src/notifications/email.ts:1)
- Ecommerce templates and routes:
  - [services/ecommerce/src/emails/templates.ts](/home/lyes/trottistore/services/ecommerce/src/emails/templates.ts:1)
  - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:625)
  - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:596)
  - [services/ecommerce/src/routes/admin-users/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/admin-users/index.ts:199)
- CRM newsletter:
  - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:1)
- SAV notifications:
  - [services/sav/src/notifications/engine.ts](/home/lyes/trottistore/services/sav/src/notifications/engine.ts:1)
- Tests:
  - [services/ecommerce/src/routes/auth/emails.integration.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/emails.integration.test.ts:1)

### Findings
1. `A9-01` `P1` Les emails transactionnels critiques sont envoyés en fire-and-forget sans retour utilisateur, sans retry et sans statut persistant. `forgot-password`, confirmations de commande, invitations staff et reset admin loguent l’erreur au mieux, mais renvoient quand même un succès applicatif. Si SMTP/Brevo est down, l’utilisateur voit “email envoyé” ou “commande confirmée” sans aucun moyen de savoir que le message est perdu.
   Réfs:
   - [packages/shared/src/notifications/email.ts](/home/lyes/trottistore/packages/shared/src/notifications/email.ts:24)
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:664)
   - [services/ecommerce/src/routes/orders/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/orders/index.ts:596)
   - [services/ecommerce/src/routes/admin-users/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/admin-users/index.ts:208)
2. `A9-02` `P1` Les expéditeurs et URLs de base sont dispersés et incohérents selon les modules. La couche partagée email utilise `MAIL_FROM` / défaut `commandes@trottistore.fr`, le SAV utilise `BREVO_SENDER_EMAIL || sav@trottistore.fr`, les templates ecommerce utilisent `BASE_URL`, la newsletter CRM `PUBLIC_WEB_URL`, et le tracking SAV aussi `BASE_URL`. Cette dispersion augmente le risque d’URLs incorrectes, d’expéditeurs divergents, et de délivrabilité DNS incomplète.
   Réfs:
   - [packages/shared/src/notifications/email.ts](/home/lyes/trottistore/packages/shared/src/notifications/email.ts:16)
   - [services/ecommerce/src/emails/templates.ts](/home/lyes/trottistore/services/ecommerce/src/emails/templates.ts:6)
   - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:24)
   - [services/sav/src/notifications/engine.ts](/home/lyes/trottistore/services/sav/src/notifications/engine.ts:95)
3. `A9-03` `P2` Il n’existe pas de journalisation métier unifiée des emails hors SAV/campaigns. Le SAV a un moteur de notification avec résultat structuré et `notification_logs`; les emails ecommerce simples et la newsletter n’écrivent aucun log applicatif de délivrance/bounce/skipped. En incident, on ne peut pas auditer facilement “qui n’a jamais reçu quoi”.
   Réfs:
   - [packages/database/prisma/schema.prisma](/home/lyes/trottistore/packages/database/prisma/schema.prisma:680)
   - [services/sav/src/notifications/engine.ts](/home/lyes/trottistore/services/sav/src/notifications/engine.ts:213)
   - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:669)

### Non-Findings
- La couche partagée a bien un fallback SMTP -> Brevo -> warning, donc l’envoi ne dépend pas d’un seul transport.
  Réfs:
  - [packages/shared/src/notifications/transport.ts](/home/lyes/trottistore/packages/shared/src/notifications/transport.ts:42)
  - [packages/shared/src/notifications/email.ts](/home/lyes/trottistore/packages/shared/src/notifications/email.ts:34)
- Les tokens newsletter et reset password sont générés de façon aléatoire et ne sont pas envoyés en clair côté DB.
  Réfs:
  - [services/crm/src/routes/newsletter/index.ts](/home/lyes/trottistore/services/crm/src/routes/newsletter/index.ts:20)
  - [services/ecommerce/src/routes/auth/index.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/index.ts:654)
- Les tests couvrent bien que les appels à `sendEmail` sont déclenchés sur inscription et forgot-password.
  Réf:
  - [services/ecommerce/src/routes/auth/emails.integration.test.ts](/home/lyes/trottistore/services/ecommerce/src/routes/auth/emails.integration.test.ts:1)
- Le moteur SAV a une stratégie plus robuste que le reste: templates, fallback, résultat structuré.
  Réf:
  - [services/sav/src/notifications/engine.ts](/home/lyes/trottistore/services/sav/src/notifications/engine.ts:131)

### Angles Not Verified
- DNS réels SPF/DKIM/DMARC et réputation des domaines expéditeurs
- Bounce/webhook processing côté Brevo
- Templates réels Brevo utilisés par SAV si `BREVO_TPL_*` est configuré
- Boîte de réception réelle et classement spam
- SMS transactionnels réels et conformité sender côté Brevo

### Recommended Actions
- Définir une politique claire: quels emails sont “best effort” et lesquels doivent être considérés comme critiques
- Centraliser `MAIL_FROM`, sender display name et base public URL dans un contrat partagé
- Ajouter un audit log léger pour les emails transactionnels ecommerce/newsletter, pas seulement SAV/campaigns

## Agent 10 — Reliability / Load / Ops

### Scope Audited
- Workflows / deploy:
  - [.github/workflows/deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:1)
  - [.github/workflows/deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:1)
  - [.github/workflows/cron-triggers-run.yml](/home/lyes/trottistore/.github/workflows/cron-triggers-run.yml:1)
- Infra / runbooks:
  - [infra/deploy.sh](/home/lyes/trottistore/infra/deploy.sh:1)
  - [infra/backup-db.sh](/home/lyes/trottistore/infra/backup-db.sh:1)
  - [infra/STAGING.md](/home/lyes/trottistore/infra/STAGING.md:1)
  - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:1)
  - [infra/alerting-rules.yml](/home/lyes/trottistore/infra/alerting-rules.yml:1)
  - [infra/prometheus.yml](/home/lyes/trottistore/infra/prometheus.yml:1)
- Service health / metrics:
  - [services/ecommerce/src/routes/health.ts](/home/lyes/trottistore/services/ecommerce/src/routes/health.ts:1)
  - [services/crm/src/routes/health.ts](/home/lyes/trottistore/services/crm/src/routes/health.ts:1)
  - [services/sav/src/routes/health.ts](/home/lyes/trottistore/services/sav/src/routes/health.ts:1)
  - [services/analytics/src/routes/health.ts](/home/lyes/trottistore/services/analytics/src/routes/health.ts:1)
  - `metrics.ts` plugins in all 4 Fastify services
- Smoke:
  - [scripts/smoke-staging.sh](/home/lyes/trottistore/scripts/smoke-staging.sh:1)

### Findings
1. `A10-01` `P1` Il existe un script de backup DB, mais aucun restore/runbook de restauration réellement documenté ou testé dans le repo. On a donc une capacité de sauvegarde supposée, pas une capacité de reprise démontrée.
   Réfs:
   - [infra/backup-db.sh](/home/lyes/trottistore/infra/backup-db.sh:1)
   - [RELEASE_RUNBOOK.md](/home/lyes/trottistore/RELEASE_RUNBOOK.md:1)
2. `A10-02` `P1` Les healthchecks post-deploy sont trop courts et partiels pour un rollout multi-service fiable. Les workflows vérifient surtout `/health` sur 4 services et `/ready` seulement sur ecommerce, après une attente fixe courte. Ça ne couvre pas réellement la readiness complète cross-service ni les boots lents/migrations.
   Réfs:
   - [.github/workflows/deploy-production.yml](/home/lyes/trottistore/.github/workflows/deploy-production.yml:165)
   - [.github/workflows/deploy-staging.yml](/home/lyes/trottistore/.github/workflows/deploy-staging.yml:74)
   - [scripts/smoke-staging.sh](/home/lyes/trottistore/scripts/smoke-staging.sh:90)
3. `A10-03` `P2` L’alerting Prometheus existe côté infra, mais le repo ne montre ni propriétaire, ni procédure d’escalade, ni runbook associé pour les alertes `ServiceDown`, `HighErrorRate`, `HighLatency`, `DatabaseUnhealthy`. L’outillage de monitoring est présent, la boucle opérationnelle ne l’est pas.
   Réfs:
   - [infra/alerting-rules.yml](/home/lyes/trottistore/infra/alerting-rules.yml:1)
   - [infra/prometheus.yml](/home/lyes/trottistore/infra/prometheus.yml:1)

### Non-Findings
- Les 4 services exposent bien `/health`, `/ready` et `/metrics`, avec checks DB/Redis dans les routes `ready`.
  Réfs:
  - [services/ecommerce/src/routes/health.ts](/home/lyes/trottistore/services/ecommerce/src/routes/health.ts:1)
  - [services/crm/src/routes/health.ts](/home/lyes/trottistore/services/crm/src/routes/health.ts:1)
  - [services/sav/src/routes/health.ts](/home/lyes/trottistore/services/sav/src/routes/health.ts:1)
  - [services/analytics/src/routes/health.ts](/home/lyes/trottistore/services/analytics/src/routes/health.ts:1)
- Les plugins metrics sont homogènes entre services et exposent des métriques Prometheus standard + latence HTTP.
  Réf:
  - [services/ecommerce/src/plugins/metrics.ts](/home/lyes/trottistore/services/ecommerce/src/plugins/metrics.ts:1)
- Le projet a déjà un smoke script staging utile qui couvre health, ready et quelques parcours API/web critiques.
  Réf:
  - [scripts/smoke-staging.sh](/home/lyes/trottistore/scripts/smoke-staging.sh:1)
- Plusieurs zones sensibles sont déjà protégées par `rateLimit` dans les services Fastify.
  Réfs:
  - [services/ecommerce/src/index.ts](/home/lyes/trottistore/services/ecommerce/src/index.ts:76)
  - [services/crm/src/index.ts](/home/lyes/trottistore/services/crm/src/index.ts:67)
  - [services/sav/src/index.ts](/home/lyes/trottistore/services/sav/src/index.ts:64)
  - [services/analytics/src/index.ts](/home/lyes/trottistore/services/analytics/src/index.ts:60)

### Angles Not Verified
- Vraies sauvegardes prod et fréquence effective
- Restore test réel sur un environnement isolé
- Load testing / p95 réels sous trafic
- Intégration réelle Prometheus/Alertmanager/notifications externes
- Ownership humain réel des alertes et astreinte

### Recommended Actions
- Écrire et tester un vrai runbook de restore DB
- Étendre les healthchecks post-deploy à la readiness de tous les services et à quelques flux métier
- Documenter `owner + action` pour chaque alerte Prometheus importante

## Agent 11 — User Testing

### Scope Proposed
- Parcours public:
  - [apps/web/src/app/(shop)/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/page.tsx:1)
  - [apps/web/src/app/(shop)/produits/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/produits/page.tsx:1)
  - [apps/web/src/app/(shop)/produits/[slug]/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/produits/[slug]/page.tsx:1)
  - [apps/web/src/app/(shop)/checkout/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/checkout/page.tsx:1)
  - [apps/web/src/app/(shop)/reparation/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/page.tsx:1)
  - [apps/web/src/app/(shop)/urgence/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/urgence/page.tsx:1)
- Parcours compte:
  - [apps/web/src/app/(shop)/mon-compte/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/mon-compte/page.tsx:1)
- Parcours backoffice:
  - [apps/web/src/app/(admin)/admin/page.tsx](/home/lyes/trottistore/apps/web/src/app/(admin)/admin/page.tsx:1)
  - [apps/web/src/app/(admin)/admin/commandes/page.tsx](/home/lyes/trottistore/apps/web/src/app/(admin)/admin/commandes/page.tsx:1)
  - [apps/web/src/app/(admin)/admin/sav/page.tsx](/home/lyes/trottistore/apps/web/src/app/(admin)/admin/sav/page.tsx:1)

### Findings Probables / Hypotheses To Validate
1. `A11-01` `P1` Le checkout mélange guest checkout, récupération éventuelle du compte, création d’adresse inline et confirmation Stripe dans la même page. C’est un point de friction probable sur mobile, surtout si l’utilisateur ne comprend pas immédiatement s’il achète en invité ou connecté.
   Réf:
   - [apps/web/src/app/(shop)/checkout/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/checkout/page.tsx:1)
2. `A11-02` `P1` Les parcours `reparation` et `urgence` exposent plusieurs promesses implicites de suivi, diagnostic et reprise de contact. Il faut valider sur de vrais testeurs si le niveau de confiance est suffisant et si les erreurs/formulaires sont compris sans aide.
   Réfs:
   - [apps/web/src/app/(shop)/reparation/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/reparation/page.tsx:1)
   - [apps/web/src/app/(shop)/urgence/page.tsx](/home/lyes/trottistore/apps/web/src/app/(shop)/urgence/page.tsx:1)
3. `A11-03` `P2` Les workflows admin commandes et SAV semblent riches mais denses. Il faut mesurer le temps de tâche et les erreurs opérateur sur des scénarios réels avant de conclure qu’ils sont “opérationnels” au quotidien.
   Réfs:
   - [apps/web/src/app/(admin)/admin/commandes/page.tsx](/home/lyes/trottistore/apps/web/src/app/(admin)/admin/commandes/page.tsx:1)
   - [apps/web/src/app/(admin)/admin/sav/page.tsx](/home/lyes/trottistore/apps/web/src/app/(admin)/admin/sav/page.tsx:1)

### Non-Findings
- Les parcours critiques à tester sont clairement identifiables dans l’application: catalogue, fiche produit, checkout, réparation, urgence, compte, admin commandes, admin SAV.
- Le produit couvre déjà plusieurs personas réels et non un seul tunnel e-commerce simple, ce qui rend un plan de user testing ciblé pertinent.
- Les parcours checkout et réparation ont déjà une logique de recovery minimale côté UI, donc le travail ici est surtout de valider la compréhension réelle plutôt que d’inventer un scénario de test artificiel.

### Angles Not Verified
- Aucun test utilisateur modéré n’a été mené dans ce registre
- Aucun relevé temps de tâche / taux d’échec / points de confusion n’a été collecté
- Aucun test device réel iPhone Safari / Android Chrome n’a été documenté ici
- Aucun parcours backoffice n’a été chronométré avec un vrai opérateur
- Aucun signal quantitatif produit n’a été corrélé avec ces hypothèses dans ce registre

### User Testing Plan
- Personas à recruter:
  - invité qui achète pour la première fois
  - client existant qui veut retrouver commande/SAV
  - client en panne qui cherche une réparation standard
  - client en urgence qui veut un créneau rapide
  - opérateur backoffice commandes
  - opérateur SAV / technicien
- Devices minimaux:
  - iPhone Safari
  - Android Chrome
  - desktop Chrome
- Tâches à faire exécuter:
  - trouver un produit depuis la home et l’ajouter au panier
  - passer une commande en invité jusqu’au paiement
  - se connecter au compte et retrouver une commande
  - déposer une demande de réparation standard
  - déposer une demande “urgence”
  - retrouver le suivi SAV depuis l’email ou l’espace compte
  - pour le backoffice: mettre à jour une commande et traiter un ticket SAV
- Mesures à collecter:
  - succès / échec
  - temps de tâche
  - hésitations et retours arrière
  - incompréhensions de copy / confiance / consentement
  - erreurs récupérables ou bloquantes

### Recommended Actions
- Lancer 5 à 8 sessions modérées courtes avec les personas ci-dessus
- Prioriser le checkout mobile, `reparation`, `urgence` et `mon-compte`
- Mesurer explicitement le temps de tâche côté admin commandes et admin SAV
- Transformer les hypothèses `A11-01` à `A11-03` en findings confirmés ou non-findings après test réel
