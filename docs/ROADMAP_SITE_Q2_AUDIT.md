# Roadmap Site Q2 — Audit, Plan de Correction et Plan d'Amélioration

Date: 2026-04-09  
Périmètre: `apps/web`, `services/*`, `infra/*`, `.github/workflows/*`

## 1. Résumé exécutif

Le socle technique est mature (CI gate, sécurité de base, SSR, RGPD, observabilité), mais la prochaine étape n'est plus de "corriger": c'est d'augmenter la performance business du site (conversion, SEO transactionnel, efficacité du parcours checkout, efficacité SAV).

Positionnement proposé:
- Court terme: réduire le risque (sécurité + qualité release).
- Moyen terme: accélérer la conversion (PDP, checkout, catalogue, home).
- Long terme: industrialiser l'optimisation continue (SLO + expérimentation).

## 2. Audit de l'existant (notation)

## 2.1 Note globale

- Note globale: **84/100 (A-)**

Barème:
- Sécurité applicative/API (30): 24
- SDLC / CI-CD / gouvernance (25): 20
- Fiabilité / observabilité (20): 15
- Conformité / privacy (15): 13
- Performance / UX web (10): 12 -> normalisé à 8 pour total 84

## 2.2 Forces confirmées

1. Hardening HTTP et API déjà sérieux
- `helmet` + `rateLimit` global et ciblé.
- HSTS + Permissions-Policy.

Preuves:
- `services/ecommerce/src/index.ts`
- `infra/Caddyfile`

2. CI/CD structurée et industrialisée
- Jobs parallèles, scan sécurité, final gate unique.

Preuves:
- `.github/workflows/ci.yml`

3. Déploiement prod contrôlé
- `workflow_dispatch`, environnement `production`, healthchecks post deploy.

Preuves:
- `.github/workflows/deploy-production.yml`

4. Monitoring opérationnel en place
- `/metrics` sur les 4 services + Prometheus.

Preuves:
- `services/*/src/plugins/metrics.ts`
- `infra/prometheus.yml`

5. SEO/UX déjà renforcés
- SSR pages majeures, canonical/noindex, JSON-LD, parcours checkout amélioré.

## 2.3 Risques restants à traiter

1. `trustProxy: true` non restreint (risque boundary/proxy)
- Recommandation: CIDR/IP explicites.

2. Sanitization HTML regex maison sur fiche produit
- Recommandation: politique de sanitation robuste + tests anti-XSS dédiés.

3. E2E PR non bloquant (`continue-on-error`)
- Recommandation: rendre bloquant au moins sur `main` ou smoke E2E critique.

4. Labels métriques potentiellement trop granulaires
- Recommandation: stabiliser labels route pour éviter cardinalité excessive.

## 3. Pourquoi ce plan (justification des choix)

Objectif prioritaire: améliorer le **résultat business visible** sans casser la vélocité.

Pourquoi cet ordre:
1. PDP + Checkout en premier: ce sont les leviers ROI les plus directs.
2. Catalogue + Home ensuite: maximisent le volume entrant vers les PDP.
3. SEO transactionnel + SAV après: stabilise l'acquisition qualifiée et la fidélisation.
4. Sécurité/qualité en parallèle: protège les gains et évite les régressions coûteuses.

Principe de gouvernance:
- Chaque chantier doit avoir un KPI produit (pas seulement un KPI technique).
- Chaque PR doit apporter un gain observable ou réduire un risque majeur.

## 4. Plan de correction (risque) — 2 semaines

## Sprint R1 (P0)

1. Restreindre `trustProxy` sur tous les services
- Cible: liste CIDR/IP reverse-proxy.
- Succès: tests auth/rate-limit inchangés, en-têtes client non spoofables.

2. Durcir sanitation HTML produit
- Cible: sanitizer server-safe avec politique stricte + tests payload XSS.
- Succès: payloads XSS neutralisés, rendu contenu métier conservé.

3. E2E critique bloquant sur `main`
- Cible: smoke E2E checkout/auth/admin non optionnel.
- Succès: aucun merge `main` sans parcours critique valide.

4. Stabiliser labels métriques
- Cible: réduire cardinalité (route template).
- Succès: séries Prometheus stables, dashboard lisible.

## 5. Plan d'amélioration site (business) — 6 PRs

## PR A — Conversion PDP
Branche: `codex/pdp-conversion-boost`

Fichiers:
- `apps/web/src/app/(shop)/produits/[slug]/AddToCartSection.tsx`
- `apps/web/src/app/(shop)/produits/[slug]/page.tsx`
- `apps/web/src/app/globals.css`

Livrables:
- Bloc achat sticky (mobile + desktop).
- Réassurance visible avant CTA.
- Cross-sell "souvent achetés ensemble".

KPI:
- Add-to-cart rate
- CTR CTA achat

Justification:
- Le plus fort levier de conversion court terme est sur la fiche produit.

## PR B — Checkout frictionless
Branche: `codex/checkout-frictionless`

Fichiers:
- `apps/web/src/app/(shop)/checkout/page.tsx`
- `apps/web/src/app/(shop)/checkout/layout.tsx`
- `apps/web/src/lib/api.ts` (si adaptation)

Livrables:
- Form inline robuste.
- Erreurs instantanées.
- Frais/délais affichés tôt.

KPI:
- Checkout completion rate
- Payment success rate

Justification:
- Chaque point de friction au checkout détruit la marge immédiate.

## PR C — Catalogue performance commerciale
Branche: `codex/catalog-smart-filters`

Fichiers:
- `apps/web/src/app/(shop)/produits/page.tsx`
- `apps/web/src/app/(shop)/produits/CatalogueFilters.tsx`
- `apps/web/src/components/ProductCard.tsx`

Livrables:
- Filtres orientés usage réel (budget/autonomie/poids/disponibilité).
- Compare 2-3 produits.

KPI:
- PLP -> PDP CTR
- Usage des filtres

Justification:
- Un catalogue utile réduit la friction de choix et accélère l'achat.

## PR D — Homepage orientée conversion
Branche: `codex/home-conversion-v2`

Fichiers:
- `apps/web/src/app/(shop)/page.tsx`
- `apps/web/src/lib/brand.ts`
- `apps/web/src/components/StructuredData.tsx`

Livrables:
- Hero simplifié: 1 promesse + 1 CTA.
- Blocs d'entrée clairs (Acheter / Réparer / Pro).

KPI:
- Bounce rate
- Home -> PDP CTR

Justification:
- La home doit distribuer le trafic vers les pages qui convertissent.

## PR E — SEO transactionnel
Branche: `codex/seo-transactional-categories`

Fichiers:
- `apps/web/src/app/(shop)/produits/page.tsx`
- `apps/web/src/app/sitemap.ts`
- `apps/web/src/app/(shop)/guide/page.tsx`

Livrables:
- Catégories enrichies + FAQ + maillage guide/produit.

KPI:
- Organic clicks
- Conversion organic

Justification:
- Augmenter le trafic utile sans dépendre uniquement de l'acquisition payante.

## PR F — SAV commercial
Branche: `codex/sav-conversion-v2`

Fichiers:
- `apps/web/src/app/(shop)/reparation/page.tsx`
- `apps/web/src/app/(shop)/reparation/[slug]/page.tsx`
- `services/sav/src/routes/tickets/index.ts` (si besoin)

Livrables:
- Parcours devis plus guidé.
- Suivi réparation plus lisible.

KPI:
- Lead SAV rate
- Repeat purchase after SAV

Justification:
- Le SAV est un différenciateur direct pour la confiance et la fidélité.

## 6. Règles d'exécution (rigueur)

1. Chaque PR doit avoir:
- un objectif business,
- des métriques avant/après,
- un test plan,
- une stratégie rollback.

2. Priorisation:
- D'abord conversion directe (PDP/Checkout),
- puis acquisition (SEO/Home),
- puis optimisation SAV.

3. Done criteria:
- Lint + tests + smoke + CI gate verts,
- no regression UX mobile,
- KPI instrumenté.

## 7. Sources et référentiels

- OWASP API Security Top 10 (2023)
- OWASP ASVS
- OWASP XSS Prevention Cheat Sheet
- NIST SP 800-218 (SSDF)
- Fastify docs (`trustProxy`)
- Next.js docs (`useSearchParams` + Suspense)
- GitHub Actions docs (`workflow_dispatch`, environments/review deployments)

