## Description

<!-- Décrivez brièvement les changements apportés -->

## Type de changement

- [ ] Bug fix
- [ ] Nouvelle fonctionnalité
- [ ] Refactoring / amélioration technique
- [ ] Infrastructure / CI / Ops
- [ ] Documentation

## Checklist Go/No-Go Release

### Qualité

- [ ] Build passe (`pnpm build`)
- [ ] Lint/typecheck propre (`pnpm turbo lint`)
- [ ] Smoke tests passent (`pnpm test:smoke`)
- [ ] Tests unitaires passent (`pnpm test`)
- [ ] Pas de `any` ajouté sans justification

### Sécurité

- [ ] `pnpm audit --audit-level=high` propre
- [ ] Pas de secret/credential dans le diff
- [ ] Endpoints sensibles protégés par auth

### Base de données

- [ ] Migrations Prisma validées (`prisma validate`)
- [ ] Migration rétrocompatible (rollback possible)
- [ ] Pas de perte de données en cas de rollback

### Déploiement

- [ ] Docker build OK pour les services modifiés
- [ ] Variables d'environnement documentées dans `.env.example`
- [ ] Plan de rollback identifié (voir [RELEASE_RUNBOOK.md](../RELEASE_RUNBOOK.md))

### Review

- [ ] Auto-review du diff effectuée
- [ ] Tests manuels sur les parcours impactés
- [ ] Screenshots / captures si changement UI
