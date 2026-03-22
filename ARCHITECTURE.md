# 🏗️ ARCHITECTURE TECHNIQUE — TrottiStore

> **Document d'architecture système complet**
> Version 1.0 — Mars 2026
> Auteur : Équipe TrottiStore
> Statut : Draft technique

---

## Table des matières

1. [Vue d'ensemble système](#1--vue-densemble-système)
2. [Stack technique détaillée](#2--stack-technique-détaillée)
3. [Schéma de base de données](#3--schéma-de-base-de-données)
4. [Modules métier détaillés](#4--modules-métier-détaillés)
5. [Auth & Sécurité](#5--auth--sécurité)
6. [Intégrations tierces](#6--intégrations-tierces)
7. [Plan de migration WooCommerce](#7--plan-de-migration-woocommerce)
8. [Estimation & Roadmap](#8--estimation--roadmap)
9. [ADRs (Architecture Decision Records)](#9--adrs-architecture-decision-records)
10. [Audit Open Source](#10--audit-open-source)

---

# 1 — Vue d'ensemble système

## 1.1 Contexte métier

TrottiStore est une boutique spécialisée dans les trottinettes électriques et pièces détachées, implantée au 18 bis Rue Méchin, 93450 L'Île-Saint-Denis. L'entreprise (TPE, 1-5 employés) opère actuellement sur un stack WooCommerce + Excel + processus papier qu'elle souhaite remplacer par une plateforme digitale intégrée et moderne.

**Périmètre fonctionnel :**
- E-commerce B2C (catalogue ~200 produits, ~50 commandes/jour cible)
- CRM client intégré (profil 360°, fidélité, segmentation)
- Analytics temps réel et batch (KPIs métier, dashboards)
- SAV et gestion d'atelier (tickets, diagnostic, planning)
- Comptabilité & facturation (⏸️ reporté phase ultérieure)

## 1.2 Diagramme d'architecture global

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COUCHE PRÉSENTATION                              │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   Storefront     │  │   Back-office    │  │   App Mobile (PWA)   │  │
│  │   Next.js 15     │  │   Next.js 15     │  │   Next.js 15 + SW   │  │
│  │   App Router     │  │   /admin routes  │  │   (future phase)     │  │
│  │   SSR + ISR      │  │   RSC + Client   │  │                      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│           │                     │                        │              │
└───────────┼─────────────────────┼────────────────────────┼──────────────┘
            │                     │                        │
            ▼                     ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (Caddy)                             │
│                                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Rate Limit  │  │ TLS Termina- │  │  Routing   │  │   CORS /     │  │
│  │ (per IP +   │  │ tion (auto   │  │  /api/v1/* │  │   Headers    │  │
│  │  per user)  │  │ Let's Encr.) │  │  → services│  │   Security   │  │
│  └─────────────┘  └──────────────┘  └────────────┘  └──────────────┘  │
│                                                                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────────┐
            │                  │                      │
            ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     COUCHE SERVICES MÉTIER                              │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Service    │  │  Service    │  │  Service    │  │  Service    │  │
│  │  E-COMMERCE │  │  CRM        │  │  ANALYTICS  │  │  SAV        │  │
│  │             │  │             │  │             │  │             │  │
│  │  Fastify    │  │  Fastify    │  │  Fastify    │  │  Fastify    │  │
│  │  :3001      │  │  :3002      │  │  :3003      │  │  :3004      │  │
│  │             │  │             │  │             │  │             │  │
│  │ - Catalogue │  │ - Profils   │  │ - Events    │  │ - Tickets   │  │
│  │ - Commandes │  │ - Segments  │  │ - Dashboards│  │ - Diagnos.  │  │
│  │ - Panier    │  │ - Fidélité  │  │ - Reports   │  │ - Devis     │  │
│  │ - Paiements │  │ - Campagnes │  │ - Alertes   │  │ - Planning  │  │
│  │ - Stock     │  │ - Timeline  │  │ - Exports   │  │ - Pièces    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │                │          │
│  ┌──────┴────────────────┴────────────────┴────────────────┴──────┐   │
│  │                    MESSAGE BUS (Redis + BullMQ)                 │   │
│  │                                                                 │   │
│  │  Events :  order.created │ customer.updated │ ticket.opened     │   │
│  │            payment.confirmed │ stock.low │ review.posted        │   │
│  │            campaign.sent │ kpi.threshold │ sav.completed        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                     COUCHE DONNÉES                                      │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ PostgreSQL  │  │   Redis 7   │  │ ClickHouse  │  │   MinIO     │  │
│  │    16       │  │             │  │             │  │             │  │
│  │             │  │ - Cache L1  │  │ - Events    │  │ - Images    │  │
│  │ - ecommerce│  │ - Sessions  │  │ - Page views│  │ - Documents │  │
│  │ - crm      │  │ - Rate lim. │  │ - Convers.  │  │ - Factures  │  │
│  │ - sav      │  │ - Pub/Sub   │  │ - KPI batch │  │ - Exports   │  │
│  │ - compta*  │  │ - BullMQ    │  │             │  │             │  │
│  │            │  │   queues    │  │             │  │             │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                                         │
│  * schéma compta provisionné mais non implémenté (phase ultérieure)     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                     COUCHE INFRASTRUCTURE                               │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Hetzner   │  │  GitHub     │  │  Grafana    │  │  Backups    │  │
│  │   VPS       │  │  Actions    │  │  Stack      │  │             │  │
│  │             │  │             │  │             │  │ - pg_dump   │  │
│  │ - Docker    │  │ - CI/CD     │  │ - Metrics   │  │   daily     │  │
│  │ - Compose   │  │ - Tests     │  │ - Logs      │  │ - Rétention │  │
│  │ - Caddy     │  │ - Deploy    │  │ - Alertes   │  │   30 jours  │  │
│  │             │  │ - Secrets   │  │ - Uptime    │  │ - Off-site  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 1.3 Principes architecturaux

### Pourquoi les microservices pour une TPE ?

Le choix d'une architecture microservices pour une structure de 1-5 employés mérite une justification approfondie, car il va à contre-courant des recommandations habituelles (monolithe d'abord).

**Justification en 5 points :**

1. **Découplage fonctionnel naturel** — Les domaines métier de TrottiStore (e-commerce, CRM, analytics, SAV) ont des cycles de vie très différents. Le catalogue produit évolue rarement, tandis que le CRM et les analytics sont en itération constante. Le découplage permet de déployer le CRM sans toucher au tunnel de commande.

2. **Scalabilité ciblée** — Le service analytics (ClickHouse + agrégations) a des besoins en ressources très différents du service e-commerce (I/O PostgreSQL). Le scaling indépendant évite de surdimensionner l'ensemble pour un seul domaine.

3. **Résilience** — Si le service analytics crashe, le tunnel de commande continue de fonctionner. Dans un monolithe, un OOM sur un rapport tuerait le checkout.

4. **Déploiement isolé** — Un bug introduit dans le module SAV peut être rollback sans affecter le e-commerce. Avec 1-5 personnes, chaque déploiement est un risque, et l'isolation le minimise.

5. **Préparation à la croissance** — TrottiStore ambitionne de croître. Partir sur des microservices dès le début évite une migration coûteuse monolithe → microservices plus tard.

**Garde-fous pour éviter la complexité excessive :**

- **Monorepo** : Tous les services vivent dans un seul dépôt Git (Turborepo), partageant types TypeScript, schémas Prisma et utilitaires.
- **Docker Compose unique** : En dev et staging, un seul `docker-compose.yml` orchestre tout. Pas de Kubernetes.
- **Communication synchrone interne** : Les services se parlent directement via HTTP interne pour les requêtes synchrones (pas de service mesh).
- **Asynchrone via Redis** : Seuls les événements fire-and-forget passent par BullMQ (pas de message broker lourd type Kafka).
- **Un seul PostgreSQL** : Les services partagent le même serveur PostgreSQL mais avec des schémas logiques séparés. Un seul backup, un seul monitoring.

### Principes transversaux

| Principe | Mise en œuvre |
|---|---|
| **API-first** | Contrats OpenAPI 3.1 rédigés avant le code, générés en types TypeScript |
| **Event-driven** | Chaque mutation métier émet un événement Redis Pub/Sub consommé de façon asynchrone |
| **Immutable infra** | Déploiement via images Docker tagguées, jamais de modification in-place |
| **Observability** | Chaque service expose `/health`, `/metrics` (Prometheus), logs structurés JSON |
| **Least privilege** | Chaque service a un user PostgreSQL dédié avec accès limité à son schéma |
| **Fail-safe defaults** | Rate limiting, CORS strict, CSP headers, input validation Zod sur chaque endpoint |
| **Convention over configuration** | Structure de projet standardisée, nommage uniforme, hooks Git partagés |

## 1.4 Environnements

### Développement (local)

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: trottistore_dev
      POSTGRES_USER: trottistore
      POSTGRES_PASSWORD: dev_password

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  clickhouse:
    image: clickhouse/clickhouse-server:24.3
    ports: ["8123:8123", "9000:9000"]

  minio:
    image: minio/minio:latest
    ports: ["9001:9001", "9002:9002"]
    command: server /data --console-address ":9002"

  mailpit:  # Mock SMTP pour dev
    image: axllent/mailpit:latest
    ports: ["1025:1025", "8025:8025"]

  # Services métier lancés via turbo dev (hot reload natif)
```

**Outils développeur :**
- `turbo dev` : Lance tous les services en parallèle avec hot reload
- `prisma studio` : Interface visuelle BDD
- `mailpit` : Visualisation des emails envoyés
- MinIO Console : Gestion des fichiers uploadés

### Staging (VPS Hetzner — CX21)

```
Specs : 2 vCPU, 4 Go RAM, 40 Go SSD — ~5€/mois
OS    : Ubuntu 22.04 LTS
Stack : Docker Compose + Caddy
URL   : staging.trottistore.fr
```

- Déploiement automatique sur push `develop`
- BDD seedée avec données anonymisées de production
- Accès restreint par IP ou Basic Auth

### Production (VPS Hetzner — CX31)

```
Specs : 4 vCPU, 8 Go RAM, 80 Go SSD — ~12€/mois
OS    : Ubuntu 22.04 LTS
Stack : Docker Compose + Caddy
URL   : trottistore.fr / api.trottistore.fr
```

- Déploiement manuel déclenché via GitHub Actions (tag `v*`)
- Backups PostgreSQL quotidiens (pg_dump → MinIO → off-site)
- Monitoring Grafana + alertes Slack/email
- TLS automatique via Caddy + Let's Encrypt

## 1.5 Communication inter-services

```
┌──────────────┐                    ┌──────────────┐
│  Service A   │───── HTTP GET ────▶│  Service B   │
│  (ecommerce) │◀─── JSON resp ────│  (crm)       │
└──────┬───────┘                    └──────────────┘
       │
       │ Événement asynchrone
       ▼
┌──────────────────────────────────────────────────┐
│              Redis Pub/Sub + BullMQ              │
│                                                  │
│  Channel: order.created                          │
│  Payload: { orderId, customerId, total, items }  │
│                                                  │
│  Consumers:                                      │
│  - CRM Service    → maj profil client            │
│  - Analytics Svc  → enregistrement conversion    │
│  - Notification   → email confirmation           │
└──────────────────────────────────────────────────┘
```

**Règles de communication :**

| Pattern | Usage | Exemple |
|---|---|---|
| **Sync HTTP** | Lecture de données cross-service | E-commerce lit le profil CRM pour afficher le nom |
| **Async event** | Notification de mutation | `order.created` déclenche l'email + la mise à jour CRM |
| **Async job** | Tâche longue ou différée | Génération de rapport PDF, envoi campagne email |

**Contrat d'événement (TypeScript) :**

```typescript
// packages/events/src/types.ts
interface DomainEvent<T = unknown> {
  id: string;           // UUID v7
  type: string;         // "order.created"
  source: string;       // "service-ecommerce"
  timestamp: string;    // ISO 8601
  version: number;      // 1
  data: T;
  metadata: {
    correlationId: string;
    causationId?: string;
    userId?: string;
  };
}

// Événements spécifiques
interface OrderCreatedEvent extends DomainEvent<{
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  total: number;
  currency: 'EUR';
}> {
  type: 'order.created';
}
```

---

# 2 — Stack technique détaillée

## 2.1 Vue synthétique

| Couche | Choix | Version | Rôle |
|---|---|---|---|
| Frontend SSR | Next.js | 15 (App Router) | Storefront + Back-office |
| Runtime JS | Node.js | 22 LTS | Tous les services |
| Backend API | Fastify | 5.x | Framework HTTP par service |
| ORM | Prisma | 6.x | Accès BDD typé |
| BDD principale | PostgreSQL | 16 | Données transactionnelles |
| Cache / Queue | Redis | 7 | Cache, sessions, BullMQ |
| Analytics DB | ClickHouse | 24.x | Stockage événements analytics |
| Object Storage | MinIO | Latest | Images, documents, exports |
| Reverse Proxy | Caddy | 2.x | TLS, routing, rate limiting |
| CI/CD | GitHub Actions | — | Build, test, déploiement |
| Monitoring | Grafana + Prometheus + Loki | — | Métriques, logs, alertes |
| Email | Brevo | — | Transactionnel + marketing |
| SMS | Twilio | — | Notifications SAV |
| Monorepo | Turborepo | 2.x | Orchestration builds |

## 2.2 Choix détaillés et justifications

### 2.2.1 Frontend SSR — Next.js 15 App Router

**Choix : Next.js 15 avec App Router**

| Critère | Next.js 15 ✅ | Nuxt 3 ❌ | Remix ❌ |
|---|---|---|---|
| **Écosystème** | Le plus large en React | Vue.js (plus petit) | React mais plus jeune |
| **SSR / ISR** | Natif, mature, flexible | Bon mais moins de docs | Bon mais pas d'ISR natif |
| **App Router** | RSC (React Server Components) | Pas d'équivalent | Loaders (différent) |
| **SEO** | Metadata API native | Bon via useHead | Bon via meta exports |
| **Communauté** | 120k+ GitHub stars | 55k stars | 30k stars |
| **Déploiement** | Self-host Docker facile | Self-host OK | Self-host OK |
| **TypeScript** | First-class | Bon | Bon |

**Pourquoi pas Nuxt 3 ?** Vue.js a un écosystème plus restreint côté composants UI et bibliothèques. L'équipe maîtrise React. Nuxt est excellent mais ne justifie pas un changement de paradigme.

**Pourquoi pas Remix ?** Remix est un très bon framework mais son écosystème est plus jeune, la documentation moins fournie, et l'ISR (Incremental Static Regeneration) n'est pas native — essentiel pour un catalogue e-commerce où les pages produits doivent être pré-rendues mais régulièrement rafraîchies.

**Architecture Next.js :**

```
apps/
  web/                    # Storefront client
    src/
      app/
        (shop)/           # Route group vitrine
          page.tsx        # Homepage
          produits/
            [slug]/
              page.tsx    # Fiche produit (ISR 60s)
          panier/
            page.tsx      # Panier (client-side)
          checkout/
            page.tsx      # Tunnel de commande
        (admin)/          # Route group back-office
          admin/
            dashboard/
            commandes/
            produits/
            clients/
            sav/
            analytics/
        api/              # BFF (Backend for Frontend)
          auth/
          webhooks/
      components/
        ui/               # Design system (Radix + Tailwind)
        shop/             # Composants e-commerce
        admin/            # Composants back-office
      lib/
        api-client.ts     # Client typé vers les microservices
        auth.ts           # NextAuth.js config
```

### 2.2.2 Back-office — Next.js Route Groups

**Choix : Intégré dans Next.js via route group `(admin)`**

| Critère | Route group intégré ✅ | SPA séparée (Vite) ❌ | Refine ❌ |
|---|---|---|---|
| **Partage de code** | 100% partagé | Duplication types/utils | Partiel |
| **Déploiement** | Un seul build | Deux builds séparés | Un build |
| **Auth** | NextAuth partagé | Auth dupliquée | Auth intégrée mais rigide |
| **Complexité ops** | 1 service | 2 services | 1 service |
| **SEO** | SSR possible | SPA = pas de SEO | SPA |
| **Flexibilité UI** | Totale | Totale | Contrainte par Refine |

**Pourquoi pas une SPA séparée ?** Créer une application Vite séparée pour le back-office signifie dupliquer la configuration auth, les types TypeScript, les utilitaires. Pour une TPE avec 1 développeur, la maintenance de deux frontends est un surcoût injustifié.

**Pourquoi pas Refine ?** Refine est un excellent framework d'admin, mais il impose sa propre structure, son routage, ses conventions. Pour un projet où le back-office doit être fortement personnalisé (dashboards analytics, interface SAV), la rigidité de Refine devient un frein.

### 2.2.3 Backend API — Fastify

**Choix : Fastify 5.x**

| Critère | Fastify ✅ | Express ❌ | NestJS ❌ |
|---|---|---|---|
| **Performance** | ~75k req/s | ~15k req/s | ~30k req/s |
| **Validation** | JSON Schema natif (+ Zod) | Middleware à ajouter | class-validator |
| **TypeScript** | First-class, types génériques | Types ajoutés | Natif |
| **Plugin system** | Encapsulé, prévisible | Middleware global | Modules DI |
| **Overhead** | Minimal | Minimal | Lourd (DI, decorators) |
| **Sérialisation** | fast-json-stringify (2x plus rapide) | JSON.stringify | JSON.stringify |
| **Taille bundle** | ~2 Mo node_modules | ~1 Mo | ~50 Mo |
| **Learning curve** | Modérée | Facile | Complexe (Angular-like) |

**Pourquoi pas Express ?** Express est le framework le plus populaire mais aussi le plus lent. Sa gestion asynchrone est sujette à des fuites mémoire sans handling explicite. Pour des microservices qui doivent être légers et performants, Fastify est 5x plus rapide à charge équivalente.

**Pourquoi pas NestJS ?** NestJS apporte une architecture opinionnée (modules, DI, decorators) inspirée d'Angular. C'est excellent pour une grande équipe qui a besoin de conventions fortes, mais c'est un overhead considérable pour une TPE. Le système de dependency injection ajoute de la complexité sans bénéfice proportionnel quand une seule personne développe.

**Structure d'un service Fastify :**

```
services/
  ecommerce/
    src/
      index.ts              # Point d'entrée, config Fastify
      plugins/
        prisma.ts           # Plugin Prisma (décorateur Fastify)
        redis.ts            # Plugin Redis
        auth.ts             # Plugin vérification JWT
      routes/
        products/
          index.ts          # GET /products, POST /products
          [id].ts           # GET /products/:id, PATCH, DELETE
          schemas.ts        # JSON Schemas (validation + sérialisation)
        orders/
          index.ts
          [id].ts
          schemas.ts
        payments/
          index.ts
          webhooks.ts       # Webhooks Stripe
      services/
        product.service.ts  # Logique métier
        order.service.ts
        payment.service.ts
      events/
        publishers.ts       # Émission d'événements
        consumers.ts        # Consommation d'événements
      prisma/
        schema.prisma       # Schéma spécifique au service
    Dockerfile
    package.json
```

### 2.2.4 ORM — Prisma

**Choix : Prisma 6.x**

| Critère | Prisma ✅ | TypeORM ❌ | Drizzle ❌ |
|---|---|---|---|
| **Type safety** | Génération client typé à 100% | Decorators, types partiels | Bon, inférence TS |
| **Migrations** | `prisma migrate` (déclaratif) | `typeorm migration` (impératif) | `drizzle-kit` (déclaratif) |
| **DX** | Prisma Studio, introspection | Pas d'outil visuel | Pas d'outil visuel |
| **Relations** | Déclaratif dans le schéma | Decorators sur les entités | SQL-like |
| **Raw SQL** | `$queryRaw` quand nécessaire | QueryBuilder | SQL natif partout |
| **Maturité** | Production-ready, 35k+ stars | Mature mais plus de mainteneur actif | Jeune mais prometteur |
| **Multi-schema** | Supporté via `@@schema` | Supporté | Supporté |

**Pourquoi pas TypeORM ?** TypeORM souffre d'un manque de maintenance active. Les decorators TypeScript sont en évolution (TC39 stage 3), et TypeORM dépend de `reflect-metadata` qui pose des problèmes de compatibilité. Les types générés sont partiels, nécessitant des `as` casts fréquents.

**Pourquoi pas Drizzle ?** Drizzle est excellent et très performant (proche du SQL brut), mais c'est un projet plus jeune avec moins de documentation et un écosystème plus limité. Pour un projet qui doit être maintenu par une personne, la maturité de Prisma (studio, migrations, introspection) est un avantage concret.

### 2.2.5 Base de données principale — PostgreSQL 16

**Choix : PostgreSQL 16**

| Critère | PostgreSQL 16 ✅ | MySQL 8 ❌ | MongoDB 7 ❌ |
|---|---|---|---|
| **Types avancés** | JSONB, arrays, enums, ranges | JSON limité | Document natif |
| **Full-text search** | `tsvector` + `ts_rank` natif | FULLTEXT limité | Atlas Search (cloud) |
| **Transactions** | ACID complet, SERIALIZABLE | ACID avec InnoDB | Multi-doc (limité) |
| **Extensions** | pg_trgm, uuid-ossp, pgcrypto | Limité | Pas d'extensions |
| **Partitioning** | Natif (range, list, hash) | Natif | Sharding auto |
| **Schémas logiques** | `CREATE SCHEMA` (multi-tenant) | Pas de schémas | Databases séparées |
| **Standards SQL** | SQL:2023 conforme | Variantes MySQL | Pas SQL |
| **Coût** | Open source | Open source | Cloud payant pour features |

**Pourquoi pas MySQL ?** MySQL est performant en lecture mais inférieur en fonctionnalités. L'absence de types JSONB performants, de schémas logiques (essentiels pour notre approche multi-services), et de full-text search avancé en font un choix moins adapté.

**Pourquoi pas MongoDB ?** Un e-commerce a des relations fortes : un produit a des catégories, des variantes, des avis ; une commande a des lignes, un client, des paiements. MongoDB excelle pour les documents isolés mais nécessite des workarounds (lookups, denormalization) pour les relations. De plus, la conformité FEC (Fichier des Écritures Comptables) exige des transactions ACID strictes.

**Configuration PostgreSQL optimisée :**

```sql
-- postgresql.conf (ajustements pour VPS 8 Go RAM)
shared_buffers = '2GB'               -- 25% de la RAM
effective_cache_size = '6GB'          -- 75% de la RAM
work_mem = '32MB'                     -- Par opération de tri
maintenance_work_mem = '512MB'        -- VACUUM, CREATE INDEX
wal_buffers = '64MB'
max_connections = 100
random_page_cost = 1.1                -- SSD
effective_io_concurrency = 200        -- SSD

-- Extensions activées
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Recherche floue
CREATE EXTENSION IF NOT EXISTS "unaccent";     -- Recherche sans accents
```

### 2.2.6 Cache & Queue — Redis 7 + BullMQ

**Choix : Redis 7 + BullMQ**

| Critère | Redis + BullMQ ✅ | RabbitMQ ❌ | Kafka ❌ |
|---|---|---|---|
| **Simplicité** | Un seul service pour cache + queue | Service dédié queue | Service dédié + ZooKeeper |
| **RAM** | ~50 Mo pour notre usage | ~200 Mo | ~500 Mo minimum |
| **Latence** | <1ms | <5ms | <10ms |
| **Fonctionnalités** | Cache + Pub/Sub + Queue + Rate limit | Queue uniquement | Stream + queue |
| **Ops** | 1 conteneur Docker | 1 conteneur + management | 3+ conteneurs |
| **DX (Node.js)** | ioredis + BullMQ (excellent) | amqplib (correct) | kafkajs (complexe) |

**Pourquoi pas RabbitMQ ?** RabbitMQ est un excellent message broker, mais il ne fait que du messaging. Redis fait du caching, du pub/sub, du rate limiting, des sessions, ET du queuing via BullMQ — le tout dans un seul processus. Pour une TPE, réduire le nombre de services à opérer est critique.

**Usages Redis dans TrottiStore :**

```
Redis Instance (une seule, ~50 Mo RAM)
│
├── Cache (TTL-based)
│   ├── cache:product:{id}          → JSON produit (TTL 5min)
│   ├── cache:category:{slug}       → Liste produits (TTL 2min)
│   ├── cache:homepage              → Données homepage (TTL 1min)
│   └── cache:kpi:daily             → KPIs agrégés (TTL 30s)
│
├── Sessions
│   └── session:{userId}            → Refresh token + metadata
│
├── Rate Limiting
│   ├── ratelimit:ip:{ip}           → Compteur (TTL 1min)
│   └── ratelimit:user:{userId}     → Compteur (TTL 1min)
│
├── Pub/Sub (événements temps réel)
│   ├── events:order.*              → Événements commandes
│   ├── events:customer.*           → Événements clients
│   └── events:stock.*              → Alertes stock
│
└── BullMQ Queues
    ├── queue:email                  → Envoi emails (Brevo)
    ├── queue:sms                    → Envoi SMS (Twilio)
    ├── queue:analytics              → Ingestion ClickHouse batch
    ├── queue:report                 → Génération rapports PDF
    └── queue:image                  → Redimensionnement images
```

### 2.2.7 Analytics — ClickHouse

**Choix : ClickHouse**

| Critère | ClickHouse ✅ | TimescaleDB ❌ | PostgreSQL seul ❌ |
|---|---|---|---|
| **Requêtes agrégation** | 10-100x plus rapide | 2-5x plus rapide | Référence |
| **Compression** | ~10:1 sur les données analytics | ~5:1 | ~3:1 |
| **Ingestion** | 500k+ lignes/s | 100k lignes/s | 10k lignes/s |
| **Stockage** | Colonnes (parfait pour analytics) | Lignes + chunks | Lignes |
| **Complexité** | Service séparé | Extension PostgreSQL | Zéro overhead |
| **RAM min** | 512 Mo | 256 Mo | 0 (partagé) |

**Pourquoi pas TimescaleDB ?** TimescaleDB est une extension PostgreSQL, ce qui simplifie l'ops. Cependant, pour des requêtes de type "nombre de pages vues par jour sur 90 jours groupées par source", ClickHouse est 10 à 100 fois plus rapide grâce à son stockage en colonnes et sa compression.

**Pourquoi pas PostgreSQL seul ?** Stocker les événements analytics (page views, clics, conversions) dans PostgreSQL fonctionne pour un petit volume, mais pollue la BDD transactionnelle et dégrade les performances des requêtes métier. La séparation des concerns (OLTP vs OLAP) est un principe architectural sain.

### 2.2.8 Object Storage — MinIO

**Choix : MinIO**

| Critère | MinIO ✅ | AWS S3 ❌ | Filesystem local ❌ |
|---|---|---|---|
| **Compatibilité S3** | 100% compatible | Natif | Pas compatible |
| **Auto-hébergé** | Oui | Non (cloud) | N/A |
| **Coût** | 0€ (self-hosted) | ~0.023$/Go/mois | 0€ |
| **Migration** | Transparent vers S3 | — | Réécriture nécessaire |
| **Backup** | Réplication, versioning | Natif | Manuel |
| **CDN** | Via Caddy reverse proxy | CloudFront | Via Caddy |

**Pourquoi pas S3 directement ?** S3 ajouterait une dépendance cloud et un coût récurrent. MinIO est 100% compatible S3 API, donc si TrottiStore migre un jour vers AWS, le changement se résume à modifier l'endpoint dans la configuration.

**Pourquoi pas le filesystem local ?** Les fichiers sur le disque ne sont pas accessibles depuis d'autres conteneurs Docker, ne supportent pas le versioning, et rendent les backups plus complexes. MinIO offre une abstraction propre avec une API standard.

### 2.2.9 Reverse Proxy — Caddy

**Choix : Caddy 2.x**

| Critère | Caddy ✅ | Nginx ❌ | Traefik ❌ |
|---|---|---|---|
| **TLS automatique** | Let's Encrypt natif, zero-config | Certbot + cron | Let's Encrypt natif |
| **Configuration** | Caddyfile (4 lignes suffisent) | nginx.conf (verbeux) | Labels Docker |
| **HTTP/3** | Natif | Module expérimental | Natif |
| **Performances** | Excellentes | Les meilleures | Bonnes |
| **Rechargement** | Hot reload natif | `nginx -s reload` | Hot reload |
| **Mémoire** | ~20 Mo | ~5 Mo | ~50 Mo |

**Pourquoi pas Nginx ?** Nginx est le standard de l'industrie et le plus performant en raw throughput. Cependant, la configuration est verbeuse, le TLS automatique nécessite Certbot, et le rechargement de config demande un `nginx -s reload`. Pour une TPE, la simplicité de Caddy (TLS auto, config lisible, hot reload) économise des heures de DevOps.

**Pourquoi pas Traefik ?** Traefik excelle dans les environnements Docker et Kubernetes avec sa découverte automatique via labels. Pour un déploiement Docker Compose statique (pas d'orchestrateur), cette feature n'apporte pas de valeur, et la configuration par labels Docker est moins lisible qu'un Caddyfile.

**Caddyfile production :**

```caddyfile
# /etc/caddy/Caddyfile

trottistore.fr {
    # Frontend Next.js
    reverse_proxy localhost:3000

    # Compression
    encode gzip zstd

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://placehold.co https://maps.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.trottistore.fr wss://api.trottistore.fr"
    }
}

api.trottistore.fr {
    # Rate limiting global
    rate_limit {
        zone api {
            key {remote_host}
            events 100
            window 1m
        }
    }

    # Routing vers microservices
    handle /api/v1/products/* {
        reverse_proxy localhost:3001
    }
    handle /api/v1/orders/* {
        reverse_proxy localhost:3001
    }
    handle /api/v1/customers/* {
        reverse_proxy localhost:3002
    }
    handle /api/v1/crm/* {
        reverse_proxy localhost:3002
    }
    handle /api/v1/analytics/* {
        reverse_proxy localhost:3003
    }
    handle /api/v1/sav/* {
        reverse_proxy localhost:3004
    }

    # WebSocket pour analytics temps réel
    handle /ws/* {
        reverse_proxy localhost:3003
    }

    # Security headers
    header {
        Access-Control-Allow-Origin "https://trottistore.fr"
        Access-Control-Allow-Methods "GET, POST, PATCH, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Authorization, Content-Type"
        Access-Control-Max-Age "86400"
    }
}

# MinIO (images produits, documents)
cdn.trottistore.fr {
    reverse_proxy localhost:9001

    header {
        Cache-Control "public, max-age=31536000, immutable"
        Access-Control-Allow-Origin "*"
    }
}
```

### 2.2.10 CI/CD — GitHub Actions

**Choix : GitHub Actions**

| Critère | GitHub Actions ✅ | GitLab CI ❌ | Jenkins ❌ |
|---|---|---|---|
| **Intégration Git** | Native (même plateforme) | Native (GitLab) | Plugin Git |
| **Coût** | 2000 min/mois gratuit | 400 min/mois gratuit | Self-hosted (infra) |
| **Marketplace** | 15k+ actions disponibles | Registry limité | Plugins (qualité variable) |
| **Config** | YAML simple | YAML similaire | Groovy (complexe) |
| **Secrets** | Natif + Environments | Natif | Credential store |
| **Self-hosted runners** | Possible | Possible | Natif |

**Pourquoi pas GitLab CI ?** GitLab CI est excellent et offre plus de minutes gratuites pour les CI/CD complexes. Cependant, il faudrait soit migrer le repo vers GitLab, soit utiliser un miroir. Le code étant déjà sur GitHub, rester sur GitHub Actions évite la friction.

**Pipeline CI/CD :**

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx turbo lint typecheck

  test:
    needs: lint-and-type-check
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: [5432:5432]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npx turbo test -- --coverage
      - uses: codecov/codecov-action@v4

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: ghcr.io/trottistore/${{ matrix.service }}:${{ github.sha }}
    strategy:
      matrix:
        service: [web, ecommerce, crm, analytics, sav]

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: deploy
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /opt/trottistore
            docker compose pull
            docker compose up -d --remove-orphans

  deploy-production:
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: deploy
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /opt/trottistore
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --remove-orphans
            docker compose -f docker-compose.prod.yml exec web npx prisma migrate deploy
```

### 2.2.11 Observabilité — Grafana Stack

**Choix : Grafana + Prometheus + Loki**

| Critère | Grafana Stack ✅ | Datadog ❌ | ELK Stack ❌ |
|---|---|---|---|
| **Coût** | 0€ (self-hosted) | ~15$/host/mois | 0€ (self-hosted) mais lourd |
| **Métriques** | Prometheus (standard) | Agent propriétaire | Pas natif (ajout Metricbeat) |
| **Logs** | Loki (léger, label-based) | Log management | Elasticsearch (lourd, ~2 Go RAM) |
| **Dashboards** | Grafana (le standard) | Interface propriétaire | Kibana |
| **Alertes** | Grafana Alerting | Monitors | ElastAlert |
| **RAM totale** | ~300 Mo | Agent: ~100 Mo | ~4 Go minimum |

**Pourquoi pas Datadog ?** Datadog est la Rolls-Royce de l'observabilité, mais son coût (~15$/host/mois pour Infrastructure, ~15$/host/mois pour APM) est disproportionné pour une TPE. Pour ~0€, Grafana + Prometheus + Loki couvrent 95% des besoins.

### 2.2.12 Email — Brevo (ex-Sendinblue)

**Choix : Brevo**

| Critère | Brevo ✅ | Resend ❌ | Mailgun ❌ |
|---|---|---|---|
| **Offre gratuite** | 300 emails/jour | 100 emails/jour | 100 emails/jour |
| **Marketing** | Campaigns + automation intégrés | Transactionnel uniquement | Transactionnel + basic marketing |
| **Conformité FR** | Hébergement FR, RGPD natif | US-based | US-based |
| **SMS** | Intégré (mais Twilio préféré) | Non | Non |
| **Prix (10k/mois)** | ~25€ | ~20€ | ~35€ |
| **Templates** | Éditeur drag-and-drop | Code HTML | Code HTML |

**Pourquoi Brevo ?** Brevo est une entreprise française (Paris), ce qui garantit un hébergement conforme RGPD sans transfert hors UE. L'offre gratuite de 300 emails/jour couvre largement les besoins initiaux de TrottiStore. De plus, Brevo intègre du marketing automation (séquences, segmentation), évitant un outil supplémentaire.

### 2.2.13 SMS — Twilio

**Choix : Twilio**

| Critère | Twilio ✅ | OVH SMS ❌ | Vonage ❌ |
|---|---|---|---|
| **API** | REST + SDK Node.js mature | REST basique | REST + SDK |
| **Fiabilité** | 99.95% SLA | Bon mais pas de SLA publié | 99.9% SLA |
| **Prix (France)** | ~0.06€/SMS | ~0.05€/SMS | ~0.07€/SMS |
| **Features** | SMS, WhatsApp, Voice, Verify | SMS uniquement | SMS, WhatsApp |
| **Webhook** | Delivery reports natifs | Polling | Delivery reports |
| **Documentation** | Excellente | Correcte | Bonne |

**Pourquoi Twilio ?** L'écosystème est le plus complet : SMS, WhatsApp Business API, vérification téléphone, tout via une seule API. OVH SMS est moins cher mais l'API est plus basique et ne supporte pas WhatsApp.

---

# 3 — Schéma de base de données

## 3.1 Organisation des schémas PostgreSQL

```sql
-- Chaque service possède son propre schéma PostgreSQL
-- Un seul serveur PostgreSQL, séparation logique

CREATE SCHEMA IF NOT EXISTS ecommerce;   -- Service E-commerce
CREATE SCHEMA IF NOT EXISTS crm;         -- Service CRM
CREATE SCHEMA IF NOT EXISTS sav;         -- Service SAV
CREATE SCHEMA IF NOT EXISTS compta;      -- Service Comptabilité (provisionné, non implémenté)
CREATE SCHEMA IF NOT EXISTS shared;      -- Tables partagées (auth, users)

-- Chaque service a un user PostgreSQL dédié
CREATE USER svc_ecommerce WITH PASSWORD 'xxx';
CREATE USER svc_crm WITH PASSWORD 'xxx';
CREATE USER svc_sav WITH PASSWORD 'xxx';
CREATE USER svc_compta WITH PASSWORD 'xxx';

GRANT USAGE ON SCHEMA ecommerce TO svc_ecommerce;
GRANT ALL ON ALL TABLES IN SCHEMA ecommerce TO svc_ecommerce;
GRANT USAGE ON SCHEMA shared TO svc_ecommerce;  -- Lecture seule sur shared
GRANT SELECT ON ALL TABLES IN SCHEMA shared TO svc_ecommerce;

-- Idem pour chaque service...
```

## 3.2 Domaine : Clients & Auth (schéma `shared`)

```sql
-- =============================================================
-- SCHÉMA SHARED : Auth & Utilisateurs
-- =============================================================

SET search_path TO shared;

-- Table principale des utilisateurs (auth + profil de base)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    email_verified  BOOLEAN DEFAULT FALSE,
    phone           VARCHAR(20),
    phone_verified  BOOLEAN DEFAULT FALSE,
    password_hash   VARCHAR(255),           -- bcrypt, NULL si OAuth uniquement
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    avatar_url      VARCHAR(500),
    role            VARCHAR(20) NOT NULL DEFAULT 'CLIENT'
                    CHECK (role IN ('SUPERADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'STAFF', 'CLIENT')),
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED')),
    last_login_at   TIMESTAMPTZ,
    login_count     INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}',     -- Données flexibles (préférences, etc.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_users_phone ON users (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_search ON users USING gin (
    (to_tsvector('french', first_name || ' ' || last_name || ' ' || email))
);

-- Tokens de rafraîchissement (refresh tokens)
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,  -- SHA-256 du token
    device_info     JSONB,                          -- User-Agent, IP, etc.
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at) WHERE revoked_at IS NULL;

-- Adresses (shipping / billing)
CREATE TABLE addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(10) NOT NULL CHECK (type IN ('SHIPPING', 'BILLING')),
    is_default      BOOLEAN DEFAULT FALSE,
    label           VARCHAR(50),            -- "Domicile", "Bureau", etc.
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    company         VARCHAR(200),
    line1           VARCHAR(255) NOT NULL,
    line2           VARCHAR(255),
    postal_code     VARCHAR(10) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    country         VARCHAR(2) NOT NULL DEFAULT 'FR',  -- ISO 3166-1 alpha-2
    phone           VARCHAR(20),
    instructions    TEXT,                    -- Instructions de livraison
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses (user_id);

-- Connexions OAuth (Google, Apple, etc.)
CREATE TABLE oauth_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        VARCHAR(20) NOT NULL,   -- 'google', 'apple', 'facebook'
    provider_id     VARCHAR(255) NOT NULL,
    access_token    VARCHAR(500),
    refresh_token   VARCHAR(500),
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(provider, provider_id)
);

CREATE INDEX idx_oauth_user ON oauth_accounts (user_id);

-- Journal d'audit (actions sensibles)
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(50) NOT NULL,   -- 'login', 'password_change', 'role_change', etc.
    entity_type     VARCHAR(50),            -- 'user', 'order', 'product'
    entity_id       UUID,
    ip_address      INET,
    user_agent      TEXT,
    details         JSONB,                  -- Détails spécifiques à l'action
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs (user_id);
CREATE INDEX idx_audit_action ON audit_logs (action);
CREATE INDEX idx_audit_created ON audit_logs (created_at);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);

-- Trigger de mise à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_addresses_updated BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## 3.3 Domaine : Catalogue (schéma `ecommerce`)

```sql
-- =============================================================
-- SCHÉMA ECOMMERCE : Catalogue produits
-- =============================================================

SET search_path TO ecommerce;

-- Catégories (arbre via parent_id)
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT,
    image_url       VARCHAR(500),
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    seo_title       VARCHAR(200),
    seo_description VARCHAR(500),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories (parent_id);
CREATE INDEX idx_categories_slug ON categories (slug);
CREATE INDEX idx_categories_active ON categories (is_active);

-- Marques
CREATE TABLE brands (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(200) NOT NULL UNIQUE,
    logo_url        VARCHAR(500),
    website_url     VARCHAR(500),
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brands_slug ON brands (slug);

-- Produits
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID REFERENCES brands(id) ON DELETE SET NULL,
    sku             VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(300) NOT NULL,
    slug            VARCHAR(300) NOT NULL UNIQUE,
    short_desc      VARCHAR(500),
    description     TEXT,
    price_ht        NUMERIC(10,2) NOT NULL,     -- Prix hors taxes en EUR
    price_ttc       NUMERIC(10,2) NOT NULL,     -- Prix TTC calculé
    tva_rate        NUMERIC(5,2) NOT NULL DEFAULT 20.00,  -- Taux TVA (%)
    compare_price   NUMERIC(10,2),              -- Ancien prix (barré)
    cost_price      NUMERIC(10,2),              -- Prix d'achat
    weight_grams    INTEGER,                    -- Poids en grammes
    stock_quantity  INTEGER NOT NULL DEFAULT 0,
    stock_alert     INTEGER DEFAULT 5,          -- Seuil alerte stock bas
    is_active       BOOLEAN DEFAULT TRUE,
    is_featured     BOOLEAN DEFAULT FALSE,
    is_on_sale      BOOLEAN DEFAULT FALSE,

    -- Specs techniques (trottinettes)
    specs           JSONB DEFAULT '{}',
    /*
    Exemple specs :
    {
        "voltage": "60V",
        "battery_capacity": "18.2Ah",
        "range_km": 60,
        "max_speed_kmh": 70,
        "motor_power_w": 3000,
        "weight_kg": 25,
        "max_load_kg": 120,
        "wheel_size_inches": 10,
        "suspension": "double hydraulique",
        "brakes": "disques hydrauliques",
        "folded_dimensions": "120x25x45 cm",
        "ip_rating": "IPX5"
    }
    */

    -- SEO
    seo_title       VARCHAR(200),
    seo_description VARCHAR(500),

    -- Compteurs (dénormalisés pour performance)
    review_count    INTEGER DEFAULT 0,
    review_avg      NUMERIC(3,2) DEFAULT 0,
    sold_count      INTEGER DEFAULT 0,
    view_count      INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_brand ON products (brand_id);
CREATE INDEX idx_products_slug ON products (slug);
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_products_active ON products (is_active);
CREATE INDEX idx_products_featured ON products (is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_products_sale ON products (is_on_sale) WHERE is_on_sale = TRUE;
CREATE INDEX idx_products_price ON products (price_ttc);
CREATE INDEX idx_products_stock ON products (stock_quantity) WHERE stock_quantity <= 5;
CREATE INDEX idx_products_search ON products USING gin (
    (to_tsvector('french', name || ' ' || COALESCE(short_desc, '') || ' ' || COALESCE(description, '')))
);
CREATE INDEX idx_products_specs ON products USING gin (specs);

-- Relation produits ↔ catégories (many-to-many)
CREATE TABLE product_categories (
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    is_primary      BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (product_id, category_id)
);

-- Images produits
CREATE TABLE product_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url             VARCHAR(500) NOT NULL,
    alt_text        VARCHAR(300),
    sort_order      INTEGER DEFAULT 0,
    is_primary      BOOLEAN DEFAULT FALSE,
    width           INTEGER,
    height          INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images (product_id);

-- Avis produits
CREATE TABLE product_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,          -- Référence vers shared.users
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title           VARCHAR(200),
    content         TEXT,
    is_verified     BOOLEAN DEFAULT FALSE,  -- Achat vérifié
    is_published    BOOLEAN DEFAULT FALSE,
    admin_response  TEXT,
    response_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON product_reviews (product_id);
CREATE INDEX idx_reviews_user ON product_reviews (user_id);
CREATE INDEX idx_reviews_published ON product_reviews (is_published, product_id);

-- Tags / Labels
CREATE TABLE tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    color           VARCHAR(7),             -- Hex color (#FF0000)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_tags (
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

-- Triggers
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();
CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();
```

## 3.4 Domaine : Commandes & Paiements (schéma `ecommerce`)

```sql
-- =============================================================
-- SCHÉMA ECOMMERCE : Commandes & Paiements
-- =============================================================

-- Commandes
CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number        VARCHAR(20) NOT NULL UNIQUE,  -- TS-2026-00001
    user_id             UUID NOT NULL,                 -- Référence shared.users
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN (
                            'PENDING',          -- En attente de paiement
                            'CONFIRMED',        -- Paiement confirmé
                            'PROCESSING',       -- En préparation
                            'SHIPPED',          -- Expédiée
                            'DELIVERED',        -- Livrée
                            'COMPLETED',        -- Terminée (période retour expirée)
                            'CANCELLED',        -- Annulée
                            'REFUNDED',         -- Remboursée
                            'PARTIALLY_REFUNDED'-- Partiellement remboursée
                        )),

    -- Montants
    subtotal_ht         NUMERIC(10,2) NOT NULL,       -- Total HT
    tva_amount          NUMERIC(10,2) NOT NULL,       -- Montant TVA
    shipping_ht         NUMERIC(10,2) NOT NULL DEFAULT 0,
    shipping_tva        NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_ttc           NUMERIC(10,2) NOT NULL,       -- Total TTC final

    -- Adresses (snapshot au moment de la commande)
    shipping_address    JSONB NOT NULL,
    billing_address     JSONB NOT NULL,

    -- Livraison
    shipping_method     VARCHAR(50),          -- 'colissimo', 'chronopost', 'pickup'
    tracking_number     VARCHAR(100),
    shipped_at          TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,

    -- Coupon
    coupon_code         VARCHAR(50),
    coupon_discount     NUMERIC(10,2) DEFAULT 0,

    -- Notes
    customer_note       TEXT,
    internal_note       TEXT,

    -- Metadata
    ip_address          INET,
    user_agent          TEXT,
    source              VARCHAR(20) DEFAULT 'WEB',    -- WEB, ADMIN, API
    metadata            JSONB DEFAULT '{}',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Séquence pour les numéros de commande
CREATE SEQUENCE order_number_seq START WITH 1;

CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_number ON orders (order_number);
CREATE INDEX idx_orders_created ON orders (created_at);
CREATE INDEX idx_orders_shipped ON orders (shipped_at) WHERE shipped_at IS NOT NULL;

-- Lignes de commande
CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL,          -- Référence vers products
    product_name    VARCHAR(300) NOT NULL,  -- Snapshot nom au moment de la commande
    product_sku     VARCHAR(50) NOT NULL,   -- Snapshot SKU
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_ht   NUMERIC(10,2) NOT NULL,
    unit_price_ttc  NUMERIC(10,2) NOT NULL,
    tva_rate        NUMERIC(5,2) NOT NULL,
    total_ht        NUMERIC(10,2) NOT NULL,
    total_ttc       NUMERIC(10,2) NOT NULL,
    metadata        JSONB DEFAULT '{}',     -- Options, variantes, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);

-- Paiements
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method          VARCHAR(30) NOT NULL
                    CHECK (method IN (
                        'CARD',             -- CB via Stripe
                        'APPLE_PAY',        -- Apple Pay via Stripe
                        'GOOGLE_PAY',       -- Google Pay via Stripe
                        'LINK',             -- Stripe Link
                        'BANK_TRANSFER',    -- Virement SEPA
                        'INSTALLMENT_2X',   -- Paiement 2x maison
                        'INSTALLMENT_3X',   -- Paiement 3x maison
                        'INSTALLMENT_4X',   -- Paiement 4x maison
                        'CASH',             -- Espèces (retrait boutique)
                        'CHECK'             -- Chèque
                    )),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN (
                        'PENDING',          -- En attente
                        'PROCESSING',       -- En cours de traitement
                        'CONFIRMED',        -- Confirmé / capturé
                        'FAILED',           -- Échoué
                        'CANCELLED',        -- Annulé
                        'REFUNDED',         -- Remboursé
                        'PARTIALLY_REFUNDED'
                    )),
    amount          NUMERIC(10,2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'EUR',

    -- Références externes
    stripe_payment_intent_id    VARCHAR(100),
    stripe_charge_id            VARCHAR(100),
    bank_reference              VARCHAR(50),    -- Référence virement
    check_number                VARCHAR(20),    -- Numéro chèque

    -- Remboursement
    refund_amount               NUMERIC(10,2),
    refund_reason               TEXT,
    refunded_at                 TIMESTAMPTZ,

    -- Metadata
    gateway_response            JSONB,          -- Réponse brute du PSP
    metadata                    JSONB DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments (order_id);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_method ON payments (method);
CREATE INDEX idx_payments_stripe ON payments (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- Échéancier de paiement (pour les facilités 2x/3x/4x)
CREATE TABLE payment_installments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    installment_num SMALLINT NOT NULL,      -- 1, 2, 3, 4
    total_num       SMALLINT NOT NULL,      -- Nombre total d'échéances
    amount          NUMERIC(10,2) NOT NULL,
    due_date        DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'PAID', 'LATE', 'FAILED', 'CANCELLED')),
    paid_at         TIMESTAMPTZ,
    payment_method  VARCHAR(30),            -- Méthode utilisée pour cette échéance
    reminder_sent   BOOLEAN DEFAULT FALSE,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_installments_payment ON payment_installments (payment_id);
CREATE INDEX idx_installments_due ON payment_installments (due_date) WHERE status = 'PENDING';
CREATE INDEX idx_installments_late ON payment_installments (status) WHERE status = 'LATE';

-- Enregistrements de paiement (mouvements financiers réels)
CREATE TABLE payment_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      UUID REFERENCES payments(id) ON DELETE SET NULL,
    installment_id  UUID REFERENCES payment_installments(id) ON DELETE SET NULL,
    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('CHARGE', 'REFUND', 'CHARGEBACK', 'ADJUSTMENT')),
    amount          NUMERIC(10,2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'EUR',
    reference       VARCHAR(100),           -- Référence unique du mouvement
    description     TEXT,
    gateway         VARCHAR(20),            -- 'stripe', 'manual', 'bank'
    gateway_ref     VARCHAR(100),           -- Référence côté gateway
    metadata        JSONB DEFAULT '{}',
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_records_payment ON payment_records (payment_id);
CREATE INDEX idx_payment_records_type ON payment_records (type);
CREATE INDEX idx_payment_records_date ON payment_records (recorded_at);

-- Coupons / Codes promo
CREATE TABLE coupons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) NOT NULL UNIQUE,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING')),
    value           NUMERIC(10,2) NOT NULL,     -- Pourcentage ou montant fixe
    min_order       NUMERIC(10,2),              -- Commande minimum
    max_discount    NUMERIC(10,2),              -- Réduction max (pour %)
    usage_limit     INTEGER,                    -- Limite totale d'utilisation
    usage_count     INTEGER DEFAULT 0,
    per_user_limit  INTEGER DEFAULT 1,          -- Limite par utilisateur
    starts_at       TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    applies_to      JSONB,                      -- Filtre: catégories, produits, marques
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons (code);
CREATE INDEX idx_coupons_active ON coupons (is_active, starts_at, expires_at);

-- Triggers
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();
```

## 3.5 Domaine : CRM (schéma `crm`)

```sql
-- =============================================================
-- SCHÉMA CRM : Relation client
-- =============================================================

SET search_path TO crm;

-- Profil client enrichi (extension de shared.users)
CREATE TABLE customer_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE,       -- Référence shared.users
    segment         VARCHAR(20) DEFAULT 'STANDARD'
                    CHECK (segment IN ('VIP', 'PREMIUM', 'STANDARD', 'NEW', 'AT_RISK', 'CHURNED')),
    source          VARCHAR(30),                -- 'organic', 'google_ads', 'referral', 'in_store'
    referral_code   VARCHAR(20) UNIQUE,
    referred_by     UUID,                       -- User ID du parrain

    -- Fidélité
    loyalty_points  INTEGER DEFAULT 0,
    loyalty_tier    VARCHAR(20) DEFAULT 'BRONZE'
                    CHECK (loyalty_tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
    total_spent     NUMERIC(12,2) DEFAULT 0,
    order_count     INTEGER DEFAULT 0,
    avg_order_value NUMERIC(10,2) DEFAULT 0,

    -- Préférences
    preferred_brands    TEXT[],                  -- Array de brand slugs
    preferred_budget    VARCHAR(20),             -- 'low', 'mid', 'high'
    usage_profile       VARCHAR(20),             -- 'commuter', 'leisure', 'sport'
    experience_level    VARCHAR(20),             -- 'beginner', 'intermediate', 'expert'

    -- Communication
    email_opt_in        BOOLEAN DEFAULT TRUE,
    sms_opt_in          BOOLEAN DEFAULT FALSE,
    whatsapp_opt_in     BOOLEAN DEFAULT FALSE,
    preferred_language  VARCHAR(5) DEFAULT 'fr',

    -- Scores
    nps_score           SMALLINT,               -- Net Promoter Score (-100 à 100)
    satisfaction_score  NUMERIC(3,1),            -- 0 à 5

    -- Dates importantes
    birthday            DATE,
    first_purchase_at   TIMESTAMPTZ,
    last_purchase_at    TIMESTAMPTZ,
    last_visit_at       TIMESTAMPTZ,

    tags                TEXT[] DEFAULT '{}',
    notes               TEXT,
    metadata            JSONB DEFAULT '{}',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_user ON customer_profiles (user_id);
CREATE INDEX idx_customer_segment ON customer_profiles (segment);
CREATE INDEX idx_customer_tier ON customer_profiles (loyalty_tier);
CREATE INDEX idx_customer_spent ON customer_profiles (total_spent);
CREATE INDEX idx_customer_tags ON customer_profiles USING gin (tags);
CREATE INDEX idx_customer_referral ON customer_profiles (referral_code);

-- Timeline client (historique de toutes les interactions)
CREATE TABLE customer_timeline (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,              -- Référence shared.users
    type            VARCHAR(30) NOT NULL
                    CHECK (type IN (
                        'ORDER_PLACED', 'ORDER_DELIVERED', 'ORDER_RETURNED',
                        'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'REFUND_ISSUED',
                        'REVIEW_POSTED', 'REVIEW_RESPONDED',
                        'TICKET_OPENED', 'TICKET_RESOLVED',
                        'CAMPAIGN_SENT', 'CAMPAIGN_OPENED', 'CAMPAIGN_CLICKED',
                        'LOYALTY_EARNED', 'LOYALTY_REDEEMED',
                        'NOTE_ADDED', 'CALL_LOGGED', 'EMAIL_SENT',
                        'PROFILE_UPDATED', 'SEGMENT_CHANGED',
                        'FIRST_VISIT', 'REGISTRATION'
                    )),
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    entity_type     VARCHAR(30),                -- 'order', 'ticket', 'campaign'
    entity_id       UUID,
    performed_by    UUID,                       -- Staff qui a effectué l'action
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeline_user ON customer_timeline (user_id);
CREATE INDEX idx_timeline_type ON customer_timeline (type);
CREATE INDEX idx_timeline_created ON customer_timeline (created_at);
CREATE INDEX idx_timeline_entity ON customer_timeline (entity_type, entity_id);

-- Campagnes marketing
CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH')),
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED')),
    segment_filter  JSONB NOT NULL,             -- Filtre de segmentation
    /*
    Exemple segment_filter :
    {
        "segment": ["VIP", "PREMIUM"],
        "min_spent": 500,
        "last_purchase_days": 90,
        "tags": ["trottinette-electrique"]
    }
    */
    subject         VARCHAR(300),               -- Sujet email
    content         TEXT NOT NULL,               -- Contenu (HTML ou texte)
    template_id     VARCHAR(50),                -- ID template Brevo

    -- Stats
    recipients      INTEGER DEFAULT 0,
    sent_count      INTEGER DEFAULT 0,
    opened_count    INTEGER DEFAULT 0,
    clicked_count   INTEGER DEFAULT 0,
    bounced_count   INTEGER DEFAULT 0,
    unsubscribed    INTEGER DEFAULT 0,

    scheduled_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON campaigns (status);
CREATE INDEX idx_campaigns_type ON campaigns (type);
CREATE INDEX idx_campaigns_scheduled ON campaigns (scheduled_at) WHERE status = 'SCHEDULED';

-- Triggers
CREATE TRIGGER trg_customer_updated BEFORE UPDATE ON customer_profiles
    FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();
```

## 3.6 Domaine : SAV (schéma `sav`)

```sql
-- =============================================================
-- SCHÉMA SAV : Service après-vente
-- =============================================================

SET search_path TO sav;

-- Tickets SAV
CREATE TABLE tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number   VARCHAR(20) NOT NULL UNIQUE,    -- SAV-2026-00001
    user_id         UUID NOT NULL,                   -- Client
    assigned_to     UUID,                            -- Technicien assigné
    order_id        UUID,                            -- Commande liée (optionnel)
    product_id      UUID,                            -- Produit concerné (optionnel)

    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('REPAIR', 'WARRANTY', 'RETURN', 'EXCHANGE', 'QUESTION', 'COMPLAINT')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'MEDIUM'
                    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status          VARCHAR(20) NOT NULL DEFAULT 'OPENED'
                    CHECK (status IN (
                        'OPENED',           -- Ouvert par le client
                        'TRIAGED',          -- Trié, assigné
                        'DIAGNOSED',        -- Diagnostic effectué
                        'QUOTE_SENT',       -- Devis envoyé au client
                        'QUOTE_ACCEPTED',   -- Devis accepté
                        'QUOTE_REJECTED',   -- Devis refusé
                        'IN_REPAIR',        -- En réparation
                        'WAITING_PARTS',    -- En attente de pièces
                        'RESOLVED',         -- Résolu
                        'CLOSED'            -- Clôturé
                    )),

    subject         VARCHAR(300) NOT NULL,
    description     TEXT NOT NULL,
    product_serial  VARCHAR(100),                    -- Numéro de série
    purchase_date   DATE,

    -- Diagnostic
    diagnosis       TEXT,
    diagnosed_at    TIMESTAMPTZ,
    diagnosed_by    UUID,

    -- Devis
    quote_amount    NUMERIC(10,2),
    quote_details   JSONB,                           -- Détails du devis
    quote_sent_at   TIMESTAMPTZ,
    quote_valid_until DATE,

    -- Résolution
    resolution      TEXT,
    resolved_at     TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,

    -- Évaluation client
    satisfaction    SMALLINT CHECK (satisfaction BETWEEN 1 AND 5),
    feedback        TEXT,

    -- SLA
    sla_due_at      TIMESTAMPTZ,
    sla_breached    BOOLEAN DEFAULT FALSE,

    tags            TEXT[] DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE ticket_number_seq START WITH 1;

CREATE INDEX idx_tickets_number ON tickets (ticket_number);
CREATE INDEX idx_tickets_user ON tickets (user_id);
CREATE INDEX idx_tickets_assigned ON tickets (assigned_to);
CREATE INDEX idx_tickets_status ON tickets (status);
CREATE INDEX idx_tickets_priority ON tickets (priority);
CREATE INDEX idx_tickets_type ON tickets (type);
CREATE INDEX idx_tickets_sla ON tickets (sla_due_at) WHERE NOT sla_breached AND status NOT IN ('RESOLVED', 'CLOSED');
CREATE INDEX idx_tickets_created ON tickets (created_at);

-- Messages / Échanges sur un ticket
CREATE TABLE ticket_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL,          -- Client ou staff
    author_role     VARCHAR(20) NOT NULL,   -- 'CLIENT', 'TECHNICIAN', 'ADMIN'
    content         TEXT NOT NULL,
    attachments     JSONB DEFAULT '[]',     -- [{url, filename, size, mime_type}]
    is_internal     BOOLEAN DEFAULT FALSE,  -- Note interne (invisible client)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_messages_ticket ON ticket_messages (ticket_id);
CREATE INDEX idx_ticket_messages_created ON ticket_messages (created_at);

-- Timeline SAV (événements automatiques)
CREATE TABLE ticket_timeline (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL,
    /*
    Types : 'created', 'assigned', 'status_changed', 'priority_changed',
            'diagnosed', 'quote_sent', 'quote_accepted', 'quote_rejected',
            'repair_started', 'parts_ordered', 'parts_received',
            'repair_completed', 'resolved', 'closed', 'reopened',
            'sla_warning', 'sla_breached', 'message_sent'
    */
    description     VARCHAR(500) NOT NULL,
    old_value       VARCHAR(100),
    new_value       VARCHAR(100),
    performed_by    UUID,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_timeline_ticket ON ticket_timeline (ticket_id);
CREATE INDEX idx_ticket_timeline_created ON ticket_timeline (created_at);

-- Pièces détachées utilisées en réparation
CREATE TABLE repair_parts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    product_id      UUID,                   -- Pièce du catalogue
    part_name       VARCHAR(200) NOT NULL,
    part_sku        VARCHAR(50),
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_cost       NUMERIC(10,2),
    unit_price      NUMERIC(10,2),          -- Prix facturé au client
    status          VARCHAR(20) DEFAULT 'NEEDED'
                    CHECK (status IN ('NEEDED', 'ORDERED', 'RECEIVED', 'INSTALLED')),
    ordered_at      TIMESTAMPTZ,
    received_at     TIMESTAMPTZ,
    installed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repair_parts_ticket ON repair_parts (ticket_id);
CREATE INDEX idx_repair_parts_status ON repair_parts (status) WHERE status != 'INSTALLED';

-- Planning techniciens
CREATE TABLE technician_slots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id   UUID NOT NULL,          -- Référence shared.users
    ticket_id       UUID REFERENCES tickets(id) ON DELETE SET NULL,
    date            DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    type            VARCHAR(20) NOT NULL DEFAULT 'REPAIR'
                    CHECK (type IN ('REPAIR', 'DIAGNOSTIC', 'MAINTENANCE', 'BREAK', 'UNAVAILABLE')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slots_technician ON technician_slots (technician_id, date);
CREATE INDEX idx_slots_date ON technician_slots (date);
CREATE INDEX idx_slots_ticket ON technician_slots (ticket_id) WHERE ticket_id IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION shared.update_updated_at();
```

## 3.7 Domaine : Comptabilité (schéma `compta`) — ⏸️ PROVISIONNÉ

```sql
-- =============================================================
-- SCHÉMA COMPTA : Comptabilité & Facturation
-- ⏸️ REPORTÉ À UNE PHASE ULTÉRIEURE
-- Le schéma est provisionné pour référence mais ne sera pas
-- implémenté dans la V1.
-- =============================================================

SET search_path TO compta;

-- NOTE : Les tables ci-dessous sont un aperçu de la structure prévue.
-- Elles seront finalisées lors de l'implémentation du Module C.

-- Factures (conformes aux obligations légales françaises)
CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number  VARCHAR(20) NOT NULL UNIQUE,  -- FAC-2026-00001 (séquentiel, sans rupture)
    order_id        UUID NOT NULL,
    user_id         UUID NOT NULL,
    type            VARCHAR(10) NOT NULL CHECK (type IN ('INVOICE', 'CREDIT_NOTE', 'PROFORMA')),
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    subtotal_ht     NUMERIC(10,2) NOT NULL,
    tva_amount      NUMERIC(10,2) NOT NULL,
    total_ttc       NUMERIC(10,2) NOT NULL,
    issued_at       DATE NOT NULL,
    due_at          DATE NOT NULL,
    paid_at         DATE,
    pdf_url         VARCHAR(500),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lignes de facture
CREATE TABLE invoice_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description     VARCHAR(500) NOT NULL,
    quantity        NUMERIC(10,3) NOT NULL,
    unit_price_ht   NUMERIC(10,2) NOT NULL,
    tva_rate        NUMERIC(5,2) NOT NULL,
    total_ht        NUMERIC(10,2) NOT NULL,
    total_ttc       NUMERIC(10,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Écritures comptables (FEC-compatible)
-- Le FEC (Fichier des Écritures Comptables) est obligatoire en France
-- pour toute entreprise tenant une comptabilité informatisée.
CREATE TABLE journal_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_code    VARCHAR(10) NOT NULL,     -- 'VE' (ventes), 'AC' (achats), 'BQ' (banque)
    entry_number    VARCHAR(20) NOT NULL,      -- Numéro d'écriture séquentiel
    entry_date      DATE NOT NULL,
    piece_ref       VARCHAR(50),               -- Référence pièce justificative
    account_number  VARCHAR(10) NOT NULL,      -- Plan comptable (411000, 701000, etc.)
    account_label   VARCHAR(200) NOT NULL,
    debit           NUMERIC(12,2) DEFAULT 0,
    credit          NUMERIC(12,2) DEFAULT 0,
    description     VARCHAR(500) NOT NULL,
    validated_at    TIMESTAMPTZ,               -- Date de validation (immuable après)
    validated_by    UUID,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rapprochement bancaire
CREATE TABLE bank_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account    VARCHAR(34) NOT NULL,      -- IBAN
    transaction_date DATE NOT NULL,
    value_date      DATE,
    amount          NUMERIC(12,2) NOT NULL,
    description     VARCHAR(500),
    reference       VARCHAR(100),
    matched_payment_id UUID,                    -- Lien vers payment_records
    match_status    VARCHAR(20) DEFAULT 'UNMATCHED'
                    CHECK (match_status IN ('UNMATCHED', 'MATCHED', 'MANUAL', 'EXCLUDED')),
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plan comptable simplifié
CREATE TABLE chart_of_accounts (
    account_number  VARCHAR(10) PRIMARY KEY,
    label           VARCHAR(200) NOT NULL,
    type            VARCHAR(20) NOT NULL,       -- 'ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'
    parent_account  VARCHAR(10),
    is_active       BOOLEAN DEFAULT TRUE
);
```

## 3.8 Schéma ClickHouse (Analytics)

```sql
-- =============================================================
-- CLICKHOUSE : Analytics & Événements
-- =============================================================

-- Base de données
CREATE DATABASE IF NOT EXISTS trottistore;

-- Événements génériques (tous les événements trackés)
CREATE TABLE trottistore.events (
    event_id        UUID DEFAULT generateUUIDv4(),
    event_type      LowCardinality(String),     -- 'page_view', 'add_to_cart', 'purchase', etc.
    event_source    LowCardinality(String),      -- 'web', 'api', 'admin'
    session_id      String,
    user_id         Nullable(UUID),
    anonymous_id    String,                      -- ID anonyme avant connexion

    -- Contexte
    timestamp       DateTime64(3, 'Europe/Paris'),
    url             String DEFAULT '',
    referrer        String DEFAULT '',
    utm_source      LowCardinality(String) DEFAULT '',
    utm_medium      LowCardinality(String) DEFAULT '',
    utm_campaign    LowCardinality(String) DEFAULT '',

    -- Device
    device_type     LowCardinality(String) DEFAULT '',  -- 'desktop', 'mobile', 'tablet'
    browser         LowCardinality(String) DEFAULT '',
    os              LowCardinality(String) DEFAULT '',
    screen_width    UInt16 DEFAULT 0,
    screen_height   UInt16 DEFAULT 0,

    -- Geo
    country         LowCardinality(String) DEFAULT '',
    city            String DEFAULT '',
    ip_hash         String DEFAULT '',          -- Hash de l'IP (RGPD)

    -- Données métier
    properties      String DEFAULT '{}',        -- JSON libre

    -- Partition
    event_date      Date DEFAULT toDate(timestamp)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_type, event_date, session_id)
TTL event_date + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;

-- Pages vues (vue matérialisée pour requêtes rapides)
CREATE MATERIALIZED VIEW trottistore.page_views_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, url, device_type, utm_source)
AS SELECT
    event_date,
    url,
    device_type,
    utm_source,
    count() AS views,
    uniqExact(session_id) AS unique_sessions,
    uniqExact(user_id) AS unique_users
FROM trottistore.events
WHERE event_type = 'page_view'
GROUP BY event_date, url, device_type, utm_source;

-- Conversions (vue matérialisée)
CREATE MATERIALIZED VIEW trottistore.conversions_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_type, utm_source)
AS SELECT
    event_date,
    event_type,
    utm_source,
    utm_medium,
    utm_campaign,
    count() AS event_count,
    uniqExact(user_id) AS unique_users
FROM trottistore.events
WHERE event_type IN ('add_to_cart', 'begin_checkout', 'purchase', 'sign_up')
GROUP BY event_date, event_type, utm_source, utm_medium, utm_campaign;

-- Revenus quotidiens (vue matérialisée)
CREATE MATERIALIZED VIEW trottistore.daily_revenue_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, utm_source)
AS SELECT
    event_date,
    utm_source,
    count() AS order_count,
    sumIf(
        toDecimal64(JSONExtractFloat(properties, 'total'), 2),
        event_type = 'purchase'
    ) AS revenue
FROM trottistore.events
WHERE event_type = 'purchase'
GROUP BY event_date, utm_source;
```

---

# 4 — Modules métier détaillés

## 4.1 Module A — CRM (Customer Relationship Management)

### 4.1.1 Vue d'ensemble

Le module CRM transforme TrottiStore d'un simple vendeur de trottinettes en un partenaire de mobilité pour ses clients. L'objectif est de construire une relation durable via la connaissance client, la personnalisation et la fidélisation.

```
┌─────────────────────────────────────────────────┐
│                  MODULE CRM                      │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Profil   │  │ Timeline │  │ Segmentation │  │
│  │  360°    │  │ Client   │  │  Dynamique   │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│  ┌────┴──────────────┴───────────────┴───────┐  │
│  │           Moteur de fidélité              │  │
│  │     Points • Tiers • Récompenses          │  │
│  └────────────────────┬──────────────────────┘  │
│                       │                          │
│  ┌────────────────────┴──────────────────────┐  │
│  │         Campagnes Marketing               │  │
│  │    Email • SMS • WhatsApp • Push           │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 4.1.2 Profil 360°

Le profil 360° agrège toutes les données d'un client en un seul écran. C'est la vue principale pour le staff en boutique et les campagnes marketing.

**Données agrégées :**
- Informations personnelles (nom, email, téléphone, adresses)
- Historique d'achats complet (commandes, montants, fréquence)
- Historique SAV (tickets, satisfaction)
- Points de fidélité et tier
- Préférences (marques, budget, usage)
- Timeline des interactions (chronologique)
- Segmentation automatique
- Score NPS et satisfaction

### 4.1.3 Segmentation dynamique

La segmentation est recalculée automatiquement chaque nuit (job BullMQ) et à chaque événement significatif (achat, SAV, inactivité).

**Règles de segmentation :**

| Segment | Critères | Actions automatiques |
|---|---|---|
| **VIP** | >5 000€ dépensés OU >10 commandes OU tier Platinum | Email perso, accès ventes privées, support prioritaire |
| **PREMIUM** | >2 000€ dépensés OU >5 commandes OU tier Gold | Offres exclusives, livraison gratuite |
| **STANDARD** | Au moins 1 achat dans les 6 derniers mois | Programme fidélité standard |
| **NEW** | Inscription < 30 jours, 0-1 achat | Séquence onboarding, code -10% |
| **AT_RISK** | Pas d'achat depuis 3-6 mois, était actif | Email de réengagement, offre spéciale |
| **CHURNED** | Pas d'achat depuis > 6 mois | Campagne win-back, enquête satisfaction |

### 4.1.4 Programme de fidélité

```
┌──────────────────────────────────────────────┐
│            PROGRAMME FIDÉLITÉ                │
│                                              │
│  BRONZE (0-499 pts)                          │
│  ├── 1 point par euro dépensé               │
│  └── Pas d'avantage supplémentaire           │
│                                              │
│  SILVER (500-1999 pts)                       │
│  ├── 1.5 points par euro dépensé            │
│  ├── Livraison gratuite dès 50€             │
│  └── -5% permanent sur les accessoires       │
│                                              │
│  GOLD (2000-4999 pts)                        │
│  ├── 2 points par euro dépensé              │
│  ├── Livraison gratuite                      │
│  ├── -10% sur les accessoires                │
│  └── Accès ventes privées                    │
│                                              │
│  PLATINUM (5000+ pts)                        │
│  ├── 3 points par euro dépensé              │
│  ├── Livraison express gratuite              │
│  ├── -15% sur les accessoires                │
│  ├── Diagnostic gratuit (1x/an)              │
│  └── Support prioritaire (réponse 2h)        │
│                                              │
│  Conversion : 100 points = 5€ de réduction   │
└──────────────────────────────────────────────┘
```

### 4.1.5 Endpoints API CRM

```
Service CRM — Port 3002
Base URL: /api/v1/crm

# Profils clients
GET    /customers                     # Liste clients (filtres, pagination, tri)
GET    /customers/:id                 # Profil 360° complet
GET    /customers/:id/timeline        # Timeline paginée
GET    /customers/:id/orders          # Historique commandes
GET    /customers/:id/tickets         # Historique SAV
PATCH  /customers/:id                 # Mise à jour profil
POST   /customers/:id/notes           # Ajouter une note
POST   /customers/:id/tags            # Ajouter des tags
DELETE /customers/:id/tags/:tag       # Supprimer un tag

# Fidélité
GET    /customers/:id/loyalty         # Détail points + tier
POST   /customers/:id/loyalty/earn    # Créditer des points (staff)
POST   /customers/:id/loyalty/redeem  # Utiliser des points
GET    /loyalty/tiers                 # Configuration des tiers

# Segmentation
GET    /segments                      # Liste des segments avec compteurs
GET    /segments/:segment/customers   # Clients d'un segment
POST   /segments/recalculate          # Forcer le recalcul

# Campagnes
GET    /campaigns                     # Liste des campagnes
POST   /campaigns                     # Créer une campagne
GET    /campaigns/:id                 # Détail + stats
PATCH  /campaigns/:id                 # Modifier
POST   /campaigns/:id/send            # Envoyer
POST   /campaigns/:id/schedule        # Planifier
DELETE /campaigns/:id                 # Supprimer (si DRAFT)
GET    /campaigns/:id/recipients      # Liste des destinataires
GET    /campaigns/:id/stats           # Statistiques détaillées

# Recherche
GET    /search?q=...                  # Recherche client (nom, email, téléphone)

# Export
GET    /export/customers              # Export CSV des clients (filtré)
```

## 4.2 Module B — Analytics & KPI

### 4.2.1 Vue d'ensemble

Le module Analytics fournit une visibilité temps réel et historique sur toutes les métriques métier de TrottiStore. Il combine un tracking côté client (page views, events), un pipeline d'ingestion ClickHouse, et des dashboards Grafana.

```
┌──────────────────────────────────────────────────┐
│                MODULE ANALYTICS                   │
│                                                   │
│  ┌─────────────┐     ┌──────────────────────┐   │
│  │ Tracker JS  │────▶│ API Ingestion        │   │
│  │ (frontend)  │     │ POST /events         │   │
│  └─────────────┘     └──────────┬───────────┘   │
│                                 │                │
│                    ┌────────────▼────────────┐   │
│                    │  Redis Queue (BullMQ)   │   │
│                    │  Batch insert 1000/5s   │   │
│                    └────────────┬────────────┘   │
│                                 │                │
│                    ┌────────────▼────────────┐   │
│                    │     ClickHouse          │   │
│                    │     events table        │   │
│                    │     + vues matérialisées│   │
│                    └────────────┬────────────┘   │
│                                 │                │
│  ┌──────────────────────────────┴──────────┐    │
│  │                                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌───────┐ │    │
│  │  │Dashboard │  │WebSocket │  │Exports│ │    │
│  │  │ Grafana  │  │Temps réel│  │CSV/PDF│ │    │
│  │  └──────────┘  └──────────┘  └───────┘ │    │
│  │                                          │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
└──────────────────────────────────────────────────┘
```

### 4.2.2 Tracking client

```typescript
// Tracker JS côté frontend (intégré dans Next.js)
// packages/tracker/src/index.ts

class TrottiTracker {
  private queue: Event[] = [];
  private sessionId: string;
  private userId: string | null;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.userId = null;

    // Flush toutes les 5 secondes ou quand 10 events sont en queue
    setInterval(() => this.flush(), 5000);
  }

  track(type: string, properties: Record<string, unknown> = {}) {
    this.queue.push({
      event_type: type,
      session_id: this.sessionId,
      user_id: this.userId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      properties: JSON.stringify(properties),
      // UTM params
      ...this.getUtmParams(),
      // Device info
      device_type: this.getDeviceType(),
      screen_width: window.screen.width,
      screen_height: window.screen.height,
    });

    if (this.queue.length >= 10) this.flush();
  }

  // Events pré-configurés
  pageView() { this.track('page_view'); }
  productView(productId: string, price: number) {
    this.track('product_view', { product_id: productId, price });
  }
  addToCart(productId: string, quantity: number, price: number) {
    this.track('add_to_cart', { product_id: productId, quantity, price });
  }
  beginCheckout(total: number) {
    this.track('begin_checkout', { total });
  }
  purchase(orderId: string, total: number, items: number) {
    this.track('purchase', { order_id: orderId, total, items });
  }

  private async flush() {
    if (this.queue.length === 0) return;
    const events = [...this.queue];
    this.queue = [];
    await fetch('/api/v1/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    });
  }
}
```

### 4.2.3 Les 5 dashboards

**Dashboard 1 — Vue d'ensemble (temps réel)**
- CA du jour (vs J-1, vs J-7)
- Nombre de commandes du jour
- Panier moyen
- Visiteurs actifs (WebSocket)
- Taux de conversion (aujourd'hui)
- Top 5 produits du jour

**Dashboard 2 — E-commerce**
- CA par jour/semaine/mois (graphique)
- Nombre de commandes par jour
- Panier moyen historique
- Taux de conversion par source
- Produits les plus vendus (30j)
- Catégories les plus vendues
- Taux de retour

**Dashboard 3 — Clients**
- Nouveaux clients par jour
- Répartition par segment (pie chart)
- Répartition par tier fidélité
- LTV moyen par segment
- Taux de rétention (cohortes)
- Top clients par CA

**Dashboard 4 — Acquisition**
- Trafic par source (organic, paid, direct, referral)
- Coût d'acquisition par canal
- Taux de conversion par canal
- Performance campagnes email (open rate, click rate)
- Performance UTM campaigns

**Dashboard 5 — SAV**
- Tickets ouverts par statut
- Temps moyen de résolution
- Taux de satisfaction
- Tickets par technicien
- SLA breach rate
- Top causes de tickets

### 4.2.4 Endpoints API Analytics

```
Service Analytics — Port 3003
Base URL: /api/v1/analytics

# Ingestion
POST   /events                        # Batch d'événements (tracker JS)

# Temps réel (WebSocket)
WS     /ws/realtime                    # Dashboard temps réel
       # Events: visitor_count, orders_today, revenue_today

# KPIs
GET    /kpi/overview                   # KPIs vue d'ensemble
GET    /kpi/ecommerce?from=&to=        # KPIs e-commerce (période)
GET    /kpi/customers?from=&to=        # KPIs clients
GET    /kpi/acquisition?from=&to=      # KPIs acquisition
GET    /kpi/sav?from=&to=              # KPIs SAV

# Rapports
GET    /reports/revenue                # CA détaillé (jour/semaine/mois)
GET    /reports/products               # Performance produits
GET    /reports/categories             # Performance catégories
GET    /reports/customers/cohorts      # Analyse cohortes
GET    /reports/funnel                 # Funnel conversion

# Exports
POST   /exports/csv                    # Export CSV (async, retourne un job ID)
GET    /exports/:jobId                 # Statut / téléchargement

# Configuration
GET    /config/dashboards              # Configuration dashboards
PATCH  /config/dashboards/:id          # Modifier un dashboard
```

## 4.3 Module C — Comptabilité & Facturation — ⏸️ REPORTÉ

> **Ce module est reporté à une phase ultérieure de développement.**
>
> La V1 de TrottiStore se concentre sur le e-commerce, le CRM, les analytics et le SAV.
> Le module comptabilité sera développé une fois ces fondations stabilisées.
>
> **Périmètre prévu (phase 2) :**
> - Facturation automatique conforme aux normes françaises
> - Numérotation séquentielle sans rupture
> - Mentions obligatoires (SIRET, TVA intracommunautaire, conditions de paiement)
> - Export FEC (Fichier des Écritures Comptables) conforme à l'article A.47 A-1 du LPF
> - Rapprochement bancaire (import CSV relevé → matching auto)
> - Journal de ventes, journal de banque
> - Déclaration de TVA (CA3)
> - Tableau de bord financier
>
> **Le schéma BDD (section 3.7) est provisionné** pour permettre aux autres modules de référencer les futures tables comptables. Les tables `invoices`, `journal_entries`, `bank_transactions` et `chart_of_accounts` seront créées lors de l'implémentation.

## 4.4 Module D — SAV (Service Après-Vente)

### 4.4.1 Vue d'ensemble

Le module SAV gère l'intégralité du cycle de vie d'un ticket de service, depuis l'ouverture par le client jusqu'à la clôture, en passant par le diagnostic, le devis, la réparation et le suivi.

### 4.4.2 Cycle de vie du ticket (9 statuts)

```
                    ┌──────────┐
                    │  OPENED  │ ← Client ouvre un ticket
                    └────┬─────┘
                         │ Triage par le staff
                    ┌────▼─────┐
                    │  TRIAGED │ ← Assigné à un technicien
                    └────┬─────┘
                         │ Examen du produit
                    ┌────▼──────┐
                    │ DIAGNOSED │ ← Diagnostic effectué
                    └────┬──────┘
                         │ Si réparation nécessaire
                    ┌────▼──────────┐
                    │  QUOTE_SENT   │ ← Devis envoyé au client
                    └────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         ┌────▼──────────┐   ┌─────▼───────────┐
         │ QUOTE_ACCEPTED│   │ QUOTE_REJECTED  │
         └────┬──────────┘   └────┬────────────┘
              │                   │
              │                   └──▶ CLOSED (avec motif)
              │
         ┌────▼──────────┐
         │   IN_REPAIR   │ ← Réparation en cours
         └────┬──────────┘
              │
              ├──────────────┐
              │              │
         ┌────▼──────────┐  │ (Si pièces manquantes)
         │   RESOLVED    │  ├──▶ WAITING_PARTS
         └────┬──────────┘  │     └──▶ retour à IN_REPAIR
              │              │
         ┌────▼─────┐       │
         │  CLOSED  │ ◄─────┘
         └──────────┘
```

**Transitions autorisées :**

| De | Vers | Condition |
|---|---|---|
| OPENED | TRIAGED | Assignation technicien |
| TRIAGED | DIAGNOSED | Diagnostic renseigné |
| DIAGNOSED | QUOTE_SENT | Si réparation payante |
| DIAGNOSED | IN_REPAIR | Si sous garantie |
| DIAGNOSED | RESOLVED | Si problème résolu au diagnostic |
| QUOTE_SENT | QUOTE_ACCEPTED | Acceptation client |
| QUOTE_SENT | QUOTE_REJECTED | Refus client |
| QUOTE_ACCEPTED | IN_REPAIR | Début réparation |
| IN_REPAIR | WAITING_PARTS | Pièce manquante |
| WAITING_PARTS | IN_REPAIR | Pièce reçue |
| IN_REPAIR | RESOLVED | Réparation terminée |
| RESOLVED | CLOSED | Après feedback client (ou auto 7j) |
| QUOTE_REJECTED | CLOSED | Fermeture directe |
| * | CLOSED | Fermeture admin exceptionnelle |

### 4.4.3 Devis automatique

Le système peut générer un devis automatique basé sur le diagnostic :

```typescript
// Logique de génération de devis
interface QuoteItem {
  type: 'PART' | 'LABOR' | 'DIAGNOSTIC';
  description: string;
  quantity: number;
  unitPriceHT: number;
  tvaRate: number;
}

interface AutoQuote {
  items: QuoteItem[];
  subtotalHT: number;
  tvaAmount: number;
  totalTTC: number;
  estimatedDuration: string;  // "2-3 jours ouvrés"
  validUntil: Date;            // 15 jours
}

// Grille tarifaire main-d'œuvre
const LABOR_RATES = {
  DIAGNOSTIC: { ht: 0, label: 'Diagnostic (gratuit)' },      // Offert
  REPAIR_SIMPLE: { ht: 25, label: 'Réparation simple' },     // ~30 min
  REPAIR_MEDIUM: { ht: 45, label: 'Réparation standard' },   // ~1h
  REPAIR_COMPLEX: { ht: 75, label: 'Réparation complexe' },  // ~2h
  FIRMWARE_UPDATE: { ht: 15, label: 'Mise à jour firmware' },
};
```

### 4.4.4 Planning techniciens

Le planning est géré par créneaux de 30 minutes :

```
Lundi 24 mars 2026 — Technicien : Karim B.
────────────────────────────────────────────
09:00 - 09:30  │ SAV-2026-00142 │ Diagnostic │ Dualtron Thunder
09:30 - 10:30  │ SAV-2026-00138 │ Réparation │ Vsett 10+ (freins)
10:30 - 11:00  │ ☕ Pause
11:00 - 12:00  │ SAV-2026-00140 │ Réparation │ Xiaomi Pro 2 (batterie)
12:00 - 13:30  │ 🍽️ Déjeuner
13:30 - 14:30  │ SAV-2026-00141 │ Réparation │ Ninebot Max G2 (roue)
14:30 - 15:30  │ SAV-2026-00139 │ Réparation │ Kaabo Mantis (contrôleur)
15:30 - 16:00  │ 📋 Admin / Commande pièces
16:00 - 17:00  │ Walk-in (créneau ouvert)
```

### 4.4.5 SLA (Service Level Agreement)

| Priorité | Temps de réponse | Temps de résolution | Actions si SLA menacé |
|---|---|---|---|
| URGENT | 2h | 24h | Alerte SMS manager + notification push |
| HIGH | 4h | 48h | Alerte email manager |
| MEDIUM | 8h | 5 jours ouvrés | Alerte dashboard |
| LOW | 24h | 10 jours ouvrés | Aucune |

### 4.4.6 Endpoints API SAV

```
Service SAV — Port 3004
Base URL: /api/v1/sav

# Tickets
GET    /tickets                        # Liste tickets (filtres, pagination)
POST   /tickets                        # Créer un ticket
GET    /tickets/:id                    # Détail ticket complet
PATCH  /tickets/:id                    # Modifier ticket
PATCH  /tickets/:id/status             # Changer statut (avec validation transitions)
PATCH  /tickets/:id/assign             # Assigner à un technicien
PATCH  /tickets/:id/priority           # Changer priorité

# Diagnostic
POST   /tickets/:id/diagnosis          # Enregistrer le diagnostic
POST   /tickets/:id/quote              # Générer/envoyer le devis
PATCH  /tickets/:id/quote/accept       # Client accepte le devis
PATCH  /tickets/:id/quote/reject       # Client refuse le devis

# Messages
GET    /tickets/:id/messages           # Messages du ticket
POST   /tickets/:id/messages           # Envoyer un message
POST   /tickets/:id/messages/internal  # Note interne (staff only)

# Pièces
GET    /tickets/:id/parts              # Pièces liées au ticket
POST   /tickets/:id/parts              # Ajouter une pièce
PATCH  /tickets/:id/parts/:partId      # Modifier statut pièce

# Timeline
GET    /tickets/:id/timeline           # Historique complet du ticket

# Planning techniciens
GET    /planning                       # Vue planning (semaine)
GET    /planning/:technicianId         # Planning d'un technicien
POST   /planning/slots                 # Créer un créneau
PATCH  /planning/slots/:id             # Modifier un créneau
DELETE /planning/slots/:id             # Supprimer un créneau
GET    /planning/availability           # Créneaux disponibles

# Statistiques
GET    /stats/overview                 # Stats SAV globales
GET    /stats/technicians              # Performance par technicien
GET    /stats/sla                      # Taux de respect SLA

# Client-facing
GET    /my/tickets                     # Mes tickets (client connecté)
POST   /my/tickets                     # Ouvrir un ticket (client)
GET    /my/tickets/:id                 # Suivi de mon ticket
POST   /my/tickets/:id/messages        # Répondre à mon ticket
POST   /my/tickets/:id/satisfaction    # Donner un avis
```

---

# 5 — Auth & Sécurité

## 5.1 Architecture d'authentification

### JWT RS256 — Access + Refresh Tokens

```
┌─────────────┐                     ┌─────────────┐
│   Client    │                     │   API GW    │
│  (Browser)  │                     │   (Caddy)   │
└──────┬──────┘                     └──────┬──────┘
       │                                   │
       │  1. POST /auth/login              │
       │  {email, password}                │
       ├──────────────────────────────────▶│
       │                                   │
       │  2. Vérification credentials      │
       │     bcrypt.compare()              │
       │                                   │
       │  3. Génération tokens             │
       │     Access:  JWT RS256 (15 min)   │
       │     Refresh: Random (7 jours)     │
       │                                   │
       │  4. Set-Cookie: refresh_token     │
       │     (HttpOnly, Secure, SameSite)  │
       │                                   │
       │  5. Response body: access_token   │
       │◀──────────────────────────────────┤
       │                                   │
       │  6. API calls with Bearer token   │
       │  Authorization: Bearer <access>   │
       ├──────────────────────────────────▶│
       │                                   │
       │  7. Token expired (401)           │
       │◀──────────────────────────────────┤
       │                                   │
       │  8. POST /auth/refresh            │
       │  Cookie: refresh_token=...        │
       ├──────────────────────────────────▶│
       │                                   │
       │  9. Rotation: nouveau refresh     │
       │     + nouveau access              │
       │◀──────────────────────────────────┤
       │                                   │
```

**Configuration JWT :**

```typescript
// Clés RS256 (générées via openssl)
// openssl genrsa -out private.pem 2048
// openssl rsa -in private.pem -pubout -out public.pem

const JWT_CONFIG = {
  algorithm: 'RS256',
  accessToken: {
    expiresIn: '15m',
    issuer: 'trottistore.fr',
    audience: 'trottistore-api',
  },
  refreshToken: {
    expiresIn: '7d',
    // Stocké en BDD (hashed) pour révocation
    // Cookie HttpOnly, Secure, SameSite=Strict
  },
};

// Payload du JWT access token
interface JWTPayload {
  sub: string;        // user.id (UUID)
  email: string;
  role: UserRole;
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}
```

**Rotation des refresh tokens :**
- À chaque utilisation, l'ancien refresh token est révoqué et un nouveau est émis
- Si un token déjà utilisé est réutilisé (replay attack), TOUS les tokens de l'utilisateur sont révoqués
- Détection de vol de token

## 5.2 RBAC — Contrôle d'accès par rôle

### Hiérarchie des rôles

```
SUPERADMIN (1 seul)
    └── ADMIN
        └── MANAGER
            ├── TECHNICIAN
            └── STAFF
                └── CLIENT
```

### Matrice de permissions

| Permission | SUPERADMIN | ADMIN | MANAGER | TECHNICIAN | STAFF | CLIENT |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Produits** |||||
| products.read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| products.create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| products.update | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| products.delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Commandes** |||||
| orders.read.all | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| orders.read.own | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| orders.update | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| orders.refund | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Clients (CRM)** |||||
| customers.read | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| customers.update | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| customers.export | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| campaigns.manage | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **SAV** |||||
| tickets.read.all | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| tickets.read.own | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| tickets.create | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| tickets.assign | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| tickets.diagnose | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| tickets.quote | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| planning.manage | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Analytics** |||||
| analytics.read | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| analytics.export | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Système** |||||
| users.manage | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| roles.assign | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| settings.manage | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| audit.read | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Implémentation middleware

```typescript
// Middleware d'autorisation Fastify
const requirePermission = (permission: string) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, permissions } = request.user;

    // SUPERADMIN bypass
    if (role === 'SUPERADMIN') return;

    if (!permissions.includes(permission)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Permission '${permission}' required`,
      });
    }
  };
};

// Utilisation dans les routes
app.get('/api/v1/crm/customers',
  { preHandler: [authenticate, requirePermission('customers.read')] },
  customerController.list
);
```

## 5.3 OWASP Top 10 — Mesures par menace

| # | Menace OWASP | Mesure implémentée |
|---|---|---|
| A01 | **Broken Access Control** | RBAC strict, vérification ownership (un client ne voit que SES commandes), tests d'autorisation automatisés |
| A02 | **Cryptographic Failures** | JWT RS256 (pas HS256), bcrypt (cost 12) pour mots de passe, TLS 1.3 partout, pas de données sensibles dans les JWT |
| A03 | **Injection** | Prisma (requêtes paramétrées), Zod validation sur chaque input, CSP headers, pas de `$queryRawUnsafe` |
| A04 | **Insecure Design** | Principe du moindre privilège, rate limiting par IP et par user, audit log sur actions sensibles |
| A05 | **Security Misconfiguration** | Headers de sécurité (Caddy), Docker user non-root, env vars pour secrets (jamais en dur), `.env` dans `.gitignore` |
| A06 | **Vulnerable Components** | `npm audit` dans la CI, Dependabot pour les mises à jour, lock files versionnés |
| A07 | **Auth Failures** | Rate limiting login (5 tentatives/15min), refresh token rotation, détection replay, verrouillage compte après 10 échecs |
| A08 | **Software Integrity** | Lock files (`package-lock.json`), vérification intégrité dans la CI, images Docker signées |
| A09 | **Logging Failures** | Logs structurés JSON (Loki), audit trail sur actions admin, alertes sur patterns suspects |
| A10 | **SSRF** | Pas de fetch d'URLs utilisateur, validation des webhooks par signature, whitelist des domaines externes |

## 5.4 Protection des données (RGPD)

```
┌─────────────────────────────────────────┐
│         CONFORMITÉ RGPD                 │
│                                         │
│  ✅ Consentement explicite (opt-in)     │
│  ✅ Droit d'accès (export données)      │
│  ✅ Droit de rectification              │
│  ✅ Droit à l'effacement               │
│  ✅ Droit à la portabilité (JSON/CSV)   │
│  ✅ Minimisation des données            │
│  ✅ Hébergement FR (Hetzner Falkenstein │
│     + Brevo Paris)                      │
│  ✅ DPO désigné                         │
│  ✅ Registre des traitements            │
│  ✅ Mentions légales complètes          │
│  ✅ Cookie banner (consentement)        │
│  ✅ Durée de conservation définie       │
│     (3 ans clients, 5 ans compta)       │
│  ✅ Chiffrement au repos (pgcrypto)     │
│  ✅ Anonymisation analytics (IP hash)   │
└─────────────────────────────────────────┘
```

---

# 6 — Intégrations tierces

## 6.1 Paiement — Architecture multi-méthodes

### 6.1.1 Vue d'ensemble

TrottiStore maintient les méthodes de paiement de son site actuel (Apple Pay, Google Pay, Link via Stripe) tout en ajoutant des modes de paiement adaptés à sa clientèle locale : facilités de paiement maison, espèces, virement, chèque.

```
┌─────────────────────────────────────────────────┐
│              PAYMENT PROVIDER (abstrait)          │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │           Stripe (PSP principal)          │   │
│  │                                           │   │
│  │  ┌─────┐ ┌─────┐ ┌──────┐ ┌──────────┐ │   │
│  │  │ CB  │ │Apple│ │Google│ │  Stripe  │ │   │
│  │  │Visa │ │ Pay │ │ Pay  │ │  Link    │ │   │
│  │  │MC   │ │     │ │      │ │          │ │   │
│  │  └─────┘ └─────┘ └──────┘ └──────────┘ │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │        Paiements hors Stripe              │   │
│  │                                           │   │
│  │  ┌──────────┐  ┌─────────┐  ┌─────────┐ │   │
│  │  │ Virement │  │ Espèces │  │ Chèque  │ │   │
│  │  │  SEPA    │  │ (QR)    │  │         │ │   │
│  │  └──────────┘  └─────────┘  └─────────┘ │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │       Facilités de paiement maison        │   │
│  │                                           │   │
│  │  ┌──────┐  ┌──────┐  ┌──────────────┐   │   │
│  │  │  2x  │  │  3x  │  │     4x       │   │   │
│  │  │ sans │  │ sans │  │ sans frais    │   │   │
│  │  │ frais│  │ frais│  │ (>1000€)     │   │   │
│  │  └──────┘  └──────┘  └──────────────┘   │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 6.1.2 Payment Provider abstrait

```typescript
// packages/payments/src/provider.ts

interface PaymentProvider {
  createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntent>;
  confirmPayment(paymentIntentId: string): Promise<PaymentConfirmation>;
  refund(paymentId: string, amount?: number): Promise<RefundResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  handleWebhook(payload: Buffer, signature: string): Promise<WebhookEvent>;
}

interface CreatePaymentParams {
  orderId: string;
  amount: number;          // En centimes
  currency: 'EUR';
  method: PaymentMethod;
  customerId?: string;
  metadata?: Record<string, string>;
  returnUrl?: string;
}

type PaymentMethod =
  | 'CARD'
  | 'APPLE_PAY'
  | 'GOOGLE_PAY'
  | 'LINK'
  | 'BANK_TRANSFER'
  | 'INSTALLMENT_2X'
  | 'INSTALLMENT_3X'
  | 'INSTALLMENT_4X'
  | 'CASH'
  | 'CHECK';

// Implémentation Stripe
class StripeProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  async createPaymentIntent(params: CreatePaymentParams) {
    const paymentMethods = {
      'CARD': ['card'],
      'APPLE_PAY': ['card'],    // Apple Pay via Stripe Elements
      'GOOGLE_PAY': ['card'],   // Google Pay via Stripe Elements
      'LINK': ['link'],
    };

    return this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      payment_method_types: paymentMethods[params.method] || ['card'],
      metadata: {
        order_id: params.orderId,
        ...params.metadata,
      },
    });
  }
  // ... autres méthodes
}

// Implémentation paiement manuel (virement, espèces, chèque)
class ManualPaymentProvider implements PaymentProvider {
  async createPaymentIntent(params: CreatePaymentParams) {
    // Génère une référence unique pour le virement
    // ou un QR code pour le paiement en boutique
    const reference = `TS-${Date.now()}-${params.orderId.slice(0, 8)}`;

    return {
      id: reference,
      status: 'PENDING',
      method: params.method,
      instructions: this.getInstructions(params.method, reference, params.amount),
    };
  }

  private getInstructions(method: PaymentMethod, reference: string, amount: number) {
    switch (method) {
      case 'BANK_TRANSFER':
        return {
          iban: 'FR76 XXXX XXXX XXXX XXXX XXXX XXX',
          bic: 'XXXXXXXX',
          reference,
          amount: (amount / 100).toFixed(2) + ' €',
          note: 'Merci d\'indiquer la référence dans le motif du virement.',
        };
      case 'CASH':
        return {
          qrCode: `trottistore://pay/${reference}/${amount}`,
          address: '18 bis Rue Méchin, 93450 L\'Île-Saint-Denis',
          reference,
          note: 'Présentez ce QR code en boutique pour le paiement.',
        };
      case 'CHECK':
        return {
          orderTo: 'TrottiStore',
          address: '18 bis Rue Méchin, 93450 L\'Île-Saint-Denis',
          reference,
          note: 'Libellé du chèque à l\'ordre de TrottiStore. Référence à indiquer au dos.',
        };
    }
  }
}
```

### 6.1.3 Facilités de paiement maison (2x/3x/4x)

```typescript
// Logique de paiement fractionné
class InstallmentProvider {
  private readonly CONFIG = {
    '2X': { count: 2, minOrder: 200, maxOrder: 3000, fee: 0 },
    '3X': { count: 3, minOrder: 300, maxOrder: 5000, fee: 0 },
    '4X': { count: 4, minOrder: 1000, maxOrder: 10000, fee: 0 },
  };

  async createInstallmentPlan(
    orderId: string,
    amount: number,           // Centimes
    plan: '2X' | '3X' | '4X'
  ): Promise<InstallmentPlan> {
    const config = this.CONFIG[plan];
    const amountEuros = amount / 100;

    if (amountEuros < config.minOrder || amountEuros > config.maxOrder) {
      throw new Error(`Montant hors limites pour le paiement en ${plan}`);
    }

    const installmentAmount = Math.floor(amount / config.count);
    const remainder = amount - (installmentAmount * config.count);

    const installments: Installment[] = [];
    for (let i = 0; i < config.count; i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i);

      installments.push({
        num: i + 1,
        total: config.count,
        amount: i === 0 ? installmentAmount + remainder : installmentAmount,
        dueDate,
        status: i === 0 ? 'PENDING' : 'SCHEDULED',
      });
    }

    return {
      orderId,
      plan,
      totalAmount: amount,
      installments,
      // La première échéance est débitée immédiatement via Stripe
      firstPaymentDue: 'IMMEDIATE',
    };
  }
}

/*
Exemple pour une commande de 1 500 € en 3x :
- Échéance 1 : 500 € (immédiat, par CB)
- Échéance 2 : 500 € (J+30, CB enregistrée)
- Échéance 3 : 500 € (J+60, CB enregistrée)

Job BullMQ quotidien pour :
- Vérifier les échéances dues
- Tenter le prélèvement automatique (Stripe)
- Si échec : relance email + SMS
- Si 3 échecs : alerte manager
*/
```

### 6.1.4 Rapprochement bancaire

```typescript
// Import CSV relevé bancaire → matching automatique
interface BankStatement {
  date: Date;
  valueDate: Date;
  description: string;
  amount: number;
  reference?: string;
}

class BankReconciliation {
  async importStatement(csvContent: string): Promise<ReconciliationResult> {
    const transactions = this.parseCSV(csvContent);

    const results = {
      matched: [] as MatchedTransaction[],
      unmatched: [] as BankStatement[],
      suggestions: [] as SuggestedMatch[],
    };

    for (const tx of transactions) {
      // 1. Match exact par référence (virement avec ref commande)
      const exactMatch = await this.findByReference(tx.reference);
      if (exactMatch) {
        results.matched.push({ transaction: tx, payment: exactMatch });
        continue;
      }

      // 2. Match par montant + date
      const amountMatch = await this.findByAmountAndDate(tx.amount, tx.date);
      if (amountMatch.length === 1) {
        results.matched.push({ transaction: tx, payment: amountMatch[0] });
      } else if (amountMatch.length > 1) {
        results.suggestions.push({ transaction: tx, candidates: amountMatch });
      } else {
        results.unmatched.push(tx);
      }
    }

    return results;
  }
}
```

## 6.2 Livraison — Colissimo & SendCloud

```typescript
// Intégration Colissimo API
class ColissimoProvider {
  async createShipment(order: Order): Promise<ShipmentResult> {
    // Appel API Colissimo pour générer l'étiquette
    const label = await this.api.generateLabel({
      sender: TROTTISTORE_ADDRESS,
      recipient: order.shippingAddress,
      weight: this.calculateWeight(order.items),
      service: this.selectService(order),
      // 'COLISSIMO_HOME' | 'COLISSIMO_RELAY' | 'CHRONOPOST'
    });

    return {
      trackingNumber: label.trackingNumber,
      labelPdf: label.pdfUrl,
      estimatedDelivery: label.estimatedDelivery,
    };
  }
}

// SendCloud pour le multi-transporteur
class SendCloudProvider {
  // Comparaison automatique des tarifs entre transporteurs
  async getBestRate(parcel: ParcelInfo): Promise<ShippingQuote[]> {
    return this.api.getShippingMethods({
      from: TROTTISTORE_ADDRESS,
      to: parcel.destination,
      weight: parcel.weight,
      dimensions: parcel.dimensions,
    });
  }
}
```

## 6.3 Communication — Brevo & Twilio

### Emails transactionnels (Brevo)

```typescript
// Templates d'emails
const EMAIL_TEMPLATES = {
  ORDER_CONFIRMATION: 'tpl_order_confirmation',
  ORDER_SHIPPED: 'tpl_order_shipped',
  ORDER_DELIVERED: 'tpl_order_delivered',
  PAYMENT_RECEIVED: 'tpl_payment_received',
  PAYMENT_FAILED: 'tpl_payment_failed',
  INSTALLMENT_REMINDER: 'tpl_installment_reminder',
  TICKET_CREATED: 'tpl_ticket_created',
  TICKET_UPDATED: 'tpl_ticket_updated',
  QUOTE_SENT: 'tpl_quote_sent',
  WELCOME: 'tpl_welcome',
  PASSWORD_RESET: 'tpl_password_reset',
  REVIEW_REQUEST: 'tpl_review_request',
  LOYALTY_TIER_UP: 'tpl_loyalty_tier_up',
  CAMPAIGN_WINBACK: 'tpl_winback',
};
```

### SMS / WhatsApp (Twilio)

```typescript
// Notifications SMS automatiques
const SMS_TRIGGERS = {
  ORDER_SHIPPED: 'Votre commande {orderNumber} a été expédiée. Suivi : {trackingUrl}',
  SAV_READY: 'Votre trottinette est prête ! Passez la récupérer au 18 bis Rue Méchin. Ref: {ticketNumber}',
  INSTALLMENT_DUE: 'Rappel : échéance de {amount}€ pour votre commande {orderNumber} prévue le {dueDate}.',
  APPOINTMENT_REMINDER: 'Rappel RDV SAV demain à {time}. 18 bis Rue Méchin, L\'Île-Saint-Denis.',
};
```

## 6.4 Tracking — GA4 & Meta Pixel

```typescript
// Configuration côté serveur (server-side tracking)
// Envoyé via Measurement Protocol GA4 + Conversions API Meta

class ServerSideTracking {
  async trackPurchase(order: Order) {
    // GA4 Measurement Protocol
    await fetch('https://www.google-analytics.com/mp/collect', {
      method: 'POST',
      body: JSON.stringify({
        client_id: order.metadata.ga_client_id,
        events: [{
          name: 'purchase',
          params: {
            transaction_id: order.orderNumber,
            value: order.totalTtc,
            currency: 'EUR',
            items: order.items.map(i => ({
              item_id: i.productSku,
              item_name: i.productName,
              price: i.unitPriceTtc,
              quantity: i.quantity,
            })),
          },
        }],
      }),
    });

    // Meta Conversions API
    await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events`, {
      method: 'POST',
      body: JSON.stringify({
        data: [{
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          user_data: { em: sha256(order.email), ph: sha256(order.phone) },
          custom_data: {
            value: order.totalTtc,
            currency: 'EUR',
            content_ids: order.items.map(i => i.productSku),
          },
        }],
        access_token: META_ACCESS_TOKEN,
      }),
    });
  }
}
```

## 6.5 Chat support — Crisp

```typescript
// Intégration Crisp (chat en direct)
const CRISP_CONFIG = {
  websiteId: process.env.CRISP_WEBSITE_ID,
  // Widget affiché sur le storefront
  // Conversations synchro avec le CRM via webhook
};

// Webhook Crisp → CRM
// Quand un client envoie un message via Crisp,
// l'interaction est enregistrée dans la timeline CRM
```

---

# 7 — Plan de migration WooCommerce

## 7.1 Vue d'ensemble

La migration depuis WooCommerce se fait en 4 phases sur 7 semaines, avec une période de fonctionnement parallèle pour minimiser les risques.

```
Semaine 1-2     Semaine 3-4     Semaine 5-6     Semaine 7
┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
│  PHASE 1  │   │  PHASE 2  │   │  PHASE 3  │   │  PHASE 4  │
│ Extraction │──▶│  Import   │──▶│ Parallèle │──▶│  Bascule  │
│            │   │           │   │           │   │           │
│ - Export   │   │ - Clients │   │ - 2 sites │   │ - DNS     │
│   WP data  │   │ - Produits│   │   actifs  │   │ - Redirect│
│ - Audit    │   │ - Commandes│  │ - Tests   │   │ - Monitoring│
│ - Mapping  │   │ - Images  │   │ - Ajust.  │   │ - Rollback │
│            │   │ - SEO     │   │           │   │   plan     │
└───────────┘   └───────────┘   └───────────┘   └───────────┘
```

## 7.2 Phase 1 — Extraction (Semaines 1-2)

### Export des données WooCommerce

```bash
# Export via WP-CLI + requêtes SQL directes
wp export --dir=/tmp/trottistore-export/ --post_type=product
wp export --dir=/tmp/trottistore-export/ --post_type=shop_order
wp export --dir=/tmp/trottistore-export/ --post_type=shop_coupon

# Export SQL direct pour les données non exportables via WP
mysqldump trottistore_wp \
  wp_users wp_usermeta \
  wp_wc_customer_lookup \
  wp_wc_order_stats \
  --single-transaction > wp_data.sql
```

### Cartographie des données

| Donnée WooCommerce | Table PostgreSQL cible | Transformation |
|---|---|---|
| `wp_posts` (product) | `ecommerce.products` | Parsing post_content, extraction meta |
| `wp_postmeta` (specs) | `ecommerce.products.specs` | Clé-valeur → JSONB |
| `wp_terms` (categories) | `ecommerce.categories` | Arbre plat → parent_id |
| `wp_users` + `wp_usermeta` | `shared.users` | Merge, nettoyage |
| `wp_wc_orders` | `ecommerce.orders` | Mapping statuts |
| Media library | MinIO | Download + upload |
| Coupons | `ecommerce.coupons` | Mapping types |

## 7.3 Phase 2 — Import (Semaines 3-4)

### Script de migration

```typescript
// scripts/migrate/index.ts
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse';

class WooCommerceMigrator {
  private prisma = new PrismaClient();
  private stats = { users: 0, products: 0, orders: 0, images: 0, errors: [] };

  async run() {
    console.log('🚀 Début de la migration WooCommerce → TrottiStore');

    // Ordre important (dépendances)
    await this.migrateUsers();
    await this.migrateBrands();
    await this.migrateCategories();
    await this.migrateProducts();
    await this.migrateProductImages();
    await this.migrateOrders();
    await this.migrateCoupons();
    await this.migrateReviews();

    // Recalcul des compteurs
    await this.recalculateCounters();

    // Rapport
    console.log('✅ Migration terminée', this.stats);
  }

  private async migrateUsers() {
    // Import des utilisateurs WooCommerce
    // Mapping des rôles WP → rôles TrottiStore
    // customer → CLIENT, shop_manager → MANAGER, administrator → ADMIN
    // Mot de passe : forcer un reset (les hash WP et bcrypt sont incompatibles)
  }

  private async migrateProducts() {
    // Parsing du XML WooCommerce
    // Extraction des attributs produit → specs JSONB
    // Calcul du slug unique
    // Création des relations catégories
  }
}
```

### Migration SEO

```typescript
// Préservation des URLs existantes
const URL_MAPPINGS = {
  // WooCommerce → Nouveau site
  '/product/{slug}/': '/produits/{slug}',
  '/product-category/{slug}/': '/categories/{slug}',
  '/shop/': '/produits',
  '/my-account/': '/mon-compte',
  '/cart/': '/panier',
  '/checkout/': '/checkout',
};

// Génération du fichier de redirections 301
// → Intégré dans le Caddyfile
```

## 7.4 Phase 3 — Fonctionnement parallèle (Semaines 5-6)

- Les deux sites fonctionnent simultanément
- Les commandes sont prises sur l'ancien site WooCommerce
- Le nouveau site est accessible sur staging.trottistore.fr pour tests
- Tests manuels par l'équipe TrottiStore : navigation, commande test, SAV
- Corrections et ajustements

## 7.5 Phase 4 — Bascule DNS (Semaine 7)

```
Jour J-2 : Dernier sync des données WooCommerce → PostgreSQL
Jour J-1 : Tests finaux, validation métier
Jour J   : Bascule DNS
  - 08:00 : WooCommerce en maintenance
  - 08:15 : Sync delta (nouvelles commandes depuis J-2)
  - 08:30 : Test smoke sur le nouveau site
  - 09:00 : Bascule DNS (TTL abaissé à 300s 48h avant)
  - 09:15 : Vérification propagation DNS
  - 09:30 : Test commande réelle
  - 10:00 : Monitoring renforcé (4h)
  - 14:00 : Validation finale

Plan de rollback :
  - Si problème critique avant 12:00 : rollback DNS vers WooCommerce
  - Si problème mineur : hotfix sur le nouveau site
  - WooCommerce reste opérationnel pendant 30 jours (cold standby)
```

---

# 8 — Estimation & Roadmap

## 8.1 Hypothèses

- **Équipe** : 1 développeur fullstack (senior) à temps plein
- **Méthodologie** : Sprints de 2 semaines
- **Vélocité estimée** : 8-10 story points/sprint
- **1 story point** ≈ 1 jour de développement effectif
- **Buffer** : 20% par sprint pour bugs, imprévus, DevOps

## 8.2 Roadmap détaillée — 14 sprints (27 semaines)

### Phase 1 — Fondations (Sprints 1-3, 6 semaines)

**Sprint 1 — Infrastructure & Setup**
| Tâche | Points | Durée |
|---|---|---|
| Monorepo Turborepo + configuration | 2 | 2j |
| Docker Compose (PostgreSQL, Redis, ClickHouse, MinIO) | 2 | 2j |
| CI/CD GitHub Actions (lint, test, build) | 2 | 2j |
| Prisma setup + schéma shared (auth) | 2 | 2j |
| Caddy configuration + TLS | 1 | 1j |
| **Total** | **9** | |

**Sprint 2 — Auth & Design System**
| Tâche | Points | Durée |
|---|---|---|
| Service auth (register, login, refresh, logout) | 3 | 3j |
| JWT RS256 + middleware Fastify | 2 | 2j |
| RBAC (rôles + permissions) | 2 | 2j |
| Next.js setup + design system (Tailwind + Radix) | 2 | 2j |
| **Total** | **9** | |

**Sprint 3 — Catalogue produits**
| Tâche | Points | Durée |
|---|---|---|
| Service e-commerce : CRUD produits | 3 | 3j |
| CRUD catégories + marques | 2 | 2j |
| Upload images (MinIO) + redimensionnement | 2 | 2j |
| Frontend : pages catalogue (SSR + ISR) | 2 | 2j |
| Recherche full-text (pg_trgm) | 1 | 1j |
| **Total** | **10** | |

### Phase 2 — E-commerce core (Sprints 4-6, 6 semaines)

**Sprint 4 — Panier & Checkout**
| Tâche | Points | Durée |
|---|---|---|
| Panier (state client + sync serveur) | 3 | 3j |
| Tunnel de commande (3 étapes) | 3 | 3j |
| Gestion adresses (CRUD) | 2 | 2j |
| Calcul TVA + frais de port | 1 | 1j |
| **Total** | **9** | |

**Sprint 5 — Paiements**
| Tâche | Points | Durée |
|---|---|---|
| Intégration Stripe (CB, Apple Pay, Google Pay, Link) | 3 | 3j |
| Webhooks Stripe + confirmation commande | 2 | 2j |
| Paiements manuels (virement, espèces, chèque) | 2 | 2j |
| Facilités 2x/3x/4x (échéancier + jobs BullMQ) | 2 | 2j |
| **Total** | **9** | |

**Sprint 6 — Commandes & Livraison**
| Tâche | Points | Durée |
|---|---|---|
| Gestion commandes (admin : liste, détail, statuts) | 3 | 3j |
| Intégration Colissimo (étiquettes, tracking) | 2 | 2j |
| Emails transactionnels (Brevo) | 2 | 2j |
| Coupons / codes promo | 2 | 2j |
| **Total** | **9** | |

### Phase 3 — CRM & Analytics (Sprints 7-9, 6 semaines)

**Sprint 7 — CRM : Profils & Timeline**
| Tâche | Points | Durée |
|---|---|---|
| Service CRM : profil 360° | 3 | 3j |
| Timeline client (événements automatiques) | 2 | 2j |
| Segmentation dynamique (job batch) | 2 | 2j |
| Frontend admin : fiche client | 2 | 2j |
| **Total** | **9** | |

**Sprint 8 — CRM : Fidélité & Campagnes**
| Tâche | Points | Durée |
|---|---|---|
| Programme de fidélité (points, tiers, récompenses) | 3 | 3j |
| Campagnes email (CRUD + envoi via Brevo) | 3 | 3j |
| SMS notifications (Twilio) | 1 | 1j |
| Frontend admin : campagnes + fidélité | 2 | 2j |
| **Total** | **9** | |

**Sprint 9 — Analytics**
| Tâche | Points | Durée |
|---|---|---|
| Tracker JS frontend | 2 | 2j |
| Pipeline ingestion ClickHouse (BullMQ batch) | 2 | 2j |
| API KPIs (5 dashboards) | 3 | 3j |
| WebSocket temps réel | 1 | 1j |
| Grafana dashboards (configuration) | 2 | 2j |
| **Total** | **10** | |

### Phase 4 — SAV (Sprints 10-11, 4 semaines)

**Sprint 10 — SAV : Tickets**
| Tâche | Points | Durée |
|---|---|---|
| Service SAV : CRUD tickets + workflow statuts | 3 | 3j |
| Messages / échanges + attachments | 2 | 2j |
| Timeline automatique | 1 | 1j |
| Devis automatique | 2 | 2j |
| Frontend admin : gestion tickets | 2 | 2j |
| **Total** | **10** | |

**Sprint 11 — SAV : Planning & SLA**
| Tâche | Points | Durée |
|---|---|---|
| Planning techniciens (créneaux, assignation) | 3 | 3j |
| Gestion pièces détachées | 2 | 2j |
| SLA monitoring + alertes | 2 | 2j |
| Interface client : suivi tickets | 2 | 2j |
| **Total** | **9** | |

### Phase 5 — Migration & Polish (Sprints 12-14, 5 semaines)

**Sprint 12 — Migration WooCommerce**
| Tâche | Points | Durée |
|---|---|---|
| Scripts d'extraction WooCommerce | 2 | 2j |
| Scripts d'import PostgreSQL | 3 | 3j |
| Migration images → MinIO | 1 | 1j |
| Migration SEO (redirections 301) | 1 | 1j |
| Tests de migration (données réelles) | 2 | 2j |
| **Total** | **9** | |

**Sprint 13 — Frontend polish & SEO**
| Tâche | Points | Durée |
|---|---|---|
| Responsive mobile (tests 375px → 1440px) | 2 | 2j |
| SEO : meta, JSON-LD, sitemap, robots.txt | 2 | 2j |
| Performance : Lighthouse > 90 mobile | 2 | 2j |
| Accessibilité WCAG 2.1 AA | 2 | 2j |
| Avis produits + Google Reviews widget | 1 | 1j |
| **Total** | **9** | |

**Sprint 14 — Bascule & Stabilisation**
| Tâche | Points | Durée |
|---|---|---|
| Bascule DNS + monitoring | 2 | 2j |
| Tests end-to-end (commande réelle) | 2 | 2j |
| Monitoring (Prometheus + Grafana + alertes) | 2 | 2j |
| Documentation technique (API, déploiement) | 2 | 2j |
| Bug fixes + ajustements | 2 | 2j |
| **Total** | **10** | |

## 8.3 Résumé chronologique

```
     Mois 1        Mois 2        Mois 3        Mois 4
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Sprint 1-2 │  Sprint 3-4 │  Sprint 5-6 │  Sprint 7-8 │
│  Infra +    │  Catalogue  │  Paiements  │  CRM        │
│  Auth       │  + Panier   │  + Commands │  + Fidélité │
└─────────────┴─────────────┴─────────────┴─────────────┘

     Mois 5        Mois 6        Mois 7
┌─────────────┬─────────────┬─────────────┐
│ Sprint 9-10 │ Sprint 11-12│ Sprint 13-14│
│ Analytics   │  SAV +      │  Polish +   │
│ + SAV       │  Migration  │  Bascule    │
└─────────────┴─────────────┴─────────────┘
```

## 8.4 Coûts infrastructure

| Service | Coût mensuel | Notes |
|---|---|---|
| Hetzner VPS CX31 (prod) | ~12€ | 4 vCPU, 8 Go RAM, 80 Go SSD |
| Hetzner VPS CX21 (staging) | ~5€ | 2 vCPU, 4 Go RAM |
| Domaine + DNS | ~1€ | trottistore.fr |
| Brevo (email) | 0€ | 300 emails/jour gratuits |
| Twilio (SMS) | ~5€ | ~80 SMS/mois |
| GitHub | 0€ | Public ou free tier |
| **Total** | **~23€/mois** | |

*Note : Pas de S3, pas de Vercel, pas de services cloud managés. Tout est self-hosted sur Hetzner, ce qui maintient les coûts au minimum.*

---

# 9 — ADRs (Architecture Decision Records)

## ADR-001 : Microservices pour une TPE

**Statut** : Accepté
**Date** : Mars 2026

### Contexte
TrottiStore est une TPE de 1-5 employés. La sagesse conventionnelle recommande de commencer par un monolithe pour les petites équipes. Cependant, TrottiStore a des domaines métier clairement découpés (e-commerce, CRM, analytics, SAV) avec des cycles de vie et des exigences de performance très différents.

### Décision
Adopter une architecture microservices "light" avec les garde-fous suivants :
- Monorepo (un seul dépôt, code partagé)
- Docker Compose (pas de Kubernetes)
- Un seul PostgreSQL (schémas logiques séparés)
- Communication interne HTTP + Redis Pub/Sub (pas de service mesh)
- Pas de API Gateway complexe (Caddy fait le routing)

### Conséquences positives
- Découplage : un crash du service analytics n'affecte pas le checkout
- Déploiement indépendant : rollback isolé par service
- Scalabilité ciblée : le service analytics peut avoir plus de RAM
- Préparation à la croissance sans refactoring architectural majeur

### Conséquences négatives
- Complexité opérationnelle supérieure à un monolithe
- Observabilité distribuée (corrélation des logs entre services)
- Latence réseau inter-services (négligeable en localhost Docker)
- Debugging plus complexe (traces distribuées)

### Plan d'évolution
Si la complexité microservices s'avère excessive, le monorepo permet facilement de fusionner les services en un monolithe Fastify multi-module sans réécrire le code métier. Les schémas Prisma et les types partagés restent identiques.

---

## ADR-002 : Zéro intermédiaire de paiement pour les facilités

**Statut** : Accepté
**Date** : Mars 2026

### Contexte
TrottiStore propose des facilités de paiement (2x/3x/4x sans frais). Les solutions du marché (Alma, Oney, Klarna) prélèvent 2-5% de commission par transaction. Pour une TPE avec des marges serrées sur les trottinettes, ces frais sont significatifs.

### Décision
Implémenter un système de facilités de paiement interne :
- Le client paie la première échéance immédiatement via Stripe
- Les échéances suivantes sont prélevées automatiquement sur la CB enregistrée (via Stripe)
- Un job BullMQ quotidien gère les prélèvements et les relances
- Le risque d'impayé est porté par TrottiStore (pas d'intermédiaire)

### Conséquences positives
- 0% de commission sur les facilités (vs 2-5% avec Alma/Klarna)
- Contrôle total sur l'expérience client (relances, UX)
- Pas de dépendance à un tiers pour un processus critique
- Flexibilité totale (offrir du 4x à partir de 1000€, pas de minimum imposé)

### Conséquences négatives
- Risque d'impayé porté par TrottiStore (~2-3% estimé)
- Complexité de développement (gestion des échéances, relances, contentieux)
- Pas de scoring de crédit (Alma vérifie la solvabilité)
- Obligation de gérer les cas litigieux en interne

### Mitigation du risque
- Facilités réservées aux commandes > 200€
- CB obligatoire (pas de virement en facilité)
- Relance automatique à J+3 puis J+7 en cas d'échec
- Limite de 3 tentatives avant alerte manager
- Possibilité d'ajouter Alma/Klarna en complément si le taux d'impayé dépasse 5%

---

## ADR-003 : PostgreSQL comme BDD principale vs MongoDB

**Statut** : Accepté
**Date** : Mars 2026

### Contexte
Le choix de la base de données principale est structurant pour l'ensemble du système. MongoDB est souvent choisi pour les projets JavaScript/TypeScript en raison de la similitude entre documents JSON et objets JavaScript.

### Décision
Utiliser PostgreSQL 16 comme base de données unique pour toutes les données transactionnelles.

### Arguments pour PostgreSQL
1. **Relations fortes** : Un e-commerce est intrinsèquement relationnel (produit ↔ catégories ↔ commandes ↔ clients ↔ paiements). PostgreSQL gère ces relations nativement via des JOINs performants.
2. **JSONB** : PostgreSQL offre un stockage JSONB performant pour les données semi-structurées (specs produits, metadata), combinant le meilleur du relationnel et du document.
3. **Transactions ACID** : Essentielles pour les paiements et la comptabilité. MongoDB a ajouté les transactions multi-documents en v4.0 mais elles sont moins matures.
4. **Conformité légale** : Le FEC (Fichier des Écritures Comptables) exige une traçabilité rigoureuse que les transactions SERIALIZABLE de PostgreSQL garantissent.
5. **Full-text search** : `tsvector` + `pg_trgm` couvrent les besoins de recherche produit sans Elasticsearch.
6. **Schémas logiques** : `CREATE SCHEMA` permet d'isoler les données par service sans serveur séparé.

### Arguments contre MongoDB
1. Pas de JOINs natifs (lookups $lookup sont lents)
2. Denormalization nécessaire (duplication de données, risque d'incohérence)
3. Transactions multi-documents moins performantes
4. Atlas Search (pour la recherche) est une feature cloud payante
5. Écosystème Prisma : le support MongoDB est moins mature que PostgreSQL

---

## ADR-004 : JWT stateless vs sessions serveur

**Statut** : Accepté
**Date** : Mars 2026

### Contexte
L'authentification peut être gérée via des tokens JWT stateless ou des sessions stockées côté serveur (Redis/PostgreSQL). Les deux approches ont des trade-offs.

### Décision
JWT RS256 pour les access tokens (15 minutes) + refresh tokens stockés en BDD (7 jours, rotation à chaque utilisation).

### Pourquoi JWT pour l'access token
- **Stateless** : Chaque microservice peut vérifier le token avec la clé publique, sans appel à un service central
- **Performance** : Pas de lookup BDD/Redis à chaque requête API
- **Scalabilité** : Fonctionne avec N services sans partage d'état
- **RS256** : La clé privée ne quitte jamais le service auth ; les autres services n'ont que la clé publique

### Pourquoi des refresh tokens en BDD
- **Révocation** : Un JWT ne peut pas être révoqué avant expiration. Le refresh token en BDD permet de couper l'accès immédiatement
- **Rotation** : Détection de vol de token (si un token déjà utilisé est réutilisé, tous les tokens sont révoqués)
- **Durée de vie courte du JWT** : 15 minutes limitent la fenêtre d'exploitation d'un token volé

### Alternative considérée : sessions Redis
Les sessions Redis (cookie → session ID → Redis → données user) sont plus simples et permettent la révocation instantanée. Cependant, elles nécessitent un lookup Redis à CHAQUE requête, créant un point de contention dans une architecture microservices.

---

## ADR-005 : ClickHouse pour analytics vs PostgreSQL seul

**Statut** : Accepté
**Date** : Mars 2026

### Contexte
Le module analytics doit stocker et requêter des événements (page views, clics, conversions) avec des agrégations sur des périodes variables (jour, semaine, mois, 90 jours).

### Décision
Utiliser ClickHouse comme base de données dédiée aux analytics, séparée de PostgreSQL.

### Arguments pour ClickHouse
1. **Performances** : Une requête `SELECT count(), source FROM events WHERE date BETWEEN ... GROUP BY source` sur 10 millions de lignes prend <100ms dans ClickHouse vs >5s dans PostgreSQL
2. **Compression** : Le stockage en colonnes compresse les données analytics (très répétitives) de 10:1, réduisant l'espace disque
3. **Vues matérialisées** : Les agrégations pré-calculées (page views par jour, conversions par source) sont mises à jour automatiquement à l'insertion
4. **TTL** : Suppression automatique des données anciennes (2 ans) sans maintenance

### Arguments contre (rester sur PostgreSQL)
1. Un service supplémentaire à opérer
2. ~512 Mo de RAM minimum
3. Pas de transactions ACID (pas besoin pour l'analytics)
4. Apprentissage d'un nouveau SQL dialect

### Compromis
Pour les premiers mois (< 100k events/mois), PostgreSQL suffit. ClickHouse est provisionné dans le Docker Compose mais peut être activé plus tard. Le code applicatif utilise une abstraction (`AnalyticsStore`) qui permet de basculer entre PostgreSQL et ClickHouse via configuration.

---

# 10 — Audit Open Source

## 10.1 Méthodologie

Chaque projet open source a été évalué selon 6 critères :
- **Maturité** : Âge, nombre de versions, stabilité API
- **Communauté** : Stars GitHub, contributeurs, fréquence de commits
- **Documentation** : Qualité, exhaustivité, exemples
- **Extensibilité** : Plugins, API, personnalisation
- **Stack compatibility** : Compatibilité avec notre stack (Node.js, PostgreSQL, React)
- **Maintenance** : Activité récente, temps de réponse aux issues

Notation : ⭐ (1) à ⭐⭐⭐⭐⭐ (5)

## 10.2 E-commerce

### Medusa.js

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐ | V2 stable, utilisé en production |
| Communauté | ⭐⭐⭐⭐⭐ | 27k stars, très actif |
| Documentation | ⭐⭐⭐⭐ | Bonne, mais en évolution rapide |
| Extensibilité | ⭐⭐⭐⭐⭐ | Architecture modulaire, plugins |
| Stack compat. | ⭐⭐⭐⭐⭐ | Node.js, PostgreSQL natif |
| Maintenance | ⭐⭐⭐⭐⭐ | Commits quotidiens, equipe dédiée |

**Verdict** : Excellent candidat comme base e-commerce. V2 avec architecture modulaire permettrait de remplacer notre service e-commerce custom. À surveiller pour une future intégration.

### Vendure

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐ | V2+, production-ready |
| Communauté | ⭐⭐⭐⭐ | 6k stars |
| Documentation | ⭐⭐⭐⭐⭐ | Excellente |
| Extensibilité | ⭐⭐⭐⭐ | Plugins TypeScript |
| Stack compat. | ⭐⭐⭐⭐ | NestJS (différent de Fastify) |
| Maintenance | ⭐⭐⭐⭐ | Actif |

**Verdict** : Très mature et bien documenté, mais basé sur NestJS (ADR-002 rejette NestJS pour la complexité). Bonne référence architecturale.

### Saleor

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐⭐ | Plusieurs années, enterprise-grade |
| Communauté | ⭐⭐⭐⭐ | 20k stars |
| Documentation | ⭐⭐⭐⭐ | Bonne |
| Extensibilité | ⭐⭐⭐⭐ | GraphQL, webhooks |
| Stack compat. | ⭐⭐ | Python/Django (incompatible) |
| Maintenance | ⭐⭐⭐⭐ | Actif |

**Verdict** : Excellent e-commerce headless mais en Python. Non retenu pour des raisons de stack, mais inspirant pour l'architecture.

### Bagisto

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐ | Stable mais moins connu |
| Communauté | ⭐⭐⭐ | 15k stars |
| Documentation | ⭐⭐⭐ | Correcte |
| Extensibilité | ⭐⭐⭐ | Modules Laravel |
| Stack compat. | ⭐ | PHP/Laravel (incompatible) |
| Maintenance | ⭐⭐⭐ | Actif mais rythme moyen |

**Verdict** : Non retenu (PHP), mais intéressant comme référence fonctionnelle e-commerce.

## 10.3 ERP / Comptabilité

### ERPNext

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐⭐ | 15+ ans, enterprise-grade |
| Communauté | ⭐⭐⭐⭐⭐ | 20k+ stars |
| Documentation | ⭐⭐⭐⭐ | Exhaustive |
| Extensibilité | ⭐⭐⭐⭐⭐ | API REST, webhooks, plugins |
| Stack compat. | ⭐⭐ | Python/Frappe (incompatible) |
| Maintenance | ⭐⭐⭐⭐⭐ | Très actif, releases régulières |

**Verdict** : Le standard open source pour l'ERP. Trop lourd pour TrottiStore (ERP complet vs modules ciblés), mais excellent comme référence pour le module comptabilité futur.

### Dolibarr

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐⭐ | 20+ ans |
| Communauté | ⭐⭐⭐⭐ | 5k stars, communauté FR active |
| Documentation | ⭐⭐⭐ | En français, mais dispersée |
| Extensibilité | ⭐⭐⭐ | Modules PHP |
| Stack compat. | ⭐ | PHP (incompatible) |
| Maintenance | ⭐⭐⭐⭐ | Actif |

**Verdict** : Référence française pour la gestion commerciale. Le module comptabilité (FEC, TVA) est une excellente source d'inspiration pour notre futur Module C.

### Akaunting

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐ | Stable |
| Communauté | ⭐⭐⭐⭐ | 8k stars |
| Documentation | ⭐⭐⭐ | Correcte |
| Extensibilité | ⭐⭐⭐ | Apps marketplace |
| Stack compat. | ⭐ | PHP/Laravel (incompatible) |
| Maintenance | ⭐⭐⭐ | Actif |

**Verdict** : Comptabilité open source moderne. Interface inspirante pour le futur dashboard financier.

### Crater

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐ | Stable mais plus jeune |
| Communauté | ⭐⭐⭐⭐ | 8k stars |
| Documentation | ⭐⭐⭐ | Basique |
| Extensibilité | ⭐⭐ | Limité |
| Stack compat. | ⭐ | PHP/Laravel (incompatible) |
| Maintenance | ⭐⭐ | Ralentissement récent |

**Verdict** : Facturation simple et efficace. Référence pour l'UX de création de facture.

## 10.4 CRM

### Twenty

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐ | Jeune mais prometteur |
| Communauté | ⭐⭐⭐⭐⭐ | 23k stars, hype |
| Documentation | ⭐⭐⭐ | En construction |
| Extensibilité | ⭐⭐⭐⭐ | API GraphQL, webhooks |
| Stack compat. | ⭐⭐⭐⭐ | React + Node.js + PostgreSQL |
| Maintenance | ⭐⭐⭐⭐⭐ | Très actif (YC-backed) |

**Verdict** : Alternative open source à Salesforce. Stack compatible. La timeline client et la fiche contact sont d'excellentes inspirations pour notre module CRM. Trop générique pour être utilisé tel quel (pas de fidélité, pas de segmentation e-commerce).

### Chatwoot

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐ | Production-ready |
| Communauté | ⭐⭐⭐⭐⭐ | 22k stars |
| Documentation | ⭐⭐⭐⭐ | Bonne |
| Extensibilité | ⭐⭐⭐⭐ | Webhooks, API, bots |
| Stack compat. | ⭐⭐ | Ruby on Rails (incompatible) |
| Maintenance | ⭐⭐⭐⭐⭐ | Très actif |

**Verdict** : Excellent pour le chat/support. Pourrait remplacer Crisp. Non retenu car Ruby on Rails (stack différente), mais Crisp est préféré pour sa simplicité d'intégration.

## 10.5 Analytics

### Plausible

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐ | Stable |
| Communauté | ⭐⭐⭐⭐⭐ | 21k stars |
| Documentation | ⭐⭐⭐⭐ | Excellente |
| Extensibilité | ⭐⭐⭐ | API, goals, funnels |
| Stack compat. | ⭐⭐ | Elixir/ClickHouse |
| Maintenance | ⭐⭐⭐⭐⭐ | Très actif |

**Verdict** : Excellente alternative à GA4 (privacy-first). Pourrait compléter notre analytics custom pour le trafic web. Basé sur ClickHouse, ce qui valide notre choix de ClickHouse.

### Metabase

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐⭐ | Enterprise-grade |
| Communauté | ⭐⭐⭐⭐⭐ | 40k stars |
| Documentation | ⭐⭐⭐⭐⭐ | Excellente |
| Extensibilité | ⭐⭐⭐⭐ | SQL natif, embedding |
| Stack compat. | ⭐⭐⭐ | Java (indépendant) |
| Maintenance | ⭐⭐⭐⭐⭐ | Très actif |

**Verdict** : Le standard open source pour la BI. Pourrait être déployé en complément de Grafana pour des analyses ad-hoc par l'équipe non technique. Se connecte nativement à PostgreSQL et ClickHouse.

### Grafana

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐⭐ | Standard de l'industrie |
| Communauté | ⭐⭐⭐⭐⭐ | 66k stars |
| Documentation | ⭐⭐⭐⭐⭐ | Exhaustive |
| Extensibilité | ⭐⭐⭐⭐⭐ | Plugins, dashboards, alertes |
| Stack compat. | ⭐⭐⭐⭐⭐ | Data source agnostique |
| Maintenance | ⭐⭐⭐⭐⭐ | Releases mensuelles |

**Verdict** : Retenu pour le monitoring et les dashboards opérationnels. Se connecte à Prometheus (métriques), Loki (logs) et ClickHouse (analytics métier).

## 10.6 POS (Point of Sale)

### NexoPOS

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐ | Stable mais niche |
| Communauté | ⭐⭐ | 2k stars |
| Documentation | ⭐⭐ | Basique |
| Extensibilité | ⭐⭐ | Modules PHP |
| Stack compat. | ⭐ | PHP/Laravel (incompatible) |
| Maintenance | ⭐⭐⭐ | Actif mais petit team |

**Verdict** : Non retenu (PHP), mais inspirant pour le futur POS en boutique. L'interface de caisse et la gestion des espèces sont bien pensées.

## 10.7 Auth

### Lucia

| Critère | Note | Détail |
|---|---|---|
| Maturité | ⭐⭐⭐⭐ | V3 stable |
| Communauté | ⭐⭐⭐⭐ | 10k stars |
| Documentation | ⭐⭐⭐⭐⭐ | Excellente, exemples Next.js |
| Extensibilité | ⭐⭐⭐ | Adapters BDD |
| Stack compat. | ⭐⭐⭐⭐⭐ | Node.js natif, PostgreSQL adapter |
| Maintenance | ⭐⭐⭐⭐ | Actif |

**Verdict** : Excellente bibliothèque d'auth pour Node.js. Pourrait simplifier l'implémentation auth vs un JWT custom. Non retenu car l'auth JWT RS256 est déjà conçue et offre plus de contrôle sur la rotation des tokens et la détection de vol.

## 10.8 Autres outils évalués

| Projet | Catégorie | Stars | Stack | Verdict |
|---|---|---|---|---|
| **Strapi** | CMS headless | 65k | Node.js | Trop CMS-oriented pour du e-commerce |
| **Directus** | BaaS | 28k | Node.js | Backend générique, pas assez spécialisé |
| **Supabase** | BaaS | 75k | PostgreSQL | Excellent mais cloud-first |
| **Appwrite** | BaaS | 46k | Node.js | Alternative à Supabase, mêmes limites |
| **n8n** | Workflow | 50k | Node.js | Pourrait automatiser des workflows CRM |
| **Trigger.dev** | Job scheduler | 10k | Node.js | Alternative à BullMQ, plus features |
| **Cal.com** | Scheduling | 33k | Next.js | Inspiration pour le planning techniciens |
| **Payload CMS** | CMS | 27k | Next.js | Bon CMS mais pas e-commerce |
| **Ghost** | Blog | 47k | Node.js | Pour le blog TrottiStore (si besoin) |
| **Umami** | Analytics | 23k | Next.js | Alternative à Plausible, même concept |
| **PostHog** | Product analytics | 22k | Python/TS | Feature flags + analytics, intéressant |
| **Typesense** | Search | 21k | C++ | Alternative à pg_trgm si besoin de search avancée |
| **Meilisearch** | Search | 48k | Rust | Idem, excellent pour l'instant search |
| **Coolify** | PaaS | 35k | Node.js | Alternative à Docker Compose pour le déploiement |
| **Dozzle** | Log viewer | 7k | Go | Visualisation logs Docker simple |
| **Uptime Kuma** | Monitoring | 60k | Node.js | Monitoring uptime simple et efficace |
| **Lago** | Billing | 7k | Ruby | Facturation open source (pour référence) |
| **InvoiceNinja** | Invoicing | 8k | PHP | Facturation (référence pour Module C) |
| **Rallly** | Scheduling | 4k | Next.js | Planification (inspiration UX) |

## 10.9 Recommandations

### À intégrer immédiatement
- **Grafana + Prometheus + Loki** : Monitoring et observabilité (déjà dans la stack)
- **Uptime Kuma** : Monitoring uptime simple (1 conteneur Docker supplémentaire)

### À considérer en phase 2
- **Medusa.js** : Si le service e-commerce custom devient trop lourd à maintenir, migrer vers Medusa V2
- **Metabase** : Pour les analyses ad-hoc par l'équipe non technique
- **n8n** : Pour automatiser les workflows CRM complexes (séquences multi-étapes)
- **Meilisearch** : Si la recherche produit via pg_trgm devient insuffisante

### Références architecturales (ne pas intégrer, mais s'inspirer)
- **Twenty** : Fiche client CRM, timeline, kanban
- **Dolibarr** : Module comptabilité FEC-compatible
- **Cal.com** : Interface de planning techniciens
- **NexoPOS** : Interface de caisse pour paiements boutique

---

# Annexe A — Glossaire

| Terme | Définition |
|---|---|
| **ADR** | Architecture Decision Record — document de décision architecturale |
| **BFF** | Backend for Frontend — couche d'API spécifique au frontend |
| **BullMQ** | Bibliothèque Node.js de queues de tâches basée sur Redis |
| **CRM** | Customer Relationship Management |
| **CSP** | Content Security Policy — en-tête HTTP de sécurité |
| **FEC** | Fichier des Écritures Comptables (obligation légale française) |
| **ISR** | Incremental Static Regeneration (Next.js) |
| **JWT** | JSON Web Token |
| **LPF** | Livre des Procédures Fiscales |
| **LTV** | Lifetime Value — valeur vie client |
| **NPS** | Net Promoter Score |
| **OLAP** | Online Analytical Processing |
| **OLTP** | Online Transaction Processing |
| **PSP** | Payment Service Provider |
| **RBAC** | Role-Based Access Control |
| **RSC** | React Server Components |
| **SAV** | Service Après-Vente |
| **SLA** | Service Level Agreement |
| **SSR** | Server-Side Rendering |
| **TPE** | Très Petite Entreprise |
| **TVA** | Taxe sur la Valeur Ajoutée |

---

# Annexe B — Références

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Fastify Documentation](https://www.fastify.io/docs/latest/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL 16 Documentation](https://www.postgresql.org/docs/16/)
- [Redis Documentation](https://redis.io/docs/)
- [ClickHouse Documentation](https://clickhouse.com/docs)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Brevo API Reference](https://developers.brevo.com/)
- [Twilio API Reference](https://www.twilio.com/docs)
- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [RGPD — CNIL Guide](https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on)
- [FEC — Article A.47 A-1 du LPF](https://www.legifrance.gouv.fr/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

---

*Document généré en mars 2026. Dernière mise à jour : 22 mars 2026.*
*Pour toute question, contacter l'équipe technique à dev@trottistore.fr.*
