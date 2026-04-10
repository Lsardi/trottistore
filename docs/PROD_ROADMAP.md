# Carte du chantier prod — TrottiStore

> Où on est, où on va, ce qui bloque, ce qui peut attendre.  
> Date: 2026-04-10

Cible de déploiement : **Railway** via
`.github/workflows/deploy-production.yml` (`workflow_dispatch`).  
Services déployés : `web`, `ecommerce`, `crm`, `sav`, `analytics`.  
Front : Next.js 15 (`apps/web`). Backend : 4 services Fastify.  
DB : PostgreSQL multi-schema via Prisma. Cache/queue : Redis.

---

## 1. La carte en 1 image

```
┌─────────────────────────────────────────────────────────────────────┐
│                       OÙ ON EST (2026-04-10)                        │
└─────────────────────────────────────────────────────────────────────┘

                              main
                           [d0727cb]
                               │
              ┌────────────────┼──────────────────┐
              │                │                  │
         PR #89 merged     not merged          not merged
         (2 P0 fixes)     (12 branches)     (codex branches)
              │                │                  │
              ▼                ▼                  ▼
     ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐
     │ IDOR guest  │   │  9 claude/*  │   │  4 codex/*      │
     │ payment     │   │  branches    │   │  branches       │
     │             │   │  APPROVE     │   │  APPROVE        │
     │ + double    │   │              │   │                 │
     │ stock fix   │   │              │   │                 │
     └─────────────┘   └──────────────┘   └─────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                         CE QUI BLOQUE LA PROD                        │
└─────────────────────────────────────────────────────────────────────┘

BLOQUANT (P0 non mergés) :
  ● codex/fix-stock-race-oversell      stock peut aller négatif
  ● codex/fix-checkout-decimal-math    argent perdu en cart-first
  ● claude/fix-crm-cron-bypass         spam mass campaigns possible
  ● claude/fix-crm-customer-merge      perte de données fidélité

NON BLOQUANT mais à merger pour réduire le risque (P1) :
  ○ claude/fix-orders-status-idor       dead code, attack surface
  ○ claude/fix-sav-quote-accept-idor    technicien IDOR
  ○ claude/fix-password-reset-race      overwrite attaquant
  ○ claude/fix-order-item-product-index perf full scan

CONFORT dev (pas d'impact prod immédiat) :
  ▫ claude/audit-docs                   docs + rapport audit
  ▫ claude/governance-tooling           CI gate + CODEOWNERS
  ▫ claude/spec-retro-p03               exemple spec
  ▫ codex/governance-spec-template      template spec
  ▫ codex/methodology-threatmodel       threat model + runbook
```

---

## 2. État détaillé de chaque branche

### 🔴 BLOQUANTS (P0) — doivent merger avant go live

| Branche | Impact si pas fixé en prod | Statut | Effort merge |
|---|---|---|---|
| `codex/fix-stock-race-oversell` | 100 commandes parallèles sur 1 unité → stock = -99, 99 commandes non livrables | APPROVE, suggestion A1 (heal data) non bloquante | 5 min |
| `codex/fix-checkout-decimal-math` | Cart-first checkout calcule en float, divergence cart display / Stripe charge possible | APPROVE, suggestion B1 (pricing-constants) non bloquante | 5 min |
| `claude/fix-crm-cron-bypass` | Tout utilisateur authentifié non-CLIENT peut lancer l'envoi massif d'emails/SMS à tous les clients | APPROVE final (3 rounds) | 5 min |
| `claude/fix-crm-customer-merge` | Fusion de comptes perd l'historique de fidélité + état zombie si crash entre les 2 transactions | APPROVE (3 commits) | 5 min |

### 🟠 IMPORTANTS (P1) — à merger dans les jours qui suivent le go live

| Branche | Impact | Statut | Effort |
|---|---|---|---|
| `claude/fix-orders-status-idor` | Dead route dupliquée = attack surface + dette maintenance | APPROVE | 2 min |
| `claude/fix-sav-quote-accept-idor` | Un TECHNICIAN peut accepter un devis d'un ticket non assigné | APPROVE final | 2 min |
| `claude/fix-password-reset-race` | Deux requêtes concurrentes avec le même reset token → attaquant peut overwrite | APPROVE | 5 min |
| `claude/fix-order-item-product-index` | Full scan sur queries "orders by product" — ralentit analytics et merchant feed | APPROVE final (migration testée E2E) | 5 min + migration |

### 🔵 GOVERNANCE + DOCS (dépendances circulaires, à orchestrer)

| Branche | Nature | Dépendance | Effort |
|---|---|---|---|
| `codex/governance-spec-template` | Template issue `security-spec.md` + section CLAUDE.md | Aucune | 2 min |
| `claude/governance-tooling` | CODEOWNERS + PR template + audit-gate CI + Semgrep rules + GOVERNANCE.md | Template ci-dessus | 2 min |
| `claude/audit-docs` | 5 docs audit (methodology, atomic, production-critical, handoff, script LLM) | Aucune | 2 min |
| `codex/methodology-threatmodel` | `THREAT_MODEL.md` + `docs/AUDIT_RUNBOOK.md` | Aucune | 2 min |
| `claude/spec-retro-p03` | Exemple rempli + 2 propositions d'amendement du template | Template mergé | 2 min |

---

## 3. Ordre de merge recommandé (critical path)

```
ÉTAPE 1 — Governance (rend le reste traçable)
├── [1] codex/governance-spec-template       (template tout seul)
├── [2] claude/governance-tooling            (tooling + rules)
├── [3] codex/methodology-threatmodel        (threat model + runbook)
└── [4] claude/audit-docs                    (docs audit)

ÉTAPE 2 — P0 (débloque la prod)
├── [5] codex/fix-stock-race-oversell        ← stock
├── [6] codex/fix-checkout-decimal-math      ← argent
├── [7] claude/fix-crm-cron-bypass           ← auth
└── [8] claude/fix-crm-customer-merge        ← data

ÉTAPE 3 — P1 (réduit le risque résiduel)
├── [9]  claude/fix-orders-status-idor
├── [10] claude/fix-sav-quote-accept-idor
├── [11] claude/fix-password-reset-race
└── [12] claude/fix-order-item-product-index ← contient une migration

ÉTAPE 4 — Exemple spec (clôture boucle governance)
└── [13] claude/spec-retro-p03
```

**Ordre = zéro conflit connu.** Aucune branche ne touche aux mêmes fichiers qu'une autre sauf les docs (audit-docs vs governance-tooling vs methodology-threatmodel) — et les docs sont additives, pas de collision.

**Fenêtre réaliste** pour arriver jusqu'à l'étape 2 mergée : ~20 minutes de merges + CI si tout va bien.

---

## 4. Checklist pré-prod (à cocher avant le `workflow_dispatch`)

### 4.1 Code et merges

- [ ] Les 4 P0 de l'étape 2 sont mergés sur `main`
- [ ] CI verte sur le commit HEAD de `main` (lint + tests + smoke + build + security scan)
- [ ] `pnpm audit --audit-level=high` passe
- [ ] Aucun commit WIP ou `wip:` sur `main`
- [ ] Git tag créé : `git tag -a vX.Y.Z -m "…" && git push origin vX.Y.Z`

### 4.2 Base de données

- [ ] `prisma validate` passe sur `main`
- [ ] Migration `20260410160000_order_item_product_variant_indexes` appliquée en staging d'abord
- [ ] Migration `20260410151000_stock_quantity_non_negative` (P0-A) appliquée en staging d'abord
  - ⚠️ Peut échouer en prod si rows avec `stock_quantity < 0` existent (suggestion A1 de Codex)
  - Solution : exécuter `UPDATE product_variants SET stock_quantity = 0 WHERE stock_quantity < 0;` **avant** la migration
- [ ] Backup DB fraîche (`infra/backup-db.sh` sur staging, pareil en prod)

### 4.3 Environnement

- [ ] Variables d'env prod alignées avec `.env.example`
- [ ] `STRIPE_SECRET_KEY` (live key, pas test) en place sur Railway
- [ ] `STRIPE_WEBHOOK_SECRET` (live) configuré sur l'endpoint prod côté Stripe Dashboard
- [ ] `JWT_ACCESS_SECRET` rotation planifiée si changement récent
- [ ] `REDIS_URL` pointe sur l'instance prod
- [ ] `DATABASE_URL` avec SSL et connection pooling

### 4.4 Secrets GitHub Actions

- [ ] `RAILWAY_TOKEN` secret présent
- [ ] `RAILWAY_PROJECT_ID` variable présente

### 4.5 Monitoring pré-deploy

- [ ] Dashboard Grafana / Prometheus accessible
- [ ] `/health` actuellement vert sur tous les services de prod
- [ ] Redis et Postgres monitorés

---

## 5. Procédure de déploiement

```bash
# 1. Tagger la release
git checkout main && git pull
git tag -a v1.0.0 -m "TrottiStore v1.0.0 — P0 fixes + governance"
git push origin v1.0.0

# 2. Staging d'abord (si tu as un env staging)
gh workflow run deploy-staging.yml

# 3. Smoke tests staging
for port in 3001 3002 3003 3004; do
  curl -fsS https://<staging-host>:$port/health || exit 1
done

# 4. Prod (un service à la fois si paranoïa)
gh workflow run deploy-production.yml -f service=ecommerce
# … vérifier /health, attendre 2 min
gh workflow run deploy-production.yml -f service=crm
# … idem
gh workflow run deploy-production.yml -f service=sav
gh workflow run deploy-production.yml -f service=analytics
gh workflow run deploy-production.yml -f service=web
```

Ou en mode "push tout" si tu fais confiance à la CI :

```bash
gh workflow run deploy-production.yml -f service=all
```

---

## 6. Post-deploy checks

```bash
# Health
for svc in ecommerce crm sav analytics; do
  curl -fsS https://api.trottistore.fr/$svc/health
done

# Front
curl -fsS https://trottistore.fr/ | head -20

# Smoke business (manuel ou via script)
# 1. Login client
# 2. Browse /produits
# 3. Add to cart
# 4. Checkout (mode test Stripe si possible)
# 5. /mon-compte voir l'ordre
```

---

## 7. Rollback (si ça tourne mal)

```bash
# Option 1 — rollback via Railway UI (le plus rapide)
# Railway Dashboard → service → Deployments → clic sur le précédent → "Redeploy"

# Option 2 — revert commit + redeploy
git revert <bad-commit-sha>
git push origin main
gh workflow run deploy-production.yml -f service=all

# Option 3 — rollback schema si la migration a pété
psql "$DATABASE_URL" < infra/backups/backup-<timestamp>.sql
```

**Règles** :
- N'importe quelle alerte Grafana P95 latency > 2x baseline → rollback immédiat.
- 5xx rate > 1 % sur n'importe quel service → rollback immédiat.
- `/health` rouge plus de 2 min → rollback immédiat.
- Plainte client sur Stripe charge mismatch → rollback immédiat + contact Stripe support.

---

## 8. Ce qui peut attendre (post go-live)

| Item | Pourquoi c'est post-prod |
|---|---|
| Audit gate CI enabled comme required check | Nécessite les 2 branches governance mergées + test sur une PR non-critique d'abord |
| Stryker mutation testing | Infra, zéro impact prod |
| Fast-check property tests layer 5 | Augmentation de couverture, pas de bug à fixer |
| P1-3 appointment booking race (SAV) | Faible volume d'usage actuel, peut attendre sprint suivant |
| P1-6 access token httpOnly cookie | Changement architectural front, demande migration testée |
| P1-7 price recompute cart-first (déjà couvert par P0-B mais peut être durci) | Marginal après P0-B |
| Pentest externe | Planifier J+7 après go live |
| Bug bounty privé | Planifier J+14 |

---

## 9. Décisions à prendre **maintenant**

1. **Ordre de merge** : tu valides l'ordre section 3, ou tu veux changer quelque chose ?
2. **Go / no-go P0-A migration** : on applique `UPDATE ... WHERE stock_quantity < 0` avant la migration en prod (safe) ou on part du principe que la data est propre (risk) ?
3. **Release tag** : `v1.0.0` (fresh start) ou `v0.9.0-rc` (soft launch) ?
4. **Fenêtre de deploy** : jour + heure bas trafic préféré ?
5. **Qui garde la main sur le `workflow_dispatch`** : toi seul ou on automatise sur tag push ?

---

## 10. Ce que Claude fera pendant que tu réfléchis

Par défaut, en attendant ton feu vert sur les décisions ci-dessus :

- Attendre
- Ne rien merger sans ton OK explicite (branch protection ou pas)
- Ne rien push sur main directement (pas autorisé)

Si tu veux que j'avance en parallèle sur quelque chose qui ne touche pas le critical path :

- [ ] Spec rétro P0-A (valide le workflow governance sur un bug data/migration)
- [ ] Spec rétro P0-4 (valide sur un bug transaction)
- [ ] Property tests fast-check sur `cart-totals` (layer 5)
- [ ] Script `pnpm audit:spec` qui vérifie que chaque MUST d'un ticket a un test référencé dans les commits

Dis-moi ce que tu veux et je pars.
