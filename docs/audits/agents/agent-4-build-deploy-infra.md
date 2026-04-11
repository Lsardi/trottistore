# Agent 4 — Build / Run / Deploy / Infra

> **Date :** 2026-04-11
> **Agent :** Claude Code Explore subagent
> **Scope :** package.json + Dockerfiles + workflows GH Actions + infra/

## Scope effectif

- `package.json` (root, 62 lignes)
- `turbo.json` (20 lignes)
- `apps/web/package.json` (38 lignes)
- `services/*/Dockerfile` (4 × ~43-58 lignes)
- `apps/web/Dockerfile` (53 lignes)
- `.github/workflows/ci.yml` (234 lignes)
- `.github/workflows/deploy-production.yml` (213 lignes)
- `.github/workflows/deploy-staging.yml` (121 lignes)
- `.github/workflows/cron-triggers-run.yml` (69 lignes)
- `docker-compose.dev.yml` (90 lignes)
- `docker-compose.prod.yml` (232 lignes)
- `infra/Caddyfile` (27 lignes)
- `infra/backup-db.sh` (20 lignes)
- `RELEASE_RUNBOOK.md` (196 lignes)
- `.dockerignore` (15 lignes)

## Findings supplémentaires

### 1. P1 — `deploy-staging.yml` mauvais service naming, pas cohérent avec prod 🔴

**Réf :** `.github/workflows/deploy-staging.yml:38,46,54,62,70` vs `.github/workflows/deploy-production.yml:139,145,151,157,163`

**Symptôme :** Staging déploie via `--service web` / `--service ecommerce` (noms courts), tandis que Production utilise `--service '@trottistore/web'` / `--service '@trottistore/service-ecommerce'` (full workspace names). Les Railway services en staging n'ont **pas le préfixe `@trottistore/`** et pas le préfixe `service-`.

**Risque :** Déploiements staging échouent silencieusement (service names mismatch) ou échouent parce que `web` !== `@trottistore/web` en Railway. **Staging env probablement cassée** (à vérifier en lançant un déploy staging).

**Fix proposé :** Harmoniser les names avec prod (`--service '@trottistore/web'` etc.) OU utiliser des variables `vars.STAGING_*_SERVICE_NAME` (comme prod utilise `vars.PROD_*_URL`). Une troisième voie : renommer les services Railway en staging pour matcher prod.

### 2. P2 — Deployment sans timeout défini

**Réf :** `.github/workflows/deploy-production.yml:135-164`

**Symptôme :** Les steps de déploiement via `railway up` (Web, Ecommerce, CRM, SAV, Analytics) n'ont **aucun timeout** défini (`timeout-minutes`). Un build Railway lent ou bloqué peut traîner indéfiniment.

**Risque :** Déploiement suspendu invisible, ressources GitHub Actions bloquées (le run reste in_progress sans feedback), diagnostique difficile.

**Fix proposé :** Ajouter `timeout-minutes: 15` au job `deploy` (ou à chaque step de `railway up`). 15 min est suffisant pour un build Railway raisonnable, dépasser indique un problème.

### 3. P2 — `deploy-staging.yml` hardcoded Railway project ID

**Réf :** `.github/workflows/deploy-staging.yml:21`

**Symptôme :** `RAILWAY_PROJECT_ID = 64a2a1d8-a50a-4f24-80dd-bbe5e0ef1b4d` (UUID fixe) en dur dans le workflow, contrairement à `deploy-production.yml:37` qui utilise `${{ vars.RAILWAY_PROJECT_ID }}`.

**Risque :** Si le projet Railway de staging change, il faut modifier le workflow et créer une PR (pas agile). Drift entre prod et staging.

**Fix proposé :** Utiliser `${{ vars.STAGING_RAILWAY_PROJECT_ID || '64a2a1d8...' }}` pour garder la valeur comme default mais permettre override.

### 4. P2 — Healthcheck endpoint Web accepte HTTP 308 mais ignore les redirects

**Réf :** `.github/workflows/deploy-production.yml:176-178` et `deploy-staging.yml:84-86`

**Symptôme :** Healthcheck accepte `200` ou `308` (`[ "$STATUS" = "200" ] || [ "$STATUS" = "308" ]`). HTTP 308 (Permanent Redirect) indique un problème de configuration (domaine mal mappé, reverse proxy mal configuré). **Accepter 308 masque un problème infrastructure sous-jacent.**

**Risque :** Déploiement passe le healthcheck alors que le service redirige (dead endpoint), usage de service cassé pas détecté immédiatement.

**Fix proposé :** Refuser 308, debugger pourquoi Web redirige. Vérifier `NEXT_PUBLIC_*` et rewrites Next.js. Si le redirect est légitime (apex → www), accepter aussi 301 mais pas 308.

### 5. P2 — Turbo cache non documenté, pas de remote cache

**Réf :** `turbo.json:4-18`

**Symptôme :** `globalDependencies: [".env"]` mais aucune configuration de cache externe (Turbo Cloud, S3). Build CI sans cache partagé entre runs. `outputs` déclarés mais efficacité du cache non vérifiée.

**Risque :** Chaque CI run rebuild entièrement (slow CI), pas d'économie sur les dépendances stables. Correspond au D2 connu (pas de cache pnpm partagé) mais étend la portée.

**Fix proposé :** Configurer `remoteCache` dans `turbo.json` avec backend S3/HTTP, OU documenter explicitement la politique de cache CI (re-build intentionnel pour reproductibilité).

## Non-findings (vérifié, OK)

- **Dockerfiles multi-stage** : OK (base → deps → build → runner). User non-root (`USER node`) présent partout.
- **Exposed ports** : OK (3000, 3001, 3002, 3003, 3004). Pas de ports accidentellement exposés.
- **`.dockerignore`** : OK (`node_modules`, `.git`, `.next`, `.env`, `coverage`, etc. exclus).
- **Backup DB** : OK (script `infra/backup-db.sh` avec gzip, rotation 30j, aussi dans `docker-compose.prod.yml`).
- **Healthcheck routes** : OK (tous les services ont `/health`, ecommerce a `/ready`).
- **Migrations via `db:deploy`** : OK (utilisé en CI et prod workflow, jamais `db:push`).
- **Seed idempotence** : OK (`run_seed_catalog`/`orders` gardé en `default: false`, guards présents).
- **CI gate bloquant** : OK (`ci-gate` job vérifie tous les résultats et exit 1 si failure).
- **E2E timeout** : OK (20 minutes, raisonnable pour Playwright).
- **Secrets in logs** : OK (utilisation de GitHub secrets, pas d'echo direct).

## Angles non vérifiés

- Script de rollback automatisé (`RELEASE_RUNBOOK.md` documente le processus manuel, pas d'automation)
- Monitoring post-deploy (alerting via Prometheus dans `infra/`, pas testé)
- Secret rotation policy (pas de doc sur la fréquence de rotation Stripe, JWT, etc.)
- Load test results (`package.json` a `autocannon` + `load-test.ts`, pas exécuté en CI)
- Blue/green deployment : Railway n'expose pas de stratégie native, on fait du rolling restart

## Recommandations

### Quick wins (< 30 min)
- Fixer naming services staging pour matcher prod (`@trottistore/web`, etc.)
- Ajouter `timeout-minutes: 15` au job `deploy` (deploy-production.yml)
- Refuser HTTP 308 dans healthchecks (changer `[ "$STATUS" = "200" ] || [ "$STATUS" = "308" ]` → `[ "$STATUS" = "200" ]`)

### Structurants (> 1h)
- Documenter / configurer cache Turbo externe (S3 ou Turbo Cloud) pour accélérer CI
- Implémenter rollback script automatisé (consulter `RELEASE_RUNBOOK.md` section 5 + git tag-based recovery)
- Ajouter secret rotation alert (metadata sur Railway ou webhook CI)
- Standardiser Docker build context & args (Web passe `API_*_URL` en ARG, services non)
