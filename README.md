# TrottiStore

Plateforme e-commerce + SAV + CRM pour boutique de trottinettes electriques.
Monorepo Next.js 15 + 4 microservices Fastify + PostgreSQL multi-schema.

## Architecture

```
Next.js (web)          :3000   Storefront + Back-office /admin
Ecommerce (Fastify)    :3001   Catalogue, commandes, panier, paiements, stock
CRM (Fastify)          :3002   Profils clients, fidelite, segments, campagnes
Analytics (Fastify)    :3003   Events, KPIs temps reel, dashboards
SAV (Fastify)          :3004   Tickets reparation, diagnostic, planning atelier
```

**Infrastructure :**
- PostgreSQL 16 (4 schemas : shared, ecommerce, crm, sav)
- Redis 7 (cache, sessions, panier, event queue)
- ClickHouse (analytics batch)
- MinIO (object storage, images)
- Mailpit (email dev)

## Prerequis

- Node.js >= 22
- pnpm 10.x (`corepack enable`)
- Podman ou Docker (pour PostgreSQL, Redis, etc.)

## Setup rapide

```bash
# 1. Cloner
git clone git@github.com:Lsardi/trottistore.git
cd trottistore

# 2. Copier les variables d'environnement
cp .env.example .env

# 3. Installer les dependances
pnpm install

# 4. Lancer l'infra (PostgreSQL, Redis, ClickHouse, MinIO, Mailpit)
podman compose -f docker-compose.dev.yml up -d
# ou: docker compose -f docker-compose.dev.yml up -d

# 5. Initialiser la base de donnees
pnpm db:push

# 6. (Optionnel) Charger les donnees de demo
pnpm db:seed:demo

# 7. Lancer tous les services en dev
pnpm dev
```

Le site est accessible sur http://localhost:3000 et le back-office sur http://localhost:3000/admin.

## Structure du monorepo

```
apps/
  web/                 Next.js 15 (App Router) — storefront + admin
services/
  ecommerce/           Fastify — catalogue, commandes, panier, auth, stock
  crm/                 Fastify — profils, fidelite, campagnes, segments
  analytics/           Fastify — events, KPIs, dashboards
  sav/                 Fastify — tickets, diagnostic, devis, planning
packages/
  database/            Prisma schema + client (multi-schema PostgreSQL)
  shared/              Types partages, RBAC, permissions
  ui/                  Composants UI partages
scripts/               Seed, crawl, utilitaires
infra/                 Caddyfile, Prometheus, scripts deploy
tests/
  load/                Tests de charge (autocannon)
```

## Commandes principales

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Lance tous les services en mode dev (turbo) |
| `pnpm build` | Build complet (tous les packages) |
| `pnpm lint` | TypeScript type-check (tsc --noEmit) |
| `pnpm test` | Tests unitaires (vitest) |
| `pnpm test:smoke` | Smoke tests rapides (authz + routes) |
| `pnpm test:integration` | Tests d'integration (Fastify inject) |
| `pnpm test:watch` | Tests en mode watch |
| `pnpm db:push` | Appliquer le schema Prisma sur la DB |
| `pnpm db:migrate` | Creer une migration Prisma |
| `pnpm db:studio` | Ouvrir Prisma Studio (GUI base de donnees) |
| `pnpm db:seed:demo` | Charger les donnees de demo (6 scenarios) |
| `pnpm --filter @trottistore/web test:e2e` | Tests E2E Playwright |

## API Endpoints (principaux)

### Ecommerce (:3001)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/v1/auth/register | Inscription |
| POST | /api/v1/auth/login | Connexion (JWT + refresh cookie) |
| POST | /api/v1/auth/refresh | Rotation de token |
| GET | /api/v1/auth/me | Profil utilisateur connecte |
| GET | /api/v1/products | Catalogue produits (filtre, pagination) |
| GET | /api/v1/products/:slug | Detail produit |
| GET | /api/v1/categories | Arbre des categories |
| GET/POST | /api/v1/cart | Panier (Redis-backed) |
| POST | /api/v1/orders | Creer une commande |
| GET | /api/v1/orders | Lister ses commandes |
| POST | /api/v1/stock/movements | Enregistrer un mouvement de stock |
| GET | /api/v1/stock/alerts | Alertes stock bas |
| PUT | /api/v1/admin/products/:id/stock | Mise a jour stock admin |

### CRM (:3002)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/v1/customers | Liste clients (filtre fidelite, tags) |
| GET | /api/v1/customers/:id | Profil 360 (commandes, interactions) |
| POST | /api/v1/customers/:id/loyalty/add | Ajouter des points fidelite |
| POST | /api/v1/campaigns | Creer une campagne email |
| POST | /api/v1/campaigns/:id/send | Envoyer une campagne |

### SAV (:3004)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/v1/repairs | Creer un ticket SAV (guest ou connecte) |
| GET | /api/v1/repairs | Lister les tickets (filtre statut, technicien) |
| GET | /api/v1/repairs/:id | Detail ticket + journal activite |
| PUT | /api/v1/repairs/:id/status | Changer le statut (machine a etats) |
| POST | /api/v1/repairs/:id/diagnosis | Ajouter un diagnostic |
| POST | /api/v1/repairs/:id/quote | Generer un devis |
| POST | /api/v1/repairs/:id/parts | Ajouter une piece utilisee |
| GET | /api/v1/repairs/tracking/:token | Suivi public (sans login) |
| GET | /api/v1/appointments/slots | Creneaux disponibles |
| POST | /api/v1/appointments | Reserver un RDV |

### Analytics (:3003)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/v1/analytics/realtime | KPIs temps reel (CA, SAV, stock) |
| GET | /api/v1/analytics/kpis | KPIs agreges (7d/30d/90d/365d) |
| GET | /api/v1/analytics/sales | Ventes par jour/methode paiement |
| GET | /api/v1/analytics/customers | Retention, churn, LTV |
| GET | /api/v1/analytics/stock | Alertes stock, rotation |
| POST | /api/v1/analytics/events | Ingestion batch d'events |

## Pipeline SAV (machine a etats)

```
RECU -> DIAGNOSTIC -> DEVIS_ENVOYE -> DEVIS_ACCEPTE -> EN_REPARATION -> PRET -> RECUPERE
                  \-> IRREPARABLE                          |
                                    \-> REFUS_CLIENT       v
                                                    EN_ATTENTE_PIECE
```

Chaque transition est validee par la state machine (`services/sav/src/utils/status-machine.ts`).
Un journal d'activite immutable (`RepairActivityLog`) trace chaque action.

## Auth & RBAC

Roles definis dans `packages/shared/src/auth.ts` :

| Role | Acces |
|------|-------|
| SUPERADMIN | Tout |
| ADMIN | Tout sauf gestion users |
| MANAGER | Produits, commandes, clients, tickets, analytics |
| TECHNICIAN | Ses tickets assignes uniquement + produits (lecture) |
| STAFF | Produits, commandes, clients, tickets (lecture/ecriture) |
| CLIENT | Ses propres donnees uniquement |

JWT access token (15min) + refresh token (30j) avec rotation.
Le middleware `requireRole()` et `requirePermission()` protege chaque route.

## Workflow multi-agent (Claude + Codex)

Convention stricte pour eviter les collisions :

- **1 ticket = 1 branche = 1 PR**
- Branches : `codex/<topic>` (convention obligatoire, hook pre-push)
- Worktrees isoles par agent (`pnpm agent:init`)
- Main gelee entre les merge batches
- Source de verite : Notion (PI-2weeks-TrottiStore)

```bash
# Creer un worktree pour un agent
pnpm agent:init codex sav-kanban origin/main

# Voir l'etat des worktrees
pnpm agent:status

# Installer les hooks pre-push
pnpm agent:hooks
```

Voir `docs/MULTI_AGENT_GIT.md` pour le detail.

## Feature Flags

Variables d'environnement pour activer/desactiver des features sans redeploy :

| Flag | Default | Description |
|------|---------|-------------|
| FEATURE_AUTO_NOTIFICATIONS | false | Email + SMS auto sur changement statut SAV |
| FEATURE_CHECKOUT_EXPRESS | false | Checkout Stripe (Apple Pay, Google Pay) |
| FEATURE_STORE_PICKUP | false | Retrait 1h en magasin |
| FEATURE_COCKPIT_V2 | true | Dashboard gerant enrichi |

## Tests

```bash
# Smoke tests (rapides, sans DB)
pnpm test:smoke

# Tests unitaires complets
pnpm test

# Tests d'integration (mock Prisma)
pnpm test:integration

# Tests E2E (Playwright, necessite le site lance)
pnpm --filter @trottistore/web test:e2e

# Tests de charge
pnpm test:load
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) :
- Lint (tsc --noEmit)
- Build complet
- Smoke tests
- Security audit (`pnpm audit --audit-level=high`)
- E2E Playwright (avec artifacts HTML)

## Documentation

| Fichier | Contenu |
|---------|---------|
| `ARCHITECTURE.md` | Architecture technique detaillee |
| `RELEASE_RUNBOOK.md` | Procedure de release et rollback |
| `TECHLEAD_AUDIT.md` | Resultats de l'audit technique |
| `docs/MULTI_AGENT_GIT.md` | Workflow multi-agent |
| `docs/FEATURE_URGENCE_SAV.md` | Spec feature urgence SAV |
| `docs/LOGGING.md` | Configuration logging |

## Environnement de dev

| Service | Port | URL |
|---------|------|-----|
| Web (Next.js) | 3000 | http://localhost:3000 |
| Ecommerce API | 3001 | http://localhost:3001/api/v1 |
| CRM API | 3002 | http://localhost:3002/api/v1 |
| Analytics API | 3003 | http://localhost:3003/api/v1 |
| SAV API | 3004 | http://localhost:3004/api/v1 |
| PostgreSQL | 5432 | postgresql://trottistore:dev_password@localhost:5432 |
| Redis | 6379 | redis://localhost:6379 |
| Mailpit (email) | 8025 | http://localhost:8025 |
| MinIO (console) | 9001 | http://localhost:9001 |

## Licence

Projet prive — TrottiStore SARL.
