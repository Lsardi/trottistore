# Release Runbook — TrottiStore

Date: 2026-03-28  
Owner: Tech Lead

## 1. Scope

Ce runbook couvre:
- préparation d'une release applicative
- exécution de la release
- vérifications post-release
- rollback standard en cas de régression

## 2. Pre-Release Checklist

1. Branche cible à jour (`main` ou `develop`) et PR mergeée.
2. CI verte sur le commit à release:
- lint/typecheck
- build
- smoke tests
- security scan
- e2e PR (si applicable)
3. Migrations DB validées:
- `pnpm --filter @trottistore/database exec prisma validate`
4. Variables d'environnement alignées avec `.env.example`.
5. Docker images buildables pour `ecommerce`, `crm`, `sav`, `analytics`.
6. Notes de release prêtes:
- changements fonctionnels
- breaking changes
- plan de rollback

## 3. Release Procedure

1. Tagger le commit release:
- `git tag -a vX.Y.Z -m "TrottiStore vX.Y.Z"`
- `git push origin vX.Y.Z`
2. Déployer en staging (ou environnement de préprod).
3. Vérifier staging:
- `/health` de chaque service
- parcours smoke critiques (auth, panier, checkout, SAV)
4. Déployer en production via pipeline CD.
5. Vérifier production (voir section 4).

## 4. Post-Release Verification

1. Santé des services:
- `GET /health` sur `ecommerce`, `crm`, `sav`, `analytics`
2. Smoke business:
- connexion client
- ajout panier
- création commande
- accès espace client
- création ticket SAV
3. Observabilité:
- 5xx rate stable
- p95 latence stable
- absence de pic d'erreurs auth/JWT
4. CI post-merge reste verte sur `main`.

## 5. Rollback Procedure

## Conditions de rollback immédiat

- hausse significative des 5xx
- checkout KO
- auth cassée (connexion/refresh)
- migration DB non compatible

## Steps

1. Stopper la promotion en cours.
2. Revenir à la dernière version stable (tag `vX.Y.Z-1`).
3. Redéployer les images précédentes sur tous les services impactés.
4. Si migration non rétrocompatible:
- appliquer plan de rollback DB documenté (ou restauration backup)
- vérifier intégrité des données métier critiques
5. Exécuter le smoke minimal en prod.
6. Ouvrir incident + postmortem (timeline, cause racine, remédiations).

## 6. Incident Communication Template

- Impact: services/fonctionnalités touchés
- Heure de début: UTC + locale
- Action en cours: rollback/redeploy/hotfix
- ETA de stabilisation
- Responsable technique

## 7. Database Backup & Restore

### Backup (quotidien)

```bash
# Via le script existant
bash infra/backup-db.sh

# Ou manuellement
pg_dump -h localhost -U trottistore -d trottistore_dev \
  --format=custom --compress=9 \
  -f backup_$(date +%Y%m%d_%H%M%S).dump
```

### Restore

```bash
# Stopper les services
podman compose -f docker-compose.dev.yml stop

# Restaurer
pg_restore -h localhost -U trottistore -d trottistore_dev \
  --clean --if-exists backup_YYYYMMDD_HHMMSS.dump

# Relancer et vérifier
podman compose -f docker-compose.dev.yml start
pnpm db:push  # réaligner le schema si nécessaire
curl http://localhost:3001/ready
curl http://localhost:3002/ready
curl http://localhost:3003/ready
curl http://localhost:3004/ready
```

### Validation post-restore

- [ ] /ready retourne 200 sur les 4 services
- [ ] Données métier cohérentes (compter tickets, commandes, clients)
- [ ] Pas de migration en attente

## 8. Alerting (Prometheus)

Fichier: `infra/alerting-rules.yml`

| Alerte | Seuil | Sévérité |
|--------|-------|----------|
| ServiceDown | /health KO pendant 2min | critical |
| HighErrorRate | >5% de 5xx pendant 5min | warning |
| HighLatency | p95 >2s pendant 5min | warning |
| DatabaseUnhealthy | /ready KO pendant 1min | critical |

## 9. Ownership

- Tech Lead: go/no-go release, validation finale
- Dev owner PR: préparation notes + validation fonctionnelle
- Ops/Infra owner: déploiement et monitoring runtime
