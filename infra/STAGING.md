# Staging Environment — Railway

## Prerequis

1. Projet Railway "trottistore-staging" cree
2. Secret GitHub `RAILWAY_TOKEN` configure (account token)
3. Environment "staging" cree dans le projet Railway

## Services Railway

| Service | Source | Port | Start command |
|---------|--------|------|---------------|
| web | apps/web | 3000 | `pnpm --filter @trottistore/web start` |
| ecommerce | services/ecommerce | 3001 | `node dist/index.js` |
| crm | services/crm | 3002 | `node dist/index.js` |
| sav | services/sav | 3004 | `node dist/index.js` |
| analytics | services/analytics | 3003 | `node dist/index.js` |
| postgres | Railway plugin | 5432 | (managed) |
| redis | Railway plugin | 6379 | (managed) |

## Variables d'environnement (par service)

### Communes (tous les services backend)

```
DATABASE_URL=<railway postgres internal URL>
REDIS_URL=<railway redis internal URL>
JWT_ACCESS_SECRET=<generer: openssl rand -hex 32>
NODE_ENV=staging
```

### web (Next.js)

```
BASE_URL=https://staging.trottistore.fr
API_URL=https://ecommerce-staging.trottistore.fr
NEXT_PUBLIC_BRAND_NAME=TROTTISTORE
NEXT_PUBLIC_BRAND_DOMAIN=staging.trottistore.fr
NEXT_PUBLIC_BRAND_OG_URL=https://staging.trottistore.fr
```

### ecommerce

```
PORT_ECOMMERCE=3001
BASE_URL=https://staging.trottistore.fr
COOKIE_SECRET=<generer: openssl rand -hex 32>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FEATURE_CHECKOUT_EXPRESS=true
```

### crm

```
PORT_CRM=3002
BREVO_API_KEY=<optionnel, pour SMS reel>
BREVO_SENDER_EMAIL=sav@trottistore.fr
```

### sav

```
PORT_SAV=3004
SMTP_HOST=<Brevo SMTP ou vide>
FEATURE_AUTO_NOTIFICATIONS=true
```

### analytics

```
PORT_ANALYTICS=3003
CLICKHOUSE_URL=<optionnel>
```

### Cron triggers

Dans GitHub repository settings → Secrets:
```
TRIGGERS_RUN_URL=https://crm-staging.trottistore.fr/api/v1/triggers/run
TRIGGERS_RUN_TOKEN=<vide pour l'instant>
```

## Setup Railway (etapes manuelles)

1. Creer le projet sur railway.app
2. Ajouter les plugins : PostgreSQL + Redis
3. Creer 5 services (web, ecommerce, crm, sav, analytics)
4. Pour chaque service :
   - Root directory : `apps/web` ou `services/<name>`
   - Build command : `pnpm install && pnpm build`
   - Start command : voir tableau ci-dessus
5. Configurer les variables d'env
6. Lier le repo GitHub pour auto-deploy
7. Creer l'environment "staging"

## Deploiement

```bash
# Manuel (depuis GitHub Actions)
# → Actions → Deploy Staging → Run workflow

# Automatique
# → Push sur main declenche le deploy
```

## Verification post-deploy

```bash
# Healthchecks
curl https://ecommerce-staging.trottistore.fr/health
curl https://crm-staging.trottistore.fr/health
curl https://sav-staging.trottistore.fr/health
curl https://analytics-staging.trottistore.fr/health

# Readiness (DB + Redis)
curl https://ecommerce-staging.trottistore.fr/ready

# Seed staging data
railway run --service ecommerce --environment staging -- pnpm db:deploy
railway run --service ecommerce --environment staging -- pnpm db:seed:demo
```

## Rollback

```bash
# Depuis Railway dashboard : cliquer "Rollback" sur le dernier deploy
# Ou depuis CI : re-run le workflow sur le commit precedent
```
