# Project Operating System Playbook

> Version: 2026-04-09  
> Usage: copier ce document dans un nouveau projet et adapter les sections `À personnaliser`.

---

## 1) Objectif

Ce playbook définit un **système de travail reproductible** pour livrer vite, proprement, sans régressions.

Ce qu'il garantit:
- qualité de code élevée
- feedback loop rapide (dev + CI)
- visibilité totale sur l'état du projet
- standard unique pour tous les contributeurs (humains + agents)

---

## 2) Principes de rigueur

1. **Small PRs, high frequency**: PRs petites, ciblées, mergées vite.
2. **Green-first**: pas de merge sans checks verts.
3. **Separation of concerns**: 1 PR = 1 sujet (éviter les mélanges).
4. **Feature flags/fallbacks** quand migration progressive.
5. **No silent failures**: erreurs explicites, observables et testées.
6. **Docs as code**: toute décision durable documentée dans le repo.
7. **Security by default**: rate limit, validation stricte, headers, secrets propres.
8. **Operational readiness**: healthchecks, metrics, runbooks, rollback plan.

---

## 3) Architecture cible (copiable)

## 3.1 Monorepo

- `apps/` -> frontends (ex: web Next.js)
- `services/` -> microservices backend (ex: ecommerce, crm, sav, analytics)
- `packages/` -> librairies partagées (`database`, `shared`, `ui`)
- `scripts/` -> seeds, audits, automation
- `infra/` -> conf ops (prometheus, reverse proxy, docker)
- `.github/workflows/` -> CI/CD
- `docs/` -> runbooks, standards, décisions

## 3.2 Stack recommandée

- Front: Next.js + TypeScript
- Back: Fastify + Prisma
- Test: Vitest + Playwright
- Build orchestration: Turbo
- Package manager: pnpm workspaces
- Runtime DB/cache: PostgreSQL + Redis
- Deploy: Railway/containers (ou équivalent)

## 3.3 Règles architecture

- Les services ne dépendent pas les uns des autres en code, uniquement via API/events.
- Validation d'entrées systématique (Zod ou équivalent).
- Erreurs homogènes (shape stable: `success`, `error.code`, `error.message`).
- Auth centralisée + exemptions explicites pour routes publiques.
- Les read models/projections servent les endpoints analytics lourds.

---

## 4) Standards repo (à mettre en place)

## 4.1 Branching

Convention branches:
- `codex/<topic>` ou `feature/<topic>`
- `fix/<topic>` pour bugfix
- `chore/<topic>` pour infra/tooling

Règle:
- une branche = un sujet
- rebase fréquent sur `main`

## 4.2 Commits

Conventional commits:
- `feat(...)`
- `fix(...)`
- `chore(...)`
- `test(...)`
- `ci(...)`
- `refactor(...)`

Exemples:
- `fix(admin): allow image URL import on product create/edit`
- `ci(cd): add production deploy workflow with approval gate`

## 4.3 PR discipline

Chaque PR contient:
- **Summary** clair
- **Scope** (ce qui est modifié / non modifié)
- **Validation** (commandes lancées)
- **Risk notes** + rollback simple

Checklist PR minimale:
- [ ] lint local passe
- [ ] tests ciblés passent
- [ ] smoke tests passent
- [ ] no unrelated files
- [ ] docs mises à jour si comportement changé

---

## 5) Commandes standard (baseline)

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm test:smoke
pnpm test:project <project>
pnpm test:changed
pnpm build
pnpm audit --audit-level=high
```

Ajouts utiles:

```bash
pnpm agent:status
pnpm agent:rebase-all
pnpm agent:cleanup
pnpm agent:conflicts
pnpm audit:playwright
pnpm analytics:refresh
```

---

## 6) Stratégie test

## 6.1 Pyramide

1. Unit tests (rapides, isolés)
2. Integration tests (routes + DB + auth)
3. Smoke tests (flux critiques)
4. E2E Playwright (navigation + checkout + auth)
5. Audit Playwright (dead links/elements + score)

## 6.2 Conventions

- `pnpm test` doit rester utilisable en local (< quelques secondes idéalement).
- `pnpm test:project <service>` doit permettre un ciblage domaine.
- `test:smoke` doit tourner avant push.
- Les tests flakes sont soit fiabilisés, soit explicitement isolés/ignorés avec ticket.

## 6.3 Qualité de couverture

- Priorité routes sensibles: auth, checkout, admin CRUD, stock.
- Objectif progressif: 70% routes critiques couvertes (pas seulement % lignes).

---

## 7) CI standard (gates obligatoires)

Pipeline recommandé en jobs parallèles:
- Lint & Type Check
- Build
- Unit Tests
- DB Schema Validate
- Security Scan
- Smoke Tests
- E2E Tests
- Docker Build matrix (services)
- **CI Gate final** (status unique required)

Pourquoi:
- parallèle = wall-time réduit
- gate unique = branch protection simple

Exigence:
- aucun merge sans CI Gate vert

---

## 8) CD production (manuel + approval gate)

Pattern recommandé:
- workflow `deploy-production.yml`
- trigger `workflow_dispatch`
- `environment: production` pour approbation humaine
- déploiement service par service (`all` ou ciblé)
- healthchecks post-deploy
- rollback documenté

Variables/secrets minimum:
- `RAILWAY_TOKEN` (secret)
- `RAILWAY_PROJECT_ID` (variable)
- URLs prod par service (`PROD_*_URL`)

---

## 9) Sécurité minimale non négociable

1. Validation d'input stricte
2. Rate limiting sur endpoints exposés (auth/register/guest endpoints/public ingest)
3. Headers sécurité (HSTS, permissions policy, etc.)
4. Sanitization des contenus HTML rendus
5. Audit deps périodique (`pnpm audit`)
6. Aucun secret commité
7. Rotation clé/secrets documentée

---

## 10) Observabilité

Checklist:
- `/health` + `/ready` sur chaque service
- `/metrics` Prometheus sur chaque service
- dashboards (latence, erreurs, throughput)
- logs structurés
- alertes sur erreurs/latence anormales

KPIs techniques suivis:
- p95 latence API
- error rate par endpoint
- temps CI moyen
- flaky tests count
- lead time PR

---

## 11) Workflow humain + agent (copiable)

## 11.1 Rôles

- **Lead**: priorisation, validation architecture, décision finale.
- **Builder**: implémentation + tests + PR.
- **Reviewer**: quality/risk review + bot comments.

## 11.2 Cadence d'exécution

1. Découper en phases incrémentales (PRs indépendantes)
2. Merge phase N avant phase N+1 (sauf parallélisation sûre)
3. Toujours traiter les bot comments avant merge
4. Reporter: trouvé/corrigé/ignoré (+ justification)

## 11.3 Triage backlog

Format recommandé:
- P0 = bloque prod
- P1 = impact business fort
- P2 = amélioration structurante

Règle:
- vider P0 avant nouveaux features

---

## 12) Checklists opérationnelles

## 12.1 Pre-push

- [ ] `pnpm test:smoke` vert
- [ ] scope PR propre (pas de fichiers hors sujet)
- [ ] aucune clé/secret dans diff

## 12.2 Pre-merge

- [ ] CI Gate vert
- [ ] bot comments traités
- [ ] changelog PR précis
- [ ] migration/data step explicitée si nécessaire

## 12.3 Pre-release

- [ ] smoke en staging
- [ ] health/ready OK tous services
- [ ] KPIs business critiques vérifiés (checkout, auth, admin)
- [ ] rollback prêt

---

## 13) Données & seeds

Règles:
- avoir un seed standard dev
- avoir un seed demo (scénarios business)
- identifiants de demo clairement documentés
- ne jamais réutiliser en prod

À personnaliser:
- comptes seed
- jeux de données réalistes (orders, clients, tickets)

---

## 14) Qualité frontend

Checklist:
- accessibilité de base (labels, `role=alert`, skip link, focus states)
- SEO de base (canonical, metadata, sitemap propre, noindex pages privées)
- performance (SSR sur pages critiques, images prioritaires LCP)
- legal compliance (pages obligatoires + consent)

---

## 15) Gouvernance des exceptions

Quand un point ne peut pas être corrigé dans la PR courante:
- documenter précisément pourquoi
- ouvrir ticket dédié avec owner + ETA
- ne pas masquer une régression sous silence

---

## 16) Templates prêts à copier

## 16.1 PR Template

```md
## Summary
- 

## Scope
- Included:
- Excluded:

## Validation
- [ ] pnpm lint
- [ ] pnpm test
- [ ] pnpm test:smoke
- [ ] tests ciblés

## Risks / Rollback
- Risk:
- Rollback:
```

## 16.2 Incident Template

```md
# Incident
- Date:
- Impact:
- Root cause:
- Detection:
- Resolution:
- Prevention actions:
```

---

## 17) Plan d'adoption pour un nouveau projet (7 jours)

Jour 1:
- setup monorepo + scripts baseline + CI minimale

Jour 2:
- conventions branches/PR/commits + pre-push smoke

Jour 3:
- tests ciblés par projet + audit deps

Jour 4:
- security hardening (rate limit, headers, sanitize)

Jour 5:
- observabilité (health/ready/metrics)

Jour 6:
- CD manuel avec approval gate

Jour 7:
- runbook release + incident template + backlog P0/P1/P2

---

## 18) KPIs de maturité (scorecard)

- CI Gate median time
- % PR mergées sans rework
- % routes critiques testées
- incidents prod / mois
- MTTR incidents
- vuln high/critical ouvertes

Objectif:
- feedback rapide + stabilité durable

---

## 19) À personnaliser immédiatement

- nom projet, domaines, services
- secrets/variables CI/CD
- environnements (`staging`, `production`)
- règles branch protection
- pages légales et contacts conformité

---

## 20) Résumé exécutable

Si tu copies ce playbook dans un nouveau projet et appliques uniquement ces 6 points, tu obtiens déjà 80% de la rigueur:

1. CI parallèle + CI Gate unique
2. pre-push smoke obligatoire
3. PR petites, scope strict
4. tests ciblés + E2E critiques
5. `/health` + `/ready` + `/metrics`
6. CD manuel avec approbation

