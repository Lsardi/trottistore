# Provisioning Railway — runbook pas-à-pas (go-live)

But : passer de « CI/code prêts, infra vide » à un déploiement fonctionnel. ~½ journée.
Tout ce qui suit nécessite **tes accès** (Railway, DNS, Stripe) — non automatisable par un agent.

> ⚠️ Le script `scripts/railway-set-secrets.sh` contient des IDs (projet/env/services) issus d'un diagnostic du 2026-04-10. **Vérifie-les** (ils peuvent être périmés) après création des services — voir étape 6.

---

## 0. Prérequis (local)
```bash
npm i -g @railway/cli      # ou: brew install railway
railway login              # ouvre le navigateur
railway whoami             # doit afficher ton compte
```
Comptes nécessaires : **Railway**, **Stripe** (clés live), **Brevo** (API + SMTP), **Cloudflare** (Turnstile + DNS), **Sentry** (DSN).

## 1. Projet + environnement
```bash
railway init                       # crée le projet "trottistore" (ou via dashboard)
# Dashboard → Settings → Environments → créer "production" (et/ou "staging")
```

## 2. Plugins managés (DB + cache)
Dashboard → New → Database → **PostgreSQL**, puis **Redis**.
Railway expose `DATABASE_URL` et `REDIS_URL` ; on les référence par variable (étape 4).

## 3. Créer les 5 services
Les `railway.toml` de chaque dossier déclarent `builder = "DOCKERFILE"` → Railway build via le Dockerfile du service. Pour chacun : New → GitHub Repo → choisir le repo, puis **Settings → Root Directory** :

| Service Railway | Root Directory | Port |
|---|---|---|
| `@trottistore/web` | `apps/web` | 3000 |
| `@trottistore/service-ecommerce` | `services/ecommerce` | 3001 |
| `@trottistore/service-crm` | `services/crm` | 3002 |
| `@trottistore/service-sav` | `services/sav` | 3004 |
| `@trottistore/service-analytics` | `services/analytics` | 3003 |

(Garde **exactement** ces noms : les workflows `deploy-*.yml` ciblent `railway up --service '@trottistore/...'`.)

## 4. Variables d'env par service
Communes **aux 4 services Fastify** (référencer les plugins) :
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
NODE_ENV=production
```
**ecommerce** (en plus) : `PORT_ECOMMERCE=3001`, `BASE_URL=https://trottistore.fr`, `STRIPE_*` (étape 5), `BREVO_API_KEY`, `BREVO_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN`, `TOTP_ISSUER=TrottiStore`
**crm / sav** : `PORT_CRM=3002` / `PORT_SAV=3004`, `BREVO_API_KEY`, `SENTRY_DSN`
**analytics** : `PORT_ANALYTICS=3003`, `SENTRY_DSN`
**web** :
```
BASE_URL=https://trottistore.fr
API_URL=http://service-ecommerce:3001
API_CRM_URL=http://service-crm:3002
API_ANALYTICS_URL=http://service-analytics:3003
API_SAV_URL=http://service-sav:3004
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_SENTRY_DSN=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
NEXT_PUBLIC_BRAND_NAME=TROTTISTORE
NEXT_PUBLIC_BRAND_DOMAIN=trottistore.fr
NEXT_PUBLIC_LEGAL_SIRET=...   # + RCS/CAPITAL/FORM/DIRECTOR/TVA_INTRACOM (mentions légales/factures)
```
(Référence complète des variables : `.env.example`.)

## 5. Injecter les secrets (JWT/cookie générés + Stripe/Brevo)
```bash
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_PUBLISHABLE_KEY="pk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export BREVO_API_KEY="xkeysib-..."        # ou "" pour désactiver l'email
bash scripts/railway-set-secrets.sh --dry-run   # vérifier
bash scripts/railway-set-secrets.sh             # injecter pour de vrai
```

## 6. ⚠️ Vérifier les IDs du script
Si `--dry-run` cible un projet/services inconnus, mets à jour en tête de `scripts/railway-set-secrets.sh` :
`PROJECT_ID`, `ENV_ID`, `SERVICE_*`. Récupère-les :
```bash
railway status            # project + environment
railway service           # liste les services (IDs)
```

## 7. GitHub — relier la CI au déploiement
Repo → Settings → Secrets and variables → Actions :
- **Secret** `RAILWAY_TOKEN` = un *account/project token* Railway
- **Variable** `RAILWAY_PROJECT_ID` = l'ID du projet
- (Cron) Secrets `TRIGGERS_RUN_URL`, `TRIGGERS_RUN_TOKEN` si tu actives les triggers CRM

## 8. Appliquer les migrations Prisma
```bash
railway run --service '@trottistore/service-ecommerce' --environment production \
  -- pnpm --filter @trottistore/database db:deploy
```
(Applique toutes les migrations, dont `20260616120000_web_essentials_2fa_email_logs`.)
Seed catalogue optionnel : `... -- pnpm db:seed:demo`.

## 9. Déclencher le déploiement
```bash
# Staging d'abord (recommandé)
gh workflow run deploy-staging.yml --ref main -f service=all
# Prod (après validation staging)
gh workflow run deploy-production.yml --ref main \
  -f service=all -f run_migrations=true -f run_healthchecks=true
```

## 10. Vérifications
```bash
curl https://<host-ecommerce>/health
curl https://<host-ecommerce>/ready     # DB + Redis
```
Puis **QA navigateur** : homepage, produit, **checkout Stripe**, login client + admin, console sans violation **CSP**.

## 11. Branchements externes finaux
- **Stripe** → Webhooks → ajouter `https://<host>/api/v1/checkout/webhook`, secret `whsec_...` (= `STRIPE_WEBHOOK_SECRET`).
- **Brevo** → Webhook transac → `https://<host>/api/v1/webhooks/brevo?token=<BREVO_WEBHOOK_SECRET>` + **DNS SPF/DKIM/DMARC**.
- **Cloudflare** → Turnstile widget pour le domaine + DNS du domaine vers Railway.
- **Domaines** Railway : `trottistore.fr` (web) + sous-domaines services si exposés.

## Rollback
Railway dashboard → service → deploy précédent → **Rollback**. Ou re-run du workflow sur le commit antérieur.
