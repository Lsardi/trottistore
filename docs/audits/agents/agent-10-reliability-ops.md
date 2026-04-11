# Agent 10 — Reliability / Load / Ops

> **Date :** 2026-04-11
> **Agent :** Claude Code Explore subagent

## Scope effectif

- `services/{ecommerce,crm,sav,analytics}/src/routes/health.ts`
- `services/{ecommerce,crm,sav,analytics}/src/plugins/metrics.ts`
- `infra/alerting-rules.yml`
- `infra/Caddyfile`
- `infra/backup-db.sh`
- `infra/STAGING.md`
- `.github/workflows/cron-triggers-run.yml`
- `scripts/smoke-staging.sh`
- `RELEASE_RUNBOOK.md`
- `SECURITY.md`
- `.github/ISSUE_TEMPLATE/postmortem.md`

## Findings supplémentaires

### 1. P1 — Alerting `probe_success` référence métrique inexistante (alerte cassée) 🔴

**Réf :** `infra/alerting-rules.yml:36`

**Symptôme :** L'alerte `DatabaseUnhealthy` utilise `expr: probe_success{job="readiness"} == 0`. Or **aucune métrique `probe_success` n'est exposée par les services TrottiStore**. Cette métrique est typiquement générée par un blackbox exporter Prometheus (HTTP probe externe), pas par les services Fastify eux-mêmes.

**Risque :** L'alerte critique "DB down" **ne se déclenche jamais**. Fausse sensation de couverture alerting. Si Postgres tombe en prod, aucune notification automatique.

**Fix proposé :**
1. Soit déployer un blackbox exporter Prometheus qui probe `/ready` toutes les 30s et expose `probe_success`
2. Soit (plus simple) exposer une métrique custom `trottistore_database_healthy` (gauge 0/1) depuis `services/*/src/plugins/metrics.ts` qui ping la DB toutes les 30s, et modifier la rule en `expr: trottistore_database_healthy == 0`

### 2. P2 — Healthcheck `/health` trivial — pas de vrai check de dépendances

**Réf :** `services/*/src/routes/health.ts` (4 services, exemple `ecommerce/src/routes/health.ts:6-11`)

**Symptôme :** `/health` retourne `{ "status": "ok" }` en dur sans aucune vérification. Même si la DB est down, `/health` retourne 200. C'est un faux positif.

**Note :** Seul `/ready` (sur ecommerce uniquement) check vraiment les dépendances. Un orchestrateur Kubernetes utilisant `/health` pour liveness serait aveugle à un crash DB.

**Risque :** Faux positifs healthcheck masquent les pannes. Auto-restart Kubernetes ne se déclencherait pas.

**Fix proposé :** Convention K8s :
- `/liveness` (ou `/health`) : check trivial (process en vie)
- `/readiness` (ou `/ready`) : vrai check des dépendances (DB, Redis)
- Renommer si nécessaire pour clarifier

OU faire de `/health` un vrai check pour les 4 services, pas seulement ecommerce.

### 3. P2 — Backup DB : restore jamais testé

**Réf :** `infra/backup-db.sh` + `RELEASE_RUNBOOK.md:102-119`

**Symptôme :** Le script de backup existe avec rotation 30 jours. Les steps de restore sont documentés dans le runbook. **MAIS aucun test de restore en automation**.

**Risque :** Le jour où on a vraiment besoin de restore, on découvre que :
- Le backup est corrompu
- Le format pg_dump n'est plus compatible (version Postgres a changé)
- Le restore prend 4h alors qu'on pensait 30 min
- Une étape critique du runbook est obsolète

**Fix proposé :** Job GitHub Actions hebdo qui :
1. Récupère le dernier backup
2. Restaure dans une DB Postgres de test (Testcontainer ou Railway staging)
3. Compte les rows critiques (`orders`, `repair_tickets`, `users`) → assert > 0
4. Notifie en cas d'échec

Effort : 1-2h setup. Bénéfice énorme.

### 4. P2 — `RELEASE_RUNBOOK.md` ne dit pas comment détecter un incident

**Réf :** `RELEASE_RUNBOOK.md:1-59`

**Symptôme :** Le runbook documente les étapes de déploiement et de rollback, MAIS aucune section "comment savoir qu'on est en incident". Pas de seuils objectifs, pas de lien vers les dashboards ou les alertes.

**Risque :** Le tech lead fait un rollback sur intuition au lieu de critères objectifs. Soit trop tôt (panique), soit trop tard (impact aggravé).

**Fix proposé :** Ajouter une section "Détection précoce d'incident" :

```markdown
## Critères de rollback automatique

- Taux 5xx > 5% pendant 2 minutes
- p95 latency > 3 secondes pendant 5 minutes
- Une alerte critique active dans Prometheus (DatabaseUnhealthy, HighErrorRate)
- Smoke test post-deploy fail

## Outils de monitoring

- Prometheus alerts: [URL]
- Logs Railway: [URL chaque service]
- Sentry (à venir): [URL]
- Status page (à venir): [URL]
```

### 5. P2 — `SECURITY.md` est un template vide (skeleton GitHub)

**Réf :** `SECURITY.md` entier

**Symptôme :** Le fichier qui sert à signaler les vulnérabilités est juste le skeleton GitHub par défaut. Pas de destinataire, pas de process, pas de SLA de réponse.

**Risque :** Un security researcher qui découvre une vulnérabilité ne sait pas où la signaler. Pas de canal privé → divulgation publique sur Twitter ou full disclosure. Risque réputationnel et opérationnel.

**Fix proposé :** Remplir avec :
- Email contact dédié `security@trottistore.fr` (avec PGP key idéalement)
- Process de divulgation responsable (private 90j)
- SLA de réponse (< 48h pour acknowledgement)
- Programme bug bounty si applicable
- Liste des "out of scope" (dénonciations sans PoC, etc.)

## Non-findings (vérifié, OK)

- ✓ Healthcheck endpoints implémentés sur les 4 services + structure cohérente
- ✓ Metrics labels : `method`, `route`, `status_code` uniquement (pas de `userId`/`email` qui exploserait la cardinality)
- ✓ Alerting rules : seuils raisonnables (5% 5xx, p95 > 2s, 1-2 min)
- ✓ Smoke staging script (`smoke-staging.sh`) : couverture OK (17 checks incluant guest repair + auth rejection)
- ✓ Cron retry : `--retry 3 --retry-delay 5` présent
- ✓ Postmortem template (`postmortem.md`) : complet (timeline, impact, RCA, actions, leçons)
- ✓ Caddyfile : headers de sécurité présents (HSTS, CSP, nosniff)

## Angles non vérifiés

- Circuit breaker : pas de code/config détecté (si une dépendance est lente, requêtes accumulent)
- Rate limiting détaillé : documenté en CLAUDE.md (100/min) mais détails de configuration manquent
- Graceful shutdown : pas de vérification que les services drain les requêtes en vol avant arrêt
- Cost / quota monitoring : Stripe API calls, Brevo SMS, ClickHouse non couverts dans les alertes
- Multi-region : toute infra sur Railway unique, aucun failover géographique

## Recommandations

### Quick wins (< 1h)
- **P1 Corriger alerting DB** : implémenter métrique custom `trottistore_database_healthy` ou déployer blackbox exporter
- **P2 Remplir SECURITY.md** (15 min)

### Structurants (1-2h chacun)
- **P2 Healthcheck unification** : `/liveness` trivial + `/readiness` vrai check sur les 4 services
- **P2 Test restore hebdo** : job GitHub Actions qui restore le backup chaque jeudi
- **P2 Runbook detection thresholds** : ajouter seuils objectifs de rollback

### Post go-live
- Circuit breaker (Cockatiel ou similaire) sur les calls externes (Stripe, Brevo)
- Multi-region failover (long terme, pas urgent)
- Cost monitoring Stripe / Brevo
