# Architecture Audit — TrottiStore — 2026-04-11

> **Type :** Audit architectural rétrospectif et prospectif.
> **Angle :** comprendre les choix actuels, identifier les zones de friction, recommander des évolutions.
> **Auditeur :** Claude Opus 4.6 (replacement codex audit final).

## Sommaire

1. [Choix structurants observés](#1-choix-structurants)
2. [Forces de l'architecture actuelle](#2-forces)
3. [Points de friction et risques](#3-friction)
4. [Évolutions recommandées par horizon](#4-évolutions)
5. [Décisions d'architecture à formaliser (ADR)](#5-adr)
6. [Comparaison avec patterns alternatifs](#6-alternatives)

---

## 1. Choix structurants observés

### 1.1 Monorepo pnpm + turbo

**Décision :** un seul repo `trottistore/` qui contient apps + services + packages partagés.

**Outils :**
- `pnpm-workspace.yaml` pour la résolution des dépendances inter-packages
- `turbo.json` pour l'orchestration build / test / lint
- `tsconfig.base.json` pour la config TypeScript partagée
- `vitest.workspace.ts` pour la projection des tests par projet

**Pourquoi c'est justifié :**
- Refactors cross-package en un seul commit (ex : changer le schema Prisma + adapter les 4 services qui l'utilisent)
- Tests d'intégration cross-service plus simples (e2e, smoke)
- Pas de gestion de packages externes ni de versioning sémantique
- Une seule pipeline CI qui voit tout le code

**Pourquoi c'est risqué :**
- Le repo grossit vite (tests + node_modules + crawl data → ~3-4 GB)
- Un fail de lint sur un service bloque le merge de tous
- Single point of failure si le main est cassé
- Pas de release indépendante par service (mais Railway redéploie chaque service à part, donc OK)

**Verdict :** **bon choix pour la phase actuelle** (< 5 développeurs, code couplé, tooling immature pour multi-repo dans cet écosystème).

### 1.2 Multi-schema Postgres avec un seul Prisma client

**Décision :** une seule DB Postgres avec 4 schemas (`shared`, `ecommerce`, `crm`, `sav`), un seul Prisma client qui les voit tous.

```prisma
model User {
  // ...
  @@schema("shared")
}

model Product {
  // ...
  @@schema("ecommerce")
}
```

**Pourquoi c'est justifié :**
- Pas de "service mesh" complexe — chaque service fait des reads cross-schema directs via Prisma
- FK cross-schema possible (ex : `Order.customerId → User.id`)
- Une seule connexion pool, une seule migration tool
- Backup et restore simples (un seul pg_dump)

**Pourquoi c'est risqué :**
- **Pas d'isolation logique entre services :** un bug dans `services/sav` peut faire un `prisma.product.update()` qui impacte le catalogue ecommerce. Defense in depth zéro.
- **Couplage de schema :** changer une colonne sur `Product` impacte simultanément les 4 services (ils ont tous le même Prisma client généré)
- **Scaling :** quand la DB grossit, on ne peut pas split par service sans refactor majeur
- **Performance :** la même DB sert toutes les requêtes lecture/écriture des 4 services + des analytics → contention sous charge

**Verdict :** **acceptable pour la phase MVP/post-démo** (volume négligeable), mais à reconsidérer dès que le volume order > 100/jour. Voir [section 4.3](#43-évolution-vers-base-de-données-séparées).

### 1.3 Auth JWT centralisée mais validation par service

**Décision :** un seul `JWT_ACCESS_SECRET` partagé par les 4 services. Chaque service a son `authPlugin` Fastify qui décode le JWT.

**Pattern observé (post-PR #89) :**

```typescript
// Chaque service exécute ce check au boot dans le onRequest hook :
if (!ROLES.includes(payload.role)) {
  return reply.status(401).send({ error: { code: "UNAUTHORIZED" } });
}
```

**Pourquoi c'est justifié :**
- Pas de service auth dédié (overhead inutile pour la phase actuelle)
- Stateless : pas de session DB lookup pour chaque request
- Refresh token côté ecommerce uniquement (cookie HttpOnly)

**Pourquoi c'est risqué :**
- **Rotation du secret JWT impacte les 4 services en même temps** : si un secret leak, toutes les sessions sont invalidées simultanément
- **Pas de scope par service** : un JWT valide est accepté par les 4 services. Si `services/sav` est compromis, les tokens leakés peuvent être utilisés sur ecommerce/crm/analytics aussi
- **Pas de révocation centralisée** : pas de blacklist token, on doit attendre l'expiration

**Verdict :** acceptable, mais à formaliser dans un ADR. Évolution recommandée : tokens scoped par audience (`aud: "ecommerce"`).

### 1.4 Frontend monolithe Next.js qui proxy vers les 4 services

**Décision :** `apps/web` est un Next.js 15 qui sert :
- Storefront `/(shop)/*`
- Admin `/(admin)/*`
- API proxy via `next.config.ts:rewrites()` qui aiguille `/api/v1/*` vers les services internes

**Pourquoi c'est justifié :**
- Une seule URL pour les utilisateurs (`https://trottistoreweb-production.up.railway.app`)
- SSR + ISR + SSG mélangés selon les pages
- Tout le code frontend (storefront + admin) au même endroit, partage des composants
- Pas de CORS car tout passe par le même origin

**Pourquoi c'est risqué :**
- **Le frontend devient un SPOF** : si Next.js plante ou est down, tout le site est down même si les services backend sont OK
- **Couplage URL** : si on veut split admin et storefront sur deux domaines, il faut refactorer
- **Build time croissant** : à mesure que les pages s'ajoutent, le build Next.js devient plus long
- **Stock JWT en localStorage** (pas optimal sécu — XSS = vol de session)

**Verdict :** **bon choix pour la phase actuelle**. À reconsidérer si le projet grossit (>50 pages, ou si on veut une vraie isolation admin / storefront).

### 1.5 Communication inter-services par DB partagée (pas d'API/queue)

**Décision :** zéro communication HTTP/gRPC entre les 4 services Fastify. Tout passe par lecture directe de la DB Postgres via Prisma.

**Exemples :**
- `services/crm/triggers` lit les `repair_tickets` du schema `sav` directement
- `services/analytics` lit les `orders`, `repair_tickets`, `customer_profiles` cross-schema

**Pourquoi c'est justifié :**
- Pas de découverte de service à gérer
- Latence nulle (pas de network hop)
- Pas de retry / circuit breaker / timeout à coder
- Cohérence forte garantie par les transactions Postgres

**Pourquoi c'est risqué :**
- **Anti-pattern microservices** : par définition, les services partagent des données = ne sont plus indépendants
- **Couplage tacite :** si `services/sav` change un champ sur `repair_tickets`, `services/crm/triggers` casse silencieusement
- **Pas d'événements** : impossible de réagir à "un order vient d'être créé" sans polling DB
- **Pas de queue** : si `services/crm` envoie un email et qu'il crash en cours, l'email est perdu

**Verdict :** **anti-pattern conscient et acceptable pour la phase MVP**, mais à instrumentaliser avec un event bus dès qu'on dépasse 1000 orders/mois ou qu'on veut faire de la réactivité event-driven (newsletter, recommendations, scoring fidélité).

### 1.6 Pas de queue de jobs (BullMQ / Inngest absent)

**Décision :** les emails (confirmation order, password reset, shipped, etc.) sont envoyés en **fire-and-forget** depuis les routes :

```typescript
sendEmail(customerEmail, subject, html).catch((e) =>
  app.log.warn({ orderId: id, err: e }, "shipped-email send failed")
);
```

**Pourquoi c'est justifié :**
- Pas d'overhead Redis BullMQ supplémentaire
- Le user ne voit pas le délai de l'envoi mail
- Les warnings logs permettent de retrouver les emails ratés

**Pourquoi c'est risqué :**
- **Si Brevo / SMTP est down 2 minutes, les emails de cette fenêtre sont perdus.** Aucun retry.
- Pas de DLQ (dead letter queue) → le user ne reçoit jamais sa confirmation, pas de notification admin
- Difficile de tester un endpoint qui dispatch des jobs (le test se termine avant que le job ait fini)
- Pas de visibilité sur les jobs en cours / en échec

**Verdict :** **dette consciente acceptable pour la phase démo**. À fixer avant le go-live commercial avec :
- Soit BullMQ + Redis (déjà disponible) → 1-2 jours d'intégration
- Soit Inngest cloud (managed) → 1 jour d'intégration mais coût récurrent

---

## 2. Forces

### 2.1 Méthodologie audit deux-étages a tenu

**Observation :** la session 2026-04-11 a livré ~25 PRs avec **0 régression observée** (1 e2e fix sur F9 grid auto-fit, mais c'était une amélioration en cours, pas un bug user-visible).

**Facteurs de succès :**
- Tests rouges avant fix systématiques
- CI bloquante avec gate global
- Squash merge atomic
- Deploy séquentiel avec smoke check
- Sortie de PR propre (description claire, refs, test plan)

**Pattern à industrialiser :** documenter cette méthodologie dans un `CONTRIBUTING.md`.

### 2.2 RBAC propre et defense in depth

**Observation :** les routes admin sont protégées à plusieurs niveaux :
1. `onRequest` hook global qui rejette CLIENT sur les services CRM
2. `app.authenticate` preHandler qui vérifie le JWT
3. `requireRole("SUPERADMIN", "ADMIN", "MANAGER")` preHandler explicite par route
4. Validation de l'ownership (customerId === user.userId) pour les routes user-facing

**Résultat :** même si une couche est contournée, les autres tiennent. Aucun IDOR récent n'a échappé aux 4 couches simultanément.

### 2.3 Validation Zod systematique

**Observation :** **100 % des routes Fastify** valident leur input avec un schema Zod et retournent un 400 VALIDATION_ERROR sur fail.

**Bénéfice :** pas de runtime crash sur input mal formé. Les logs sont propres.

### 2.4 Auth bypass scopé strict

**Pattern post-PR #106 :** chaque service liste explicitement les endpoints publics dans son `onRequest` hook :

```typescript
const isPublicNewsletter =
  path === "/api/v1/newsletter/subscribe" ||
  path === "/api/v1/newsletter/confirm" ||
  path === "/api/v1/newsletter/unsubscribe";
if (isPublicNewsletter) return;
```

**Bénéfice :** par défaut tout est protégé. Une nouvelle route est protégée tant qu'elle n'est pas explicitement listée.

### 2.5 Tests smoke synthétiques rapides

**Observation :** `pnpm test:smoke` tourne en ~500ms et couvre 18 scénarios cross-service.

**Bénéfice :** feedback < 1 sec après une modif locale, encourage à tester souvent.

---

## 3. Points de friction et risques

### 3.1 Chaque modif schema impacte 4 services

**Friction :** modifier un champ sur `Product` requiert :
1. Edit `schema.prisma`
2. Run `pnpm db:generate` (regénère le client)
3. Adapter les types côté `services/ecommerce`
4. Adapter les types côté `services/sav` (qui lit Product pour les pièces)
5. Adapter les types côté `services/crm` (qui lit Product pour les triggers)
6. Adapter les types côté `apps/web` (composants Product)
7. Run tests des 4 services
8. Run e2e

**Coût :** 1 changement schema = 1-2h de travail au lieu de 15 min sur un service isolé.

**Mitigation possible :** abstraire les types Product dans `packages/shared/src/types/product.ts` et en faire la source de vérité.

### 3.2 Logs cross-service difficiles à corréler

**Friction :** quand un user fait une action qui touche `web` → `ecommerce` → `crm` → `email`, les logs sont éparpillés sur 4 services Railway sans request ID partagé.

**Coût :** debugger un incident user prend 10x plus de temps qu'avec un trace ID partagé.

**Mitigation :** ajouter un `X-Request-Id` header généré côté frontend, propagé aux 4 services, loggé partout.

**Effort :** 30 min côté frontend + 30 min × 4 services = 2-3h.

### 3.3 Mocks Prisma cachent les bugs réels

**Friction :** la majorité des tests intégration mockent prisma, ce qui empêche de tester les bugs concurrence / SQL / migrations.

**Coût :** 3 bugs P0/P1 trouvés en démo qui auraient dû être pris par les tests (cf [test-coverage-gap-analysis.md](./2026-04-11-test-coverage-gap-analysis.md)).

**Mitigation :** chantier S2 Testcontainers (2-3 jours setup).

### 3.4 PRs codex bloquées par sandbox cassé

**Friction :** codex peut produire du code et des branches mais ne peut pas exécuter `gh pr create` (`cannot join mount namespace of pid 1`). Workaround : Claude ouvre les PRs pour codex.

**Coût :** une étape manuelle de coordination par PR codex, source de friction et d'erreurs.

**Mitigation :** investiguer côté sandbox codex (pas dans le scope de cette session) OU industrialiser un script `pnpm codex:open-pr <branch>` dans le repo.

### 3.5 Pas de séparation envs staging / preview

**Friction :** la prod Railway est le seul environnement où on peut tester avec du Stripe, du BREVO, du DNS réels. Pas de staging intermédiaire.

**Coût :** chaque deploy prod est une roulette russe (mitigée par le smoke test post-deploy mais pas couverte par un vrai env de pré-prod).

**Mitigation :** créer un Railway env `staging` qui serve à valider les changements avant prod. Effort : 2-3h setup + maintien des env vars en double.

### 3.6 Documentation fragmentée et sans single source of truth

**Friction :** info dispersée dans :
- `CLAUDE.md` (× 5 fichiers : root + 4 services + apps/web)
- `README.md` (root)
- `ARCHITECTURE.md` (root)
- `TECHLEAD_AUDIT.md`, `TODO_TECHLEAD.md`
- `RELEASE_RUNBOOK.md`
- `SECURITY.md`
- `docs/audits/*.md` (5 docs créés aujourd'hui)
- `docs/backlog/*.md`
- `docs/codex-tasks/*.md`

**Coût :** un nouveau dev (humain ou agent) ne sait pas par où commencer.

**Mitigation :** un seul `docs/README.md` qui sert d'index avec liens vers tous les autres. Effort : 30 min.

---

## 4. Évolutions par horizon

### 4.1 Court terme (semaine 16-17)

**Priorité go-live commercial.**

1. **Stripe live keys** (B1 dans go-live readiness)
2. **Factures conformes** (B5 dans go-live readiness)
3. **Stock integrity 3 P1** (codex audit)
4. **Sentry intégration** (O1 dans tech debt)
5. **Slow query log Postgres** (P2 dans tech debt)
6. **CGV draft pro** (B6)

**Effort total :** ~1-2 jours-homme dev + récup assets côté @Lsardi.

### 4.2 Moyen terme (mois 5-6)

**Priorité industrialisation post-go-live.**

1. **Testcontainers chantier S2** (test-coverage gap)
2. **Event bus / job queue** (BullMQ + Redis ou Inngest)
3. **Request ID propagation cross-service** (3.2)
4. **Staging env Railway** (3.5)
5. **Sentry + alerting actif** (cf go-live readiness)
6. **Page admin newsletter export CSV** ✓ déjà fait F3
7. **CSP / HSTS / security headers** (S6)
8. **Visual regression Chromatic** (G6)

**Effort total :** ~2-3 semaines-homme.

### 4.3 Long terme (mois 7-12)

**Priorité scaling et qualité produit.**

1. **Évolution vers bases de données séparées** (cf section 4.3 ci-dessous)
2. **Event-sourcing partial sur les Orders** (audit trail historique complet)
3. **CDN Cloudflare devant Next.js** (perf)
4. **Cache HTTP routes catalogue** (`/products`, `/categories`)
5. **Load testing k6 régulier**
6. **APM avancé (DataDog ou similar)**
7. **A/B testing framework** (LaunchDarkly / Flagsmith / Unleash)
8. **Refactor `orders/index.ts` 1700 lignes → modules**
9. **OpenAPI auto-generated docs** (Swagger UI sur chaque service)

#### 4.3 — Évolution vers DB séparées (option future)

Si le volume d'orders dépasse ~100/jour ou si une criticité service par service apparaît :

**Étape 1 : Extraire les modèles `analytics_*` dans une DB séparée** (ils sont write-heavy mais read-rare = pattern OLAP qui mérite une DB dédiée).

**Étape 2 : Extraire les modèles `sav_*` dans une DB séparée** (cycle de vie indépendant de l'ecommerce).

**Étape 3 : Garder `shared` + `ecommerce` + `crm` ensemble** (couplage fort acceptable).

**Migration :** non triviale. Suppose que les FK cross-DB soient remplacées par des références par ID + une couche d'API entre services (gRPC ou HTTP). C'est un refactor de 2-3 semaines au minimum, à ne lancer qu'avec un objectif business clair.

### 4.4 Hors scope mais à anticiper

- **Multi-tenant** (revendre TrottiStore comme white-label à d'autres réparateurs) — actuellement le code a déjà un `NEXT_PUBLIC_BRAND_*` pattern qui anticipe ça
- **Internationalisation (i18n)** — le code est tout en français, pas de framework i18n
- **Mobile native app** (React Native partagé avec apps/web ?) — pas une priorité
- **Marketplace B2B** (vendre nos services à d'autres ateliers) — potentiel mais hors démo

---

## 5. ADR à formaliser

Architecture Decision Records que je recommande de créer dans `docs/adr/` pour figer les choix actuels :

| # | Titre | Statut |
|---|---|---|
| ADR-001 | Monorepo pnpm + turbo | accepted |
| ADR-002 | Multi-schema Postgres single Prisma client | accepted |
| ADR-003 | Auth JWT centralisée non scoped per audience | accepted (à reconsidérer en ADR-003-bis si scoping nécessaire) |
| ADR-004 | Pas de communication inter-services HTTP | accepted (à challenger en ADR-004-bis si event-bus intro) |
| ADR-005 | Frontend monolithe Next.js avec proxy `next.config.ts` rewrites | accepted |
| ADR-006 | Tests intégration via mocks Prisma (pas Testcontainers initialement) | superseded par ADR-006-bis si chantier S2 lancé |
| ADR-007 | Fire-and-forget emails sans queue | accepted (à superseder par BullMQ ADR-007-bis) |
| ADR-008 | Auth bypass scopé liste blanche dans onRequest hook | accepted |
| ADR-009 | Méthodologie audit deux-étages (Lite + Full) | accepted |

**Format type d'un ADR :**

```markdown
# ADR-001 — Monorepo pnpm + turbo

**Date :** 2026-04-11
**Statut :** accepted
**Décideurs :** @Lsardi, Claude Opus 4.6

## Contexte

[problème, contraintes, options envisagées]

## Décision

[ce qui a été choisi]

## Conséquences

**Positives :**
- ...

**Négatives :**
- ...

## Alternatives envisagées

- ...

## Liens

- [...]
```

**Effort de formalisation des 9 ADRs :** ~3-4h (réutiliser le contenu des sections 1-3 de ce doc).

---

## 6. Comparaison avec patterns alternatifs

### 6.1 Microservices "purs" (avec API gRPC inter-services)

**Différence :** chaque service aurait sa DB, communiquerait via gRPC ou HTTP avec circuit breaker.

**Pour :** vraie isolation, possibilité de scaler chaque service indépendamment, refactor moins risqué.

**Contre :** complexité 5-10x supérieure, latence inter-service, gestion des transactions distribuées (saga pattern), monitoring distribué obligatoire.

**Verdict pour TrottiStore :** **pas justifié à la phase actuelle.** Le coût de la complexité dépasse largement les bénéfices à ce stade.

### 6.2 Monolithe modulaire (un seul service Fastify)

**Différence :** un seul service `services/main` au lieu de 4. Les modules `ecommerce/`, `crm/`, `sav/`, `analytics/` cohabitent dans le même process.

**Pour :** plus simple à déployer, latence inter-module nulle, partage du connection pool DB.

**Contre :** un crash impacte tout, scaling vertical seulement, build plus long.

**Verdict :** **trade-off intéressant**. Si on revoit l'archi, c'est une option à considérer sérieusement vu que les 4 services partagent déjà 80 % du code et la même DB.

### 6.3 Backend-as-a-Service (Supabase / Firebase / AppWrite)

**Différence :** confier la DB + auth + storage + edge functions à un provider managed.

**Pour :** zero infra à gérer, scaling auto, dashboard admin gratuit.

**Contre :** vendor lock-in fort, custom backend logic limited, coût récurrent.

**Verdict :** **trop tard pour migrer**, mais si on devait recommencer aujourd'hui ce serait à évaluer pour un MVP.

### 6.4 JAMstack pur (Astro + headless CMS)

**Différence :** frontend statique, données via headless CMS (Strapi / Directus / Sanity), pas de Next.js.

**Pour :** perf max, SEO max, hosting gratuit.

**Contre :** logique métier limitée côté frontend, back-office limité.

**Verdict :** **pas adapté à l'ecommerce avec checkout dynamique**. Next.js SSR + ISR est un meilleur compromis.

---

## 7. Recommandations finales

### 7.1 Garder

- ✅ Monorepo pnpm + turbo
- ✅ Multi-schema Postgres
- ✅ Méthodologie audit deux-étages
- ✅ Auth JWT centralisée (mais scope per audience à terme)
- ✅ Validation Zod systematique
- ✅ RBAC defense in depth
- ✅ Auth bypass scopé strict
- ✅ Frontend monolithe Next.js

### 7.2 Industrialiser rapidement

- **Testcontainers** (semaine 16-17)
- **Sentry** (semaine 16)
- **Request ID cross-service** (semaine 17)
- **Staging env** (semaine 18)

### 7.3 Reconsidérer dans 6 mois

- **Event bus / job queue** (si volume > 100 orders/jour)
- **Bases séparées par service** (si volume > 1000 orders/jour)
- **Refactor `orders/index.ts`** (si > 2000 lignes)
- **OpenAPI auto-generated** (si plusieurs frontends consommateurs)

### 7.4 Ne pas faire (anti-patterns identifiés à éviter)

- ❌ Migration vers microservices "purs" — surengineering pour la phase actuelle
- ❌ Refactor multi-tenant prématuré — attendre un vrai client white-label
- ❌ Frontend split admin / storefront — pas de gain à ce stade
- ❌ Migration vers GraphQL — pas de besoin actuel, REST suffit
- ❌ Migration ORM (Drizzle, etc.) — Prisma est OK

---

## Annexes

- [2026-04-11-full-project-audit.md](./2026-04-11-full-project-audit.md) — section 2 architecture observée
- [2026-04-11-go-live-readiness.md](./2026-04-11-go-live-readiness.md) — checklist actionnable
- [2026-04-11-stock-integrity-audit.md](./2026-04-11-stock-integrity-audit.md) — détail des 3 P1
- [2026-04-11-tech-debt-registry.md](./2026-04-11-tech-debt-registry.md) — registre dette
- [2026-04-11-test-coverage-gap-analysis.md](./2026-04-11-test-coverage-gap-analysis.md) — gap couverture
- [docs/codex-tasks/triage-fix-branches-2026-04-11.md](../codex-tasks/triage-fix-branches-2026-04-11.md)
- [docs/codex-tasks/next-batch-2026-04-11.md](../codex-tasks/next-batch-2026-04-11.md)
- [docs/backlog/post-demo-2026-04-11.md](../backlog/post-demo-2026-04-11.md)

---

*Audit architectural en remplacement de l'audit codex. Si codex revient avec un angle complémentaire (perf, sécurité offensive, compliance), il pourra cross-checker ce doc.*
