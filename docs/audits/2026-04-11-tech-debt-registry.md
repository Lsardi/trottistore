# Tech Debt Registry — TrottiStore — 2026-04-11

> **Type :** Registre exhaustif de la dette technique connue, avec sévérité, effort et statut.
> **Source :** rétrospective des sessions 2026-04-10 (Railway rehab) + 2026-04-11 (post-démo) + audit codex.
> **Mainteneur :** mettre à jour à chaque PR qui ajoute, paye ou découvre de la dette.

## Légende

- **P0** = bloque le go-live commercial
- **P1** = à traiter dans les 2-4 semaines
- **P2** = dette acceptable mais à traiter à terme
- **P3** = nice-to-have

**Statut :** OPEN / IN_PROGRESS / RESOLVED / ACCEPTED (= dette consciente, pas de plan de payback)

---

## Sécurité (S)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| S1 | Stripe en mode TEST sur prod | P0 | OPEN | 5 min | `services/ecommerce/src/index.ts:36` |
| S2 | Stock integrity 3 P1 (codex audit) | P1 | OPEN | 4h | [stock-integrity-audit.md](./2026-04-11-stock-integrity-audit.md) |
| S3 | XSS stocké possible via reviews content | P2 | OPEN | 30 min | `services/ecommerce/src/routes/reviews/index.ts` |
| S4 | Pas de rate-limit dédié reviews / newsletter / repairs intake | P1 | OPEN | 15 min | (multiple) |
| S5 | UUID v4 token tracking observable | P2 | ACCEPTED | n/a | `schema.prisma:749` |
| S6 | Pas de CSP / HSTS / X-Frame-Options | P2 | OPEN | 1h | `apps/web/next.config.ts` |
| S7 | Pas de threat model formalisé | P2 | OPEN | 1 jour atelier | n/a |
| S8 | Secret admin en clair dans le chat session 2026-04-11 | P1 | OPEN | 5 min rotation | (action manuelle gh secret set) |
| S9 | Pas de rotation auto secrets | P3 | ACCEPTED | n/a | n/a |

**Sécurité résolus aujourd'hui (pour mémoire) :** P0-3 cron bypass, P0-4 customer merge, P1-1 orders status legacy, P1-2 sav quote IDOR, P1-5 password reset race, C1.1-C1.4 claims légales, C4.2 seed bcrypt mismatch, F2 env hardening.

---

## Légal / Conformité (L)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| L1 | Mentions légales placeholder `[À COMPLÉTER]` | P0 | OPEN | 30 min code + récup data | `apps/web/src/app/(shop)/mentions-legales/page.tsx:19` |
| L2 | Footer facture lit env vars non-set → "non renseigné" | P0 | OPEN | 5 min env vars | `services/ecommerce/src/routes/admin-invoices/index.ts:18` |
| L3 | Numérotation facture non conforme art. 289 CGI | P0 | OPEN | 2h | `admin-invoices/index.ts:62` |
| L4 | CGV minimales (8 sections d'1 ligne) | P1 | OPEN | 1-2h draft | `apps/web/src/app/(shop)/cgv/page.tsx` |
| L5 | Pas d'envoi auto facture par email après paiement | P1 | OPEN | 1h | `services/ecommerce/src/routes/orders/index.ts:1483` |
| L6 | Pas d'archivage légal facture 10 ans | P1 | OPEN | 2-3h | n/a |
| L7 | DPO pas nommé (juste contact email) | P2 | ACCEPTED | n/a | `mentions-legales/page.tsx:55` |
| L8 | Pas de page "Mes données" RGPD dans `/mon-compte` | P2 | OPEN | 1h | n/a |
| L9 | Brevo absent de la politique de confidentialité | P2 | OPEN | 30 min | `apps/web/src/app/(shop)/politique-confidentialite/page.tsx` |
| L10 | Stripe + Railway pas listés dans politique de confidentialité | P2 | OPEN | 30 min | idem |
| L11 | Cookie banner avec consent management mais pas d'audit RGPD | P3 | OPEN | 1h | `apps/web/src/components/CookieBanner.tsx` |
| L12 | Registre RGPD des traitements pas formalisé | P3 | OPEN | 1 jour | n/a |

**Légal résolus :** C1.1 Avis Google fake (PR #103), C1.2 3x sans frais, C1.3 24h SLA, C1.4 callback wired.

---

## Tests (T)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| T1 | Pas de Testcontainers — mocks Prisma cachent les bugs concurrence | P1 | OPEN | 2-3 jours | chantier S2 du backlog |
| T2 | E2E checkout réel avec vraie carte (4242) — pas dans CI | P1 | OPEN | 1 jour | n/a |
| T3 | Pas de visual regression tests (Percy/Chromatic) | P2 | OPEN | 1 jour | n/a |
| T4 | Pas de tests d'accessibilité automatisés (axe-core) | P2 | OPEN | 2-3h | n/a |
| T5 | Pas de load testing (k6) | P2 | OPEN | 1 jour | n/a |
| T6 | Tests de migration data (sync WooCommerce → schema) | P2 | OPEN | 1-2 jours | `scripts/sync-woocommerce.ts` |
| T7 | `responsive.smoke.spec.ts` fragile sur layout flex | P2 | ACCEPTED | n/a | `apps/web/e2e/responsive.smoke.spec.ts` |
| T8 | Mocks Prisma `mockResolvedValueOnce` accumulé entre tests si `clearAllMocks` → préférer `beforeEach: buildApp()` | P3 | OPEN | doc | (pattern) |

**Tests résolus aujourd'hui :** PR #114 scooter-models 7 tests, PR #115-#125 tous avec leurs tests respectifs.

---

## Performance (P)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| P1 | Pas de cache HTTP sur `/products` | P2 | OPEN | 30 min | `services/ecommerce/src/routes/products/index.ts` |
| P2 | Pas de slow query log Postgres activé | P1 | OPEN | 5 min | Railway settings |
| P3 | Pas de mesure Lighthouse / Core Web Vitals dans CI | P2 | OPEN | 2h | n/a |
| P4 | Pas de CDN devant Next.js (Vercel CDN ou Cloudflare) | P2 | ACCEPTED | n/a | Railway sans CDN |
| P5 | Images produits non optimisées en bulk | P2 | OPEN | 1 jour | `data/crawl/products.json` |
| P6 | `/products` retourne tous les fields à chaque call (over-fetch) | P3 | OPEN | 1h | adopt GraphQL ou field selection |
| P7 | Pas de query planner audit sur les routes lentes | P3 | OPEN | n/a | n/a |

**Perf résolus :** P1-8 index `order_items.product_id` + `variant_id` (PR #113), Cache-Control 5min sur `/repairs/scooter-models` (PR #114).

---

## Observabilité (O)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| O1 | Pas de Sentry / APM | P1 | OPEN | 2-3h | n/a |
| O2 | Pas de centralisation des logs (Loki / Datadog) | P2 | OPEN | 2-3 jours | n/a |
| O3 | Pas de dashboard Grafana versionné dans le repo | P2 | OPEN | 1 jour | n/a |
| O4 | Healthcheck CI rejette HTTP 301 (n'accepte que 200/308) | P1 | OPEN | 5 min | `.github/workflows/deploy-production.yml:176` |
| O5 | Post-deploy healthchecks SKIPPED si `run_migrations=false` | P2 | OPEN | 10 min | idem |
| O6 | Pas d'alerting actif (PagerDuty / OpsGenie / Discord webhook) | P1 | OPEN | 1h | n/a |
| O7 | Pas de status page publique (statuspage.io / cstate) | P3 | OPEN | 1 jour | n/a |

**Obs résolus aujourd'hui :** Alerting rules `infra/alerting-rules.yml` corrigées (PR #89), GitHub vars `PROD_*_URL` set pour les healthchecks.

---

## DevOps / CI / Build (D)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| D1 | Node.js 20 deprecated dans GitHub Actions | P1 | OPEN | 30 min | `.github/workflows/ci.yml` |
| D2 | Pas de cache pnpm partagé entre jobs CI | P2 | OPEN | 30 min | idem |
| D3 | Pas de `concurrency` group sur le CI principal | P2 | OPEN | 5 min | idem |
| D4 | Build Docker matrix × 4 services à chaque PR (lent) | P3 | ACCEPTED | n/a | idem |
| D5 | Pas de SLSA provenance / signed builds | P3 | OPEN | 1 jour | chantier S4 du backlog |
| D6 | Stale `start` scripts dans 4 services Fastify (résolu T2) | P3 | RESOLVED | n/a | `services/*/package.json` |
| D7 | Crawler suppliers Volt Corp désactivé (Cloudflare bot) | P2 | ACCEPTED | tant qu'on n'a pas accès B2B | `scripts/crawl-suppliers.ts` |

**DevOps résolus :** D6 stale start scripts (PR #112 T2).

---

## Architecture / Code Quality (A)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| A1 | Pas d'audit axe-core / pa11y dans CI | P2 | OPEN | 2h | n/a |
| A2 | Contrastes WCAG du theme dark non vérifiés sur tous les variants | P2 | OPEN | 1h | `apps/web/src/lib/themes.ts` |
| A3 | `services/ecommerce/src/routes/orders/index.ts` est gigantesque (~1700 lignes) | P2 | OPEN | 1 jour refactor | idem |
| A4 | Pas de OpenAPI spec / Swagger | P3 | OPEN | 1-2 jours | n/a |
| A5 | Pas de ADR (Architecture Decision Records) | P3 | OPEN | n/a | n/a |
| A6 | `apps/web/src/lib/api.ts` est gros (~800 lignes) | P3 | ACCEPTED | n/a | n/a |
| A7 | Multi-schema Prisma — pas d'isolation logique entre services | P2 | ACCEPTED | n/a | par design |
| A8 | Pas de validation runtime des env vars hors du wrapper `validateEnv` | P3 | OPEN | 1h | (chaque service) |

---

## Backend spécifique (B)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| B1 | Pas d'idempotency-key sur POST /orders | P2 | OPEN | 1h | `services/ecommerce/src/routes/orders/index.ts` |
| B2 | Pas d'idempotency-key sur POST /checkout/payment-intent | P2 | OPEN | 1h | idem |
| B3 | Filter price range absent de productsApi.list (filtré client-side dans quiz F6) | P2 | OPEN | 30 min | `services/ecommerce/src/routes/products/index.ts` |
| B4 | Cron CRM `cron.schedule("0 * * * *")` peut overlap si run > 1h | P3 | OPEN | 30 min lock | `services/crm/src/index.ts:222` |
| B5 | Pas de queue de jobs (BullMQ / Inngest) — emails fire-and-forget peuvent perdre des notifs | P2 | OPEN | 2-3 jours | n/a |
| B6 | `app.log` Pino mais pas de correlation ID per request | P3 | OPEN | 30 min | (chaque service) |
| B7 | Newsletter `/newsletter/admin/export.csv` utilise `findMany` non paginé (OK petite volumétrie, casse à grande) | P2 | OPEN | 30 min stream | `services/crm/src/routes/newsletter/index.ts` |

---

## Frontend spécifique (F)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| F1 | Pas de gestion d'erreur globale Next.js (error boundary par route) | P2 | OPEN | 2h | `apps/web/src/app/global-error.tsx` (existe mais minimal) |
| F2 | Pas de skeleton loader sur les pages SSR avec async data | P3 | OPEN | 1 jour | n/a |
| F3 | Pas d'optimistic UI sur add-to-cart | P3 | OPEN | 1h | `apps/web/src/components/ProductCard.tsx` |
| F4 | Garage sync n'utilise pas SWR / React Query — re-fetch manuel | P3 | OPEN | 2h | `apps/web/src/lib/garage.ts` |
| F5 | Pas de PWA (manifest, service worker, offline) | P3 | OPEN | 1 jour | n/a |
| F6 | `next.config.ts` sans `headers()` security headers | P2 | OPEN | 1h | (cf S6) |
| F7 | Pas d'animation framer-motion ou similar (sentiment statique) | P3 | ACCEPTED | n/a | par choix design |

---

## Données / Catalogue (C)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| C1 | Crawler suppliers Volt Corp désactivé en attente accès B2B | P2 | OPEN | dépend de l'accès | `scripts/crawl-suppliers.ts` |
| C2 | Crawler suppliers Wattiz prêt mais jamais run en prod | P2 | OPEN | 1h | idem |
| C3 | Pas de seed-suppliers.ts pour digérer le JSON crawler | P2 | OPEN | 2-3h | n/a |
| C4 | Pas de matching produits inter-fournisseurs (dédoublonnage) | P3 | OPEN | 1-2 jours | n/a |
| C5 | TVA pièces détachées : prix import HT vs TTC pas vérifié (chantier C3.2 backlog) | P2 | OPEN | 1h | `scripts/seed.ts` |
| C6 | Pas de stratégie de mise à jour catalogue (full reload vs delta) | P2 | OPEN | 1 jour design | n/a |
| C7 | Images produits stockées en URLs externes (woocommerce origin) — risque casse si site source down | P2 | OPEN | 1 jour download bulk | `data/crawl/products.json` |

---

## UX (U)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| U1 | Tap targets iOS HIG 44×44 pas validés sur device | P2 | OPEN | 1h device test | n/a |
| U2 | Notch + header sticky comportement pas validé sur device | P2 | OPEN | 1h device test | n/a |
| U3 | Pas d'indicateur visuel "panier sauvegardé" / animation add-to-cart | P3 | OPEN | 30 min | `ProductCard.tsx` |
| U4 | Quiz : pas de "back" entre questions | P3 | OPEN | 30 min | `apps/web/src/app/(shop)/quiz/page.tsx` |
| U5 | Compatibilité picker : pas de "récemment vus" | P3 | OPEN | 1h | `apps/web/src/app/(shop)/compatibilite/page.tsx` |
| U6 | Pas de breadcrumbs sur les pages produit (existent mais minimaux) | P3 | OPEN | 30 min | `produits/[slug]/page.tsx:210` |

**UX résolus aujourd'hui :** F8 checkout polish trust signals, F9 home rubriques, F1 shipped email, F2 garage sync, F4 Google reviews, F5 mes commandes, F6 quiz vrai stock, F7 mobile zoom restreint.

---

## Dépendances tiers (X)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| X1 | `@types/dompurify@3.2.0` deprecated | P3 | OPEN | 5 min | `pnpm install` warning |
| X2 | `whatwg-encoding@3.1.1` deprecated subdep | P3 | ACCEPTED | n/a | (transitive) |
| X3 | Pas de Renovate / Dependabot configuré | P2 | OPEN | 30 min | n/a |
| X4 | `bcryptjs@2.4.3` lent vs `bcrypt` natif sur grandes volumétries | P3 | ACCEPTED | n/a | trade-off install simplicity |
| X5 | `pdfkit` génère le PDF en mémoire (pas streamable) — OK pour 1 facture, scale mal pour 1000 | P2 | OPEN | 1 jour | `admin-invoices/index.ts` |
| X6 | `cheerio@1.0.0` pour le crawler — version stable mais lourde | P3 | ACCEPTED | n/a | n/a |

---

## Documentation (DOC)

| ID | Sujet | Sévérité | Statut | Effort | Réf |
|---|---|---|---|---|---|
| DOC1 | Pas de README développeur clair sur le setup local complet | P2 | OPEN | 1h | `README.md` |
| DOC2 | CLAUDE.md par package mais pas de doc d'onboarding pour humain | P2 | OPEN | 2h | n/a |
| DOC3 | Pas de schéma d'architecture visuelle (Mermaid / Excalidraw) | P3 | OPEN | 1h | `ARCHITECTURE.md` |
| DOC4 | Pas de runbook incident détaillé par scénario | P2 | OPEN | 2-3h | `RELEASE_RUNBOOK.md` (incomplet) |
| DOC5 | Pas d'API doc auto-générée | P3 | OPEN | 1 jour OpenAPI | n/a |

**Doc résolus :** post-demo backlog, audit lite Railway rehab, codex tasks T1-T5, ce registre.

---

## Stats globales

- **Total dette OPEN :** 84 items
- **Par sévérité :**
  - P0 : 4 (S1, L1, L2, L3)
  - P1 : 17
  - P2 : 41
  - P3 : 22
- **Par catégorie :**
  - Sécurité : 9 OPEN
  - Légal : 12 OPEN
  - Tests : 8 OPEN
  - Perf : 6 OPEN
  - Observabilité : 7 OPEN
  - DevOps : 5 OPEN
  - Architecture : 7 OPEN
  - Backend : 7 OPEN
  - Frontend : 6 OPEN
  - Catalogue : 7 OPEN
  - UX : 6 OPEN
  - Dépendances : 4 OPEN
  - Doc : 4 OPEN
  - Total : 88 (4 P0 + 84 autres)

**Note :** ce chiffre inclut tout, du P0 critique au P3 nice-to-have. La dette **bloquante** (P0) est gérable : 4 items, ~1 jour-homme + récup assets.

---

## Politique de payback

**Règles :**

1. **Toute PR fonctionnelle doit déclarer les nouveaux items de dette qu'elle introduit** dans la description PR.
2. **Ce registre doit être mis à jour à chaque PR** (ajout, résolution, downgrade de sévérité).
3. **Sprint review hebdo :** vérifier qu'au moins 1 item P0 ou 2 items P1 ont été clos chaque semaine.
4. **Pas de release publique avec un P0 ouvert.**

**Anti-patterns à éviter :**

- Marquer un item ACCEPTED juste pour le sortir du backlog visible (= dette cachée)
- Reprioriser un P1 en P2 sans justification écrite
- Ouvrir une PR feature qui ajoute > 3 items P2 sans en payer au moins 1

---

*Registre vivant. Dernière mise à jour : 2026-04-11 par Claude Opus 4.6.*
