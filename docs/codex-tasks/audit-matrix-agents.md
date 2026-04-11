# Audit Matrix — Agent Split

## Objectif

Découper l'audit complet du projet en lots assez petits pour rester fiables et ne pas exploser les limites de contexte/token. Un agent ne couvre qu'un domaine et ne lit que les fichiers nécessaires.

## Règles

- Un agent = un domaine
- Lire seulement les fichiers du domaine
- Ne pas charger le repo entier
- Sortie courte et structurée:
  - scope audité
  - findings
  - non-findings
  - angles non vérifiés
  - actions recommandées
- Si un finding touche un domaine voisin, le noter sans auditer tout le domaine voisin
- Citer uniquement les fichiers utiles
- Limite recommandée par agent:
  - 5 findings max
  - 5 non-findings max
  - 5 angles non vérifiés max

## Agents

### Agent 1 — Security / Auth / RBAC

**Scope**
- `services/*/src/routes`
- `services/*/src/plugins/auth*`
- `apps/web/src/lib/api.ts`

**Focus**
- auth
- session
- reset password
- role checks
- ownership
- IDOR
- public bypass

**Output**
- findings `authz/authn`

### Agent 2 — Stock / Orders / Checkout / SAV

**Scope**
- `services/ecommerce/src/routes/orders`
- `services/ecommerce/src/routes/checkout`
- `services/ecommerce/src/routes/stock`
- `services/sav/src/routes/tickets`

**Focus**
- stock mutations
- reserves
- refunds
- cancel
- races
- idempotence

**Output**
- findings `stock integrity`

### Agent 3 — CRM / Cron / Newsletter

**Scope**
- `services/crm/src/routes/*`
- `services/crm/src/index.ts`

**Focus**
- cron
- triggers
- newsletter
- public endpoints
- anti-enumeration

**Output**
- findings `crm/public abuse`

### Agent 4 — Build / Run / Deploy / Infra

**Scope**
- root `package.json`
- service `package.json`
- Dockerfiles
- `.github/workflows`
- `infra/*`

**Focus**
- build
- start
- deploy
- migrations
- seed
- env

**Output**
- findings `build/run/deploy`

### Agent 5 — DB / Scripts / Data Integrity

**Scope**
- `packages/database/prisma`
- `scripts/*`

**Focus**
- schema
- constraints
- indexes
- seed/demo
- idempotence
- data repair

**Output**
- findings `data lifecycle`

### Agent 6 — Frontend / UX / Accessibility

**Scope**
- `apps/web/src/app`
- `apps/web/src/components`
- `apps/web/src/lib`

**Focus**
- critical journeys
- forms
- errors
- accessibility
- mobile

**Output**
- findings `frontend/accessibility`

### Agent 7 — SEO / Performance

**Scope**
- `apps/web`
- metadata
- sitemap/robots

**Focus**
- SEO
- rendering
- performance
- discoverability

**Output**
- findings `seo/perf`

### Agent 8 — Privacy / Consent / Legal / Trust

**Scope**
- public pages
- legal pages
- newsletter/contact flows

**Focus**
- consent
- privacy
- claims
- trust signals

**Output**
- findings `legal/privacy`

### Agent 9 — Email / Messaging

**Scope**
- notification code
- newsletter
- auth emails
- order emails

**Focus**
- deliverability
- transactional correctness
- fallback behavior

**Output**
- findings `email/messaging`

### Agent 10 — Reliability / Load / Ops

**Scope**
- health
- metrics
- logging
- workflows
- scripts

**Focus**
- monitoring
- backup/restore
- runbooks
- load/resilience

**Output**
- findings `ops/reliability`

### Agent 11 — User Testing

**Scope**
- critical user journeys only

**Focus**
- representative testers
- task success
- trust clarity
- recovery

**Output**
- findings `user testing`

## Ordre recommandé

1. Agent 2 — Stock / Orders / Checkout / SAV
2. Agent 1 — Security / Auth / RBAC
3. Agent 4 — Build / Run / Deploy / Infra
4. Agent 5 — DB / Scripts / Data Integrity
5. Agent 3 — CRM / Cron / Newsletter
6. Agent 8 — Privacy / Consent / Legal / Trust
7. Agent 9 — Email / Messaging
8. Agent 6 — Frontend / UX / Accessibility
9. Agent 7 — SEO / Performance
10. Agent 10 — Reliability / Load / Ops
11. Agent 11 — User Testing

## Exécution sans exploser les tokens

- Lancer 1 agent à la fois
- Monter à 2 agents max seulement si les scopes sont totalement disjoints
- Faire l'agrégation finale après les audits, pas pendant
- Éviter les résumés globaux du repo dans chaque run
- Préférer des lots atomiques avec références fichiers précises

## Format de sortie attendu par agent

```md
## Scope

- fichiers lus
- hypothèses
- exclusions

## Findings

1. P1 ...
2. P2 ...

## Non-findings

- ...

## Angles non vérifiés

- ...

## Actions

- quick wins
- fixes structurants
- risques acceptés
```
