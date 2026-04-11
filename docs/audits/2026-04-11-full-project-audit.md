# Full Project Audit — TrottiStore — 2026-04-11

> **Type :** Audit Full Passport (rétrospectif sur la session intensive du 2026-04-11).
> **Auditeur :** Claude Opus 4.6 (1M context) — replacement de l'audit codex qui a atteint ses limites.
> **Périmètre :** monorepo entier `/home/lyes/trottistore` — apps/web, services/{ecommerce,crm,sav,analytics}, packages/{database,shared,ui}, scripts.
> **Méthodologie :** méthodologie d'audit deux-étages (Lite + Full) formalisée dans `claude/audit-docs@bfe4119`. Ce doc est la passe Full.

## Sommaire

1. [Contexte session 2026-04-11](#1-contexte-session)
2. [Architecture observée](#2-architecture-observée)
3. [Sécurité — état après les fixes du jour](#3-sécurité)
4. [Intégrité transactionnelle](#4-intégrité-transactionnelle)
5. [Conformité légale (factures, mentions, RGPD)](#5-conformité-légale)
6. [UX et accessibilité](#6-ux-et-accessibilité)
7. [Performance et observabilité](#7-performance-et-observabilité)
8. [Tests — couverture et fragilité](#8-tests)
9. [Operations / DevOps](#9-ops-devops)
10. [Findings résiduels par sévérité](#10-findings-résiduels)
11. [Prochaines actions priorisées](#11-prochaines-actions)

---

## 1. Contexte session

**Une session de ~12h le 2026-04-11** avec ~25 PRs mergées et 8 déploiements production. Triggered par une demo-prep session la veille qui avait identifié plusieurs trous (claims légales, sécurité P0/P1, mobile, UX).

**Charge livrée aujourd'hui (résumé):**

| Catégorie | PRs | Détails |
|---|---|---|
| Sécurité P0/P1 | 5 | crm cron bypass, customer merge atomic, password reset race, sav quote IDOR, orders status legacy IDOR |
| Audit légal claims | 1 (+ 1bis) | Avis Google fake, 3x sans frais, 24h SLA, faux avis hardcodés |
| Mobile iOS | 1 (+ C2bis) | safe-area, 100dvh, font-size 16px scope précis |
| Bugs runtime | 4 | seed bcrypt mismatch, start scripts dist, env hardening, hotfix admin orders limit |
| Features visibles (F1-F11) | 11 | shipped email, garage sync, admin newsletter, Google reviews, mes commandes, quiz vrai stock, mobile zoom restreint, checkout polish, home rubriques, crawler suppliers, Wattiz seed |
| Documentation | 3 | post-demo backlog, audit lite Railway rehab, codex tasks T1-T5 |
| Infra | 2 | order_items index, env hardening |

**Patterns observés cette session:**

- **Méthodologie audit deux-étages a tenu :** chaque PR livre tests rouges avant fix, CI verte avant merge, déploiement séquentiel sans regression user-visible. C2bis a été le seul cas où un fix a dû être reverté puis re-ciblé.
- **Mocks Prisma cachent les bugs :** trois bugs dormants découverts pendant la session démo (Stripe webhook stock, seed argon2/bcrypt, analytics /sales GROUP BY) auraient été pris par des tests Testcontainers à DB réelle. Le chantier S2 reste ouvert.
- **Codex a atteint ses limites en fin de session.** Deux briefings codex livrés (triage fix-* + next-batch T1-T5) ont été exécutés, mais l'audit complet promis n'a pas été produit. Ce doc est le rattrapage.

---

## 2. Architecture observée

### 2.1 Topologie monorepo

```
trottistore/
├── apps/
│   └── web/                    Next.js 15 storefront + admin (App Router, SSR)
├── services/
│   ├── ecommerce/              Fastify port 3001 — products, cart, orders, checkout, auth, Stripe, invoices
│   ├── crm/                    Fastify port 3002 — customers, segments, campaigns, triggers, newsletter
│   ├── sav/                    Fastify port 3004 — repair tickets, technicians, scooter-models
│   └── analytics/              Fastify port 3003 — KPIs, sales, stock, events
├── packages/
│   ├── database/               Prisma (PostgreSQL multi-schema: shared, ecommerce, crm, sav)
│   ├── shared/                 RBAC roles, error classes, JWT types, notifications, pagination
│   └── ui/                     Placeholder (composants partagés à venir)
└── scripts/                    seed.ts, seed-demo.ts, crawl.ts, crawl-suppliers.ts
```

**Stack :**
- **Backend :** Fastify + Zod + Prisma + bcryptjs + Stripe SDK + node-cron + nodemailer/Brevo
- **Frontend :** Next.js 15 App Router, Tailwind 4, Radix UI, Stripe Elements, sanitize-html
- **Infra :** Railway (5 services + Postgres + Redis), GitHub Actions CI, Cloudflare DNS
- **Tests :** Vitest (unit + integration via mocks), Playwright (e2e iPhone 13 + iPad Pro 11)

### 2.2 Conventions API

| Pattern | Valeur |
|---|---|
| Préfixe routes | `/api/v1/*` sur tous les services |
| Réponse success | `{ success: true, data: T }` |
| Réponse error | `{ success: false, error: { code, message, details? } }` |
| Auth | JWT access token (header) + refresh token (cookie) |
| Roles | SUPERADMIN, ADMIN, MANAGER, TECHNICIAN, STAFF, CLIENT |
| Validation | Zod sur tous les inputs route, 400 VALIDATION_ERROR sur fail |
| Erreurs métier | AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError |
| Auth bypass scopé | Liste explicite dans le `onRequest` hook par service (cf. `services/crm/src/index.ts:84`, `services/sav/src/index.ts:75`) |

### 2.3 Communication inter-services

**Pas de communication inter-services directe** (par design — limite le couplage). Les 4 services Fastify partagent la même DB Postgres via Prisma multi-schema. Le frontend Next.js fait office de proxy via les rewrites `next.config.ts:13-43` qui aiguillent par préfixe `/api/v1/{products,cart,orders,...}`.

**Implications :**
- Pas de découverte de service nécessaire
- Latence inter-service nulle (lecture DB directe via Prisma)
- **Risque :** un changement de schema Prisma impacte simultanément 4 services. Toujours run `pnpm db:generate` après modif schema, et tester chaque service.

### 2.4 État du multi-agent workflow

Le workflow multi-agent (Claude + Codex) est partiellement opérationnel :
- Codex peut faire des audits et écrire du code dans son sandbox
- Limitation observée : `gh pr create` cassé dans le sandbox codex (`cannot join mount namespace of pid 1`). Workaround : Claude ouvre les PRs pour le compte de codex.
- **Pendant cette session :** codex a livré le triage fix-branches (5 MERGE / 1 BLOCKED) + le batch T1-T5 follow-ups. Tout a été ouvert en PR par Claude et mergé.
- **À industrialiser :** un script `pnpm codex:open-pr <branch>` qui simule ce que `gh pr create` ferait, puisque codex peut produire le body de la PR mais pas la créer.

---

## 3. Sécurité

### 3.1 P0/P1 mergées aujourd'hui (purge du backlog)

| ID | Sujet | PR | Risque résolu |
|---|---|---|---|
| P0-3 | crm cron bypass via header `x-internal-cron: true` statique | #106 | Tout user authentifié non-manager pouvait exécuter les triggers CRM. Fix : nonce per-process généré au boot, scopé strictement à `POST /triggers/run`. |
| P0-4 | customer merge non atomique | #107 | Crash entre 2 transactions laissait un état partiellement fusionné + perte historique fidélité. Fix : tout dans une transaction unique + reparent loyaltyPoint avant delete. |
| P1-1 | route legacy `PUT /orders/:id/status` exposée | #108 | Surface IDOR backoffice dupliquée. Fix : route retirée + red test 404 + grep front confirme aucun caller. |
| P1-2 | sav quote-accept manque guard `assignedTo` | #110 | Technicien non assigné acceptait un devis tiers. Fix : guard `assignedTo === user.userId` pour TECHNICIAN. |
| P1-5 | password reset race condition | #109 | 2 requêtes concurrentes avec même token écrasaient le password 2x. Fix : claim atomique du token avec garde `usedAt: null`. |
| P1-8 | manque d'index DB sur `order_items.product_id, variant_id` | #113 | Perf jointures analytics. Lock acceptable mesuré (61 rows / 40 kB). |
| C1.1-C1.4 | claims légales fake (Google reviews, 3x sans frais, 24h SLA, callback) | #103 | Risque DGCCRF + faux avis loi 2018. Fix : retrait + neutralisation. |
| C4.2 | seed.ts argon2 vs auth bcrypt mismatch | #105 + T1 | Aucun user seedé pouvait se logger. Fix : seed migré bcrypt + upsert update passwordHash. |
| F2 hardening | env vars validation, audit logs | #89 | Defense in depth. |

### 3.2 Findings sécurité résiduels

#### S1 — Stripe en mode TEST sur prod (P0)

**Réf :** `services/ecommerce/src/index.ts:36`, env Railway production
**Constat :** `STRIPE_SECRET_KEY=sk_test_51TKEJ6...`
**Impact :** aucune carte réelle ne peut être chargée. Le checkout marche techniquement mais l'argent ne bouge pas. Si un client tente un achat avec sa vraie carte → échec silencieux côté business.
**Action :** rotate vers `sk_live_` + `pk_live_` + nouveau `whsec_` du dashboard Stripe live mode. **Bloquant 100% pour go-live commercial.**
**Effort :** 5 min côté tech (set 3 env vars), nécessite les credentials Stripe live de @Lsardi.

#### S2 — Stock integrity 3 P1 (codex audit non livré)

**Refs codex audit (non encore implémenté) :**
- `services/sav/src/routes/tickets/index.ts:1006` — POST `/repairs/:id/parts` `decrement` brut sans garde atomique
- `services/ecommerce/src/routes/stock/index.ts:67` — POST `/stock/movements` lit `findUnique` puis `update` séparés sans lock SQL ni `updateMany ... where stockQuantity >= qty`
- `services/ecommerce/src/routes/orders/index.ts:1406, 1539` — POST `/admin/orders/:id/refund` peut double-restock après cancel

**Impact :** oversell SAV pièces, oversell stock movements concurrent, double-restock refund après cancel. Risque P1 d'intégrité business sous charge concurrente.
**Action proposée codex :** extraire `decrementStockOrThrow(tx, variantId, qty)` dans `packages/shared/src/stock.ts`, l'utiliser dans les 3 sites, ajouter une colonne `stockReleased` sur `Order` pour idempotence du refund après cancel. Red tests pour chaque finding.
**Effort :** ~2-3h.
**Statut :** **codex devait livrer, n'a pas livré.** Voir `2026-04-11-stock-integrity-audit.md` pour le détail technique.

#### S3 — Injection xss/html sur reviews internes (P2)

**Réf :** `services/ecommerce/src/routes/reviews/index.ts` (POST `/reviews`)
**Constat :** le champ `content` accepte du texte libre stocké tel quel en DB. Le frontend l'affiche via du JSX (échappé par défaut), mais si un futur composant l'affiche via `dangerouslySetInnerHTML`, c'est un xss stocké.
**Action :** sanitiser au write côté backend avec `sanitize-html` (déjà utilisé dans `apps/web/src/app/(shop)/produits/[slug]/page.tsx:37`) ou ajouter une validation Zod stricte qui rejette les balises HTML.
**Effort :** 30 min.

#### S4 — Pas de rate limit sur les endpoints sensibles non-auth (P1)

**Réf :** `services/ecommerce/src/routes/auth/forgot-password` (rate-limited à 3/15min ✓), mais `POST /reviews`, `POST /newsletter/subscribe`, `POST /api/v1/repairs` (intake guest) n'ont pas de rate-limit dédié au-delà du global 100/min.
**Impact :** spam abuse, enrichment d'emails newsletter, flood SAV intake.
**Action :** ajouter `config: { rateLimit: { max: 5, timeWindow: '1 minute' } }` sur ces endpoints.
**Effort :** 15 min.

#### S5 — Token tracking SAV en clair dans l'URL (P2)

**Réf :** `packages/database/prisma/schema.prisma:749` — `trackingToken String @unique @default(uuid())`
**Constat :** le tracking token est un UUID v4 dans l'URL `/mon-compte/suivi/[token]`. Pas mauvais, mais l'UUID v4 a 122 bits d'entropie ≈ 36 chars hex. C'est suffisant cryptographiquement, mais le pattern est observable et un attacker peut tester des UUIDs voisins (peu probable mais documenté).
**Mitigation :** acceptable en l'état pour la phase démo. À documenter dans le threat model.

#### S6 — Pas de CSP ni HSTS configurés sur le frontend Next.js (P2)

**Réf :** `apps/web/next.config.ts` — pas de `headers()` configuré
**Constat :** aucun `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy` envoyé par Next.js. Railway peut en ajouter au niveau edge mais c'est pas vérifié.
**Action :** configurer `headers()` dans `next.config.ts` avec une CSP stricte pour la prod (Stripe + Brevo + Google Maps autorisés, le reste bloqué).
**Effort :** 1h (CSP est tatillonne à mettre en place sans casser les widgets externes).

### 3.3 Posture sécurité globale après la session

**Note :** **B+** (était B- en début de session)

**Forces :**
- 5 P0/P1 fix sécu mergés en une journée (rythme exceptionnel)
- Auth bypass scopé partout, defense in depth
- Tests rouges avant fix systématiques
- Dependency audit `pnpm audit --audit-level=high` au CI gate (PR #89)

**Faiblesses :**
- Stripe TEST en prod (P0 pour go-live)
- Stock integrity 3 P1 connus mais non implémentés
- Pas de CSP / security headers
- Pas de threat model formalisé
- Mocks Prisma cachent les bugs sous concurrence (chantier S2 Testcontainers pas commencé)

---

## 4. Intégrité transactionnelle

### 4.1 Transactions Prisma observées

**Pattern correct :** la majorité des routes critiques utilisent `app.prisma.$transaction(async (tx) => { ... })` pour grouper les writes.

Exemples :
- `services/ecommerce/src/routes/orders/index.ts` création order : 1 transaction qui crée Order + OrderItems + StockMovement + décrément stock.
- `services/crm/src/routes/customers/index.ts` (après #107) : merge customer fait dans une transaction unique avec reparent fidélité.
- `services/ecommerce/src/routes/auth/index.ts` (après #109) : password reset claim atomique du token.

### 4.2 Patterns à risque résiduels

#### T1 — Decrement stock sans garde

**Réf :** `services/ecommerce/src/routes/orders/index.ts:521` (création order)

```typescript
await tx.productVariant.update({
  where: { id: item.variantId },
  data: { stockQuantity: { decrement: item.quantity } },
});
```

**Risque :** Prisma `decrement` est atomique au niveau SQL (`UPDATE ... SET stock = stock - N`), mais ne vérifie PAS que `stock >= N`. Sous concurrence forte (2 orders simultanés sur le dernier item), le second va passer le stock à -1.

**Mitigation existante :** la contrainte `stock_quantity_non_negative` (migration `20260410151000`) refuse les valeurs négatives au niveau DB → la 2e transaction throw, l'order n'est pas créé, OK.

**Mais :** l'erreur remontée est une `PrismaClientKnownRequestError` sur la contrainte CHECK, pas un AppError métier propre. Le client reçoit un 500 au lieu d'un 409 STOCK_UNAVAILABLE.

**Action :** wrapper avec `decrementStockOrThrow(tx, variantId, qty)` qui fait `updateMany ... where stockQuantity >= qty` puis check `count === 1`. Si 0 → throw `ConflictError("STOCK_UNAVAILABLE")`. Voir [2026-04-11-stock-integrity-audit.md](./2026-04-11-stock-integrity-audit.md) pour le détail.

#### T2 — Stock movements non atomique (cf S2)
#### T3 — Refund full après cancel double-restock (cf S2)
#### T4 — SAV parts decrement brut (cf S2)

### 4.3 Idempotence

**Bons points :**
- Stripe webhook : la fonction `handlePaymentSuccess` utilise un check sur `payment.status === "SUCCEEDED"` avant de re-modifier l'order. Si Stripe ré-envoie le webhook, no-op.
- Newsletter confirm : check `status === CONFIRMED` avant update → idempotent.
- SAV ticket transitions : `status-machine.ts` valide les transitions, refuse les retours en arrière non autorisés.

**Manques :**
- Order create : pas d'idempotency-key sur le POST. Un user qui clique 2x peut créer 2 orders identiques. À industrialiser avec un header `Idempotency-Key` que le client génère côté frontend.
- Payment intent create : pareil, pas de garantie d'unicité par session.

---

## 5. Conformité légale

### 5.1 Mentions légales (LCEN art. 6)

**État actuel :** `apps/web/src/app/(shop)/mentions-legales/page.tsx`

```
SIRET: [SIRET À COMPLÉTER]      ❌
RCS: [RCS À COMPLÉTER]          ❌
Capital social: [À COMPLÉTER]   ❌
Directeur de publication: [À COMPLÉTER]  ❌
Hébergeur: Railway Corp.        ✓
Adresse: 18 bis Rue Méchin, 93450 L'Île-Saint-Denis ✓
DPO contact: même que contact ⚠️ (pas de DPO réel)
```

**Verdict :** **non conforme**. Tout site éditant un service en ligne en France doit afficher SIRET, RCS, capital, directeur de publication. Sanction LCEN art. 6 : amende jusqu'à 75 000€.

**Action :** voir [2026-04-11-go-live-readiness.md](./2026-04-11-go-live-readiness.md) section "Bloqueurs légaux".

### 5.2 CGV (Code de la consommation art. L221-5)

**État actuel :** `apps/web/src/app/(shop)/cgv/page.tsx` — 8 sections d'1 ligne chacune.

**Verdict :** **existe formellement, juridiquement faible.** Une vraie CGV ecommerce B2C couvre 14 obligations légales :
- Identité et coordonnées vendeur (✓ partiel)
- Caractéristiques essentielles produits (manque)
- Prix et taxes (✓ générique)
- Frais de livraison (✓ générique)
- Modalités de paiement (manque détail)
- Modalités de livraison (✓ générique)
- Date de livraison (manque)
- Droit de rétractation (✓ mention 14 jours)
- **Formulaire de rétractation type (manque — obligatoire)**
- **Garantie légale 2 ans (✓ mention)**
- **Garantie commerciale si applicable (manque)**
- SAV (manque)
- Médiation (✓ FEVAD)
- Données personnelles RGPD (manque dans CGV)

**Action :** rédiger une vraie CGV. Soit par un avocat (~500-1500€), soit générer un draft avec un template juridique. Pour la phase démo, draft suffit. **Effort :** 1-2h pour un draft solide.

### 5.3 Factures (CGI art. 289)

**Réf :** `services/ecommerce/src/routes/admin-invoices/index.ts` (refactor F5)

**État après F5 :**
- ✓ Helper PDF refactoré, accessible côté admin ET client (avec ownership check)
- ✓ Footer lit `NEXT_PUBLIC_LEGAL_SIRET` et `NEXT_PUBLIC_LEGAL_TVA_INTRACOM` depuis l'env (au lieu du hardcoded XXX)
- ❌ **Si env vars non set, fallback "SIRET non renseigné" → facture invalide juridiquement**
- ❌ **Numérotation = `orderNumber`** (séquence orders, pas séquence factures). Art. 289-VII CGI exige une séquence facture **dédiée, séquentielle, continue, sans rupture, propre par exercice fiscal**. Le format conforme typique : `FAC-2026-000001`, `FAC-2026-000002`, etc.
- ❌ **Pas d'envoi auto facture par email** au moment du paiement. Art. 289-VII : facture doit être émise au plus tard à la livraison. L'envoyer manuellement par l'admin n'est pas conforme.
- ❌ **Pas d'archivage légal** 10 ans (art. L102 B LPF).

**Action :** implémenter la séquence dédiée + l'envoi auto + l'archivage. **Effort :** ~3-4h. Voir [2026-04-11-go-live-readiness.md](./2026-04-11-go-live-readiness.md) chantier "Factures conformes".

### 5.4 RGPD

**Bons points :**
- ✓ `GET /auth/export` — droit à la portabilité (art. 20)
- ✓ `DELETE /auth/account` — droit à l'effacement (art. 17), avec anonymisation au lieu de hard delete pour préserver l'intégrité order history
- ✓ `ConsentCheckbox` réutilisable pour les forms qui collectent des données
- ✓ Cookie banner (`apps/web/src/components/CookieBanner.tsx`)
- ✓ Newsletter avec double opt-in et unsubscribe token

**Manques :**
- ❌ DPO contact pointe vers `brand.email` (pas un DPO réel ni un délégué nommé)
- ❌ Pas de page "Mes données" dans l'espace client qui expose les boutons export + delete (les routes existent mais pas d'UI)
- ❌ Pas de registre RGPD documenté pour les traitements
- ❌ Brevo (sous-traitant US/EU) doit apparaître dans la politique de confidentialité — pas vérifié

### 5.5 Stripe + paiement

**État actuel :**
- ✓ Stripe Elements bien intégré
- ✓ Webhook signature vérifiée avec `STRIPE_WEBHOOK_SECRET`
- ✓ PaymentIntent client_secret jamais exposé côté JS sans token
- ❌ **Mode TEST en prod** (cf S1, bloqueur P0)

---

## 6. UX et accessibilité

### 6.1 Mobile / iPhone

**État après C2 + C2bis (PR #104, #121) :**
- ✓ `viewport-fit: cover` configuré dans le `Viewport` Next.js
- ✓ `100dvh` partout (5 occurrences corrigées)
- ✓ SOSButton avec `env(safe-area-inset-*)` calc → respecte le home indicator
- ✓ Inputs `font-size: 16px` sur mobile pour bloquer iOS auto-zoom (scope strict text/email/password/tel/url/search/number + textarea + select, exclut checkbox/radio)
- ✓ NewsletterForm avec `min-width: 0` + `width: 0` + `flex: 1 1 0` pour pas overflow
- ✓ Test e2e responsive iPhone 13 + iPad Pro 11 (29 tests par device, vert)

**À faire (out of scope C2bis) :**
- Tap targets validation (iOS HIG 44×44) — pas auditable sans device réel
- Notch + header sticky comportement
- Validation visuelle de chaque page sur device réel par @Lsardi

### 6.2 Performance frontend

- Next.js prod build OK, code-splitting auto
- Images Next.js avec `unoptimized` sur les avatars Google reviews (intentionnel — pas hébergées par nous)
- Pas de mesure Lighthouse / Core Web Vitals dans le repo. À ajouter.

### 6.3 Accessibilité

**Bons points :**
- Skip link "Aller au contenu principal" dans `(shop)/layout.tsx`
- `aria-modal`, `aria-label`, `role="dialog"` sur SOSButton
- Focus trap dans le menu SOS
- Escape key handler
- Cookie banner accessible

**Manques :**
- Pas d'audit axe-core / pa11y dans le CI
- Contrastes du theme dark non vérifiés (le neon `#00FFD1` sur void `#0A0A0A` passe WCAG AA mais pas testé sur tous les variants)
- Pas de dyslexia-friendly font option

---

## 7. Performance et observabilité

### 7.1 DB

- Prisma multi-schema OK, pas de cross-schema joins évités
- **Index :** ajouts récents `order_items.product_id`, `order_items.variant_id` (PR #113). Reste à auditer : `customer_profiles.user_id` (a un @unique = OK), `audit_logs.created_at` (vérifié OK), `repair_tickets.status` (à vérifier).
- Pas de slow query log activé sur Railway Postgres (à activer pour la prod commerciale)

### 7.2 Caches

- ✓ Cart en Redis avec key `cart:{userId}` ou `cart:anon:{sessionId}`
- ✓ Newsletter scooter-models endpoint avec `Cache-Control: public, max-age=300, s-maxage=300` (PR #114)
- ✓ Google reviews fetch avec Next.js `revalidate: 86400` (1 day)
- ❌ Pas de cache HTTP sur les routes `/products` (chaque page produit fait un round-trip Postgres) — à ajouter pour les pics démo

### 7.3 Métriques

- ✓ Prometheus metrics plugin sur les 4 services (`services/*/src/plugins/metrics.ts`)
- ✓ Alerting rules `infra/alerting-rules.yml` corrigées par PR #89 (préfixe `trottistore_*` au lieu de `http_*`)
- ❌ Pas de dashboard Grafana versionné dans le repo
- ❌ Pas d'APM (DataDog, NewRelic, Sentry...). Sentry serait utile pour tracker les erreurs prod en temps réel.

### 7.4 Logs

- ✓ Logger Fastify (Pino) en JSON sur les 4 services
- ✓ Audit log table `shared.audit_logs` avec USER_ID, ACTION, RESOURCE, IP
- ❌ Pas de centralisation des logs (Railway expose seulement les logs récents par service, pas de search cross-service)

---

## 8. Tests

### 8.1 Stats

- **581 fichiers de test** (`*.test.ts`)
- **66 fichiers source services** (TS hors tests)
- Ratio test/source : ~8.8 (très bon nominal)

**Mais attention :** la majorité des tests sont des `*.integration.test.ts` qui mockent prisma. Donc le ratio de couverture **réelle** (= tests qui touchent une vraie DB) est proche de 0.

### 8.2 Run cible par service

| Service | Tests passés (dernière run) |
|---|---|
| ecommerce | 159 / 160 (1 skipped) |
| crm | 60 / 60 (incluant newsletter F3) |
| sav | 31 / 31 (incluant scooter-models) |
| analytics | non observé en détail |
| web | 46 / 46 |
| smoke (cross-service) | 18 / 18 |
| e2e Playwright | 29 tests × 2 devices (iPhone 13 + iPad Pro 11) |

### 8.3 Test gaps prioritaires

Voir [2026-04-11-test-coverage-gap-analysis.md](./2026-04-11-test-coverage-gap-analysis.md). En résumé :

**Pas couvert (P0/P1) :**
- Stripe webhook → DB sous concurrence (mocké uniquement)
- Stock integrity sous race condition (mocké uniquement)
- SAV notification engine email send (mocké)
- Migration Prisma roll-forward / roll-back
- E2E checkout réel avec Stripe test cards 4242

**Pas couvert (P2) :**
- Tests visuels regression (Percy, Chromatic — none installed)
- Tests d'accessibilité automatisés (axe-core)
- Load testing / k6
- Tests de migration data (sync WooCommerce → TrottiStore schema)

### 8.4 Fragilité tests existants

- ✓ Pas de test flaky observé pendant la session démo (14/14 e2e pass durant la PR #99)
- ⚠️ Quelques mocks Prisma fragiles : `mockResolvedValueOnce` accumulé entre tests si `clearAllMocks` n'est pas suivi de `resetAllMocks`. Vu sur la PR newsletter F3 où j'ai dû refactorer en `beforeEach: buildApp()` au lieu de `beforeAll`.
- ⚠️ Le test `responsive.smoke.spec.ts` est fragile : la moindre modif CSS qui touche au layout flex peut le casser (vu sur PR #104 + #123).

---

## 9. Ops / DevOps

### 9.1 CI

`.github/workflows/ci.yml` — sur chaque PR + push main :
- Lint & Type Check (pnpm filter sur 8 packages)
- Build (turbo)
- Validate Prisma Schema
- Unit Tests
- E2E Tests (Playwright)
- Smoke Tests (18)
- Security Scan (`pnpm audit --audit-level=high`)
- Docker Build matrix × 4 services
- CI Gate (résultat agrégé)

**Bons points :**
- Couverture large
- Gate bloquant sur PR
- Build Docker pour valider que l'image se construit (sans la pousser au registry)

**À améliorer :**
- Node.js 20 deprecated (annoté à chaque run, va casser en septembre 2026)
- Pas de cache pnpm partagé entre jobs (chaque job réinstalle)
- Pas de `concurrency` group → 2 push rapides peuvent run en double

### 9.2 Deploy production (`deploy-production.yml`)

**Workflow dispatch manuel** avec inputs :
- `service` (all / web / ecommerce / crm / sav / analytics / none)
- `run_migrations` (default: true)
- `run_seed_catalog` (default: false)
- `run_seed_orders` (default: false)
- `run_healthchecks` (default: true)

**Concurrency group `deploy-production`** : pas 2 deploys en // (bon).

**Healthchecks post-deploy :**
- Curl chaque service `/health`
- Curl `/ready` ecommerce
- ✓ URLs dans GitHub vars `PROD_*_URL` (set à 17:57 aujourd'hui)
- ⚠️ Le Web check accepte 200/308 mais pas 301 → bug de fiabilité, déjà observé. À élargir.
- ⚠️ Si `Prepare DB` ne tourne pas (run_migrations=false), `Post-deploy healthchecks` est skipped (conditionnel mal écrit). Vu pendant le smoke test admin login.

### 9.3 Railway

- 5 services + Postgres + Redis (workspace `Lyes's Projects`, project `trottistore`, env `production`)
- DATABASE_URL interne (`postgres.railway.internal:5432`) + DATABASE_PUBLIC_URL pour debug local
- BREVO_API_KEY configuré → emails newsletter prod fonctionnent (vérifié end-to-end)
- STRIPE en mode TEST (S1)

### 9.4 Secrets management

**GitHub Secrets (env production) :**
- `SEED_ADMIN_PASSWORD` (rotaté aujourd'hui à 17:17)
- `RAILWAY_TOKEN`

**Railway env vars :**
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (TEST mode)
- `BREVO_API_KEY`
- `DATABASE_URL` (interne)
- `JWT_ACCESS_SECRET`

**Manques :**
- Pas de rotation automatique
- Pas de Vault / Doppler / 1Password Connect
- Le mot de passe admin partagé en clair dans le chat de cette session (rotation recommandée)

---

## 10. Findings résiduels

Triés par priorité d'action.

### P0 (bloqueurs go-live)

| # | Sujet | Réf |
|---|---|---|
| S1 | Stripe en mode TEST sur prod | `services/ecommerce/src/index.ts:36` |
| L1 | Mentions légales placeholder `[À COMPLÉTER]` | `apps/web/src/app/(shop)/mentions-legales/page.tsx:19` |
| L2 | Footer facture lit env vars qui ne sont pas set → "SIRET non renseigné" | `services/ecommerce/src/routes/admin-invoices/index.ts:18` |
| L3 | Numérotation facture non conforme art. 289 CGI | idem |

### P1 (à corriger avant intensité commerciale)

| # | Sujet | Réf |
|---|---|---|
| S2 | Stock integrity 3 P1 (codex audit non livré) | cf section 4.2 |
| L4 | CGV minimales (8 sections d'1 ligne) | `apps/web/src/app/(shop)/cgv/page.tsx` |
| L5 | Pas d'envoi auto facture après paiement | `services/ecommerce/src/routes/orders/index.ts:1483` |
| L6 | Pas d'archivage légal facture 10 ans | n/a |
| O1 | E2E healthcheck accept 200/308 only (rejette 301) | `.github/workflows/deploy-production.yml:176` |
| T1 | Pas de Testcontainers — mocks cachent les bugs | chantier S2 du backlog |

### P2 (dette / hygiène)

| # | Sujet | Réf |
|---|---|---|
| S3 | XSS stocké possible via reviews content | `services/ecommerce/src/routes/reviews/index.ts` |
| S4 | Pas de rate-limit dédié sur reviews/newsletter/repairs intake | idem |
| S5 | UUID v4 token tracking observable | `schema.prisma:749` |
| S6 | Pas de CSP / HSTS / X-Frame-Options | `apps/web/next.config.ts` |
| L7 | DPO pas nommé | `mentions-legales/page.tsx:55` |
| L8 | Pas de page "Mes données" dans l'espace client | n/a |
| L9 | Brevo absent de la politique de confidentialité | `apps/web/src/app/(shop)/politique-confidentialite/page.tsx` |
| O2 | Node.js 20 deprecated dans CI | `.github/workflows/ci.yml` |
| O3 | Pas de cache pnpm partagé entre jobs CI | idem |
| O4 | Pas de Sentry / APM | n/a |
| O5 | Pas de rotation auto secrets | n/a |
| P1 | Pas de cache HTTP sur `/products` | `services/ecommerce/src/routes/products/index.ts` |
| P2 | Pas de slow query log Postgres | Railway settings |
| P3 | Pas de mesure Lighthouse / CWV | n/a |
| A1 | Pas d'audit axe-core / pa11y | n/a |
| A2 | Contrastes theme non vérifiés | `apps/web/src/lib/themes.ts` |

### P3 (nice-to-have)

| # | Sujet |
|---|---|
| Visual regression tests (Percy/Chromatic) |
| Load testing k6 |
| Threat model formalisé |
| Registre RGPD documenté |
| Dashboard Grafana versionné |
| Centralisation logs (Loki/Datadog) |

---

## 11. Prochaines actions

Priorisées par impact business.

### Sprint immédiat (semaine 16)

1. **S1 — Stripe live** (5 min tech, bloquant) : @Lsardi récupère les keys depuis dashboard Stripe live, set les 3 env vars Railway, redéploie ecommerce. **Bloqueur 100%.**
2. **L1 + L2 + L3 — Factures conformes** (~3-4h dev) : env vars `NEXT_PUBLIC_LEGAL_*` set sur Railway + nouvelle séquence numérotation facture (`FAC-2026-NNNNNN`) avec model `InvoiceCounter` + envoi auto facture par email après paiement. Voir [2026-04-11-go-live-readiness.md](./2026-04-11-go-live-readiness.md).
3. **S2 — Stock integrity** (~2-3h, déjà briefé) : extraction `decrementStockOrThrow` shared + colonne `stockReleased` Order. Voir [2026-04-11-stock-integrity-audit.md](./2026-04-11-stock-integrity-audit.md).
4. **L4 — CGV draft pro** (~1-2h) : template juridique B2C ecommerce français complet, draft à valider par avocat à terme.

**Estimation total :** 1 jour-homme côté dev + récupération assets côté @Lsardi (Stripe + SIRET).

### Sprint suivant (semaine 17-18)

5. **L5 — Envoi facture par email** (~1h) : déjà préparé en F1 pattern, à dupliquer pour facture après `handlePaymentSuccess`.
6. **L6 — Archivage facture 10 ans** : stockage S3-compatible (Railway Files / Backblaze B2 / Cloudflare R2). Effort 2-3h.
7. **L9 — Politique confidentialité** : ajouter Brevo + Stripe + Railway dans la liste des sous-traitants. 30 min.
8. **L8 — Page "Mes données"** dans `/mon-compte` qui expose les boutons RGPD (export + delete). 1h.
9. **Testcontainers chantier S2** : un seul service comme proof of concept (ecommerce probable), puis étendre. **2-3 jours.**
10. **Sentry intégration** sur les 4 services + web. 2h.

### Sprint S3+

11. **CSP + headers de sécu** (S6) : 1h
12. **Load testing k6** sur le checkout flow : 1 jour
13. **Visual regression Chromatic** ou **Percy** sur les pages clés : 1 jour
14. **Threat model document** : 1 jour atelier
15. **Centralisation logs** : 2-3 jours infra

---

## Annexes

- [2026-04-11-go-live-readiness.md](./2026-04-11-go-live-readiness.md) — checklist actionnable pour go-live commercial réel
- [2026-04-11-stock-integrity-audit.md](./2026-04-11-stock-integrity-audit.md) — détail technique des 3 P1 stock + plan d'implémentation
- [2026-04-11-tech-debt-registry.md](./2026-04-11-tech-debt-registry.md) — registre exhaustif de la dette connue
- [2026-04-11-test-coverage-gap-analysis.md](./2026-04-11-test-coverage-gap-analysis.md) — analyse des gaps de couverture
- [2026-04-11-railway-rehab-lite.md](./2026-04-11-railway-rehab-lite.md) — audit lite précédent (Railway rehab)
- [docs/codex-tasks/triage-fix-branches-2026-04-11.md](../codex-tasks/triage-fix-branches-2026-04-11.md) — triage des fix branches par codex
- [docs/codex-tasks/next-batch-2026-04-11.md](../codex-tasks/next-batch-2026-04-11.md) — brief T1-T5 pour codex
- [docs/backlog/post-demo-2026-04-11.md](../backlog/post-demo-2026-04-11.md) — backlog post-démo source

---

*Audit réalisé par Claude Opus 4.6 (1M context) en remplacement de l'audit codex qui a atteint ses limites en fin de session 2026-04-11. Si codex reprend, il pourra cross-checker ce doc et compléter avec un angle alternatif.*
