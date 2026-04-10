# Carte du chantier prod — TrottiStore

> Où on est, où on va, ce qui bloque, ce qui peut attendre.  
> Date: 2026-04-10  
> Owners: @Lsardi (décideur final), Claude + Codex (exécution)

Cible de déploiement : **Railway** via
`.github/workflows/deploy-production.yml` (`workflow_dispatch`).  
Services déployés : `web`, `ecommerce`, `crm`, `sav`, `analytics`.  
Front : Next.js 15 (`apps/web`). Backend : 4 services Fastify.  
DB : PostgreSQL multi-schema via Prisma. Cache/queue : Redis.

## 0. TL;DR — deux horizons

Cette roadmap fonctionne en **deux temps** :

- **Semaine 0** (aujourd'hui → demain matin) : ship contrôlé avec le
  dispositif actuel. Réduit tout de suite le risque réel des 4 P0
  identifiés par les audits. Détails en §1-§11.

- **Semaines 1-4** : industrialisation. Passe de "manual gates signés
  par Claude+Codex" à "policy-as-code, merge queue, artifact
  attestations, testcontainers, Neon rehearsal". Détails en §12.

Retarder la semaine 0 pour attendre l'industrialisation serait une
erreur : les 4 P0 sont des vulnérabilités exposées en production
actuellement. On ship d'abord, on durcit ensuite.

Décisions validées par Codex le 2026-04-10 :

| Question | Décision |
|---|---|
| Séquence en 2 temps | ✅ validée |
| Tag de release | `v0.9.0-rc1` (pas de `v1.0.0` avant staging + sweep + prod OK) |
| Qui exécute audit sweep | Claude = passes A+B, Codex = passe C adversarial |
| P0-A migration heal | heal existing negative stock **avant** `CHECK`, pas en follow-up |
| Fenêtre de deploy | créneau faible trafic, surveillé des deux côtés, hors pic commercial |
| Qui déclenche `workflow_dispatch` | @Lsardi seul, après lecture du passport pre-prod |
| Audit tooling semaine 0 | agents Explore + revue humaine — **pas** d'Ollama 7b pour le gate critique |
| Ordre de merge | governance → P0 → P1 → spec rétro (§3) |

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

ÉTAPE 5 — Pre-prod audit sweep (OBLIGATOIRE avant deploy)
└── [14] Exécution des passes A/B/C — voir §5
         Produit docs/audits/AUDIT_PREPROD_<date>.md signé

ÉTAPE 6 — Tag + deploy
├── [15] git tag -a vX.Y.Z -m "…"
└── [16] gh workflow run deploy-production.yml
```

**Ordre = zéro conflit connu.** Aucune branche ne touche aux mêmes fichiers qu'une autre sauf les docs (audit-docs vs governance-tooling vs methodology-threatmodel) — et les docs sont additives, pas de collision.

**Fenêtre réaliste** pour arriver jusqu'à l'étape 2 mergée : ~20 minutes de merges + CI si tout va bien.

**Étape 5 (audit sweep) ajoute ~1h** wallclock mais est non négociable pour une release qui touche de l'argent. C'est le filet entre "CI verte" et "prod-ready".

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

## 5. Pre-prod audit sweep — **OBLIGATOIRE** avant tout deploy prod

> Gate ajoutée suite au retour @Lsardi : la CI est mécanique, elle vérifie
> que les règles syntaxiques/unitaires/intégration passent. Elle ne refait
> pas un audit sémantique. Entre le dernier atomic audit (`AUDIT_ATOMIC.md`)
> et maintenant, on a mergé ~12 branches — chaque merge est une occasion
> de régression, de drift, ou d'interaction non prévue entre fixes. On
> re-audit avant de pousser en prod. Non négociable.

> **Horizon semaine 0 (cette section)** : exécution manuelle par Claude
> (passes A+B) et Codex (passe C adversarial), production d'un
> `docs/audits/AUDIT_PREPROD_<date>.md` signé par les trois parties.
>
> **Horizon semaine 1+** : cette gate devient un [required status check
> sur merge_group](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
> via un GitHub Ruleset, exécuté automatiquement par la [Merge Queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
> et couplé à [merge protection code scanning](https://docs.github.com/en/enterprise-cloud%40latest/code-security/concepts/code-scanning/merge-protection).
> Le passport devient un artifact attesté ([SLSA 1.2](https://slsa.dev/spec/v1.2/whats-new)
> via [artifact attestations](https://docs.github.com/actions/concepts/security/artifact-attestations))
> vérifié avant `workflow_dispatch`. Voir §12 pour le plan de transition.

### 5.1 Périmètre de l'audit pré-prod

Trois passes complémentaires, chacune avec un objectif distinct :

**Passe A — Delta audit (obligatoire)**
Comparer `main` au commit baseline (dernier atomic audit, soit
`1bf9b5f` = merge de PR #88). Lancer un audit LLM atomic focalisé
**uniquement sur les fichiers modifiés** par les 12 merges. But :
attraper toute régression ou finding nouveau introduit par le process
de merge lui-même.

**Passe B — Smoke audit (obligatoire)**
Relancer 3 à 5 agents atomiques sur les flows critiques tels qu'ils
existent sur `main` post-merges, sans se limiter au delta. But :
vérifier que les invariants métier (stock non-négatif, money en
Decimal, auth via secret nonce, etc.) tiennent toujours end-to-end,
pas seulement dans les fichiers touchés.

Agents à relancer :
- Stripe webhook signature (était ✅ clean — on vérifie qu'un merge
  ne l'a pas cassé)
- Stock invariants (P0-A a été mergé — on vérifie que les 3 call sites
  sont bien tous passés par `decrementStockOrThrow`)
- Money Decimal handling (P0-B mergé — on vérifie que cart-first
  passe bien par `computeCartTotals`)
- Auth bypass / cron / customer merge (P0-3 et P0-4 mergés)
- Stripe webhook + idempotence (rien changé ici mais c'est la
  surface d'argent — on audit quand même)

**Passe C — Cross-validation adversarial (obligatoire)**
Pour chaque P0 mergé, un agent adversarial relit le diff final sur
`main` et tente de disprouver le fix. Si l'agent trouve une raison
solide → on rollback le merge et on rouvre une PR pour corriger.

### 5.2 Commande concrète

```bash
# Point de départ : main à jour, tous les P0/P1 mergés
git checkout main && git pull

# Capturer le SHA baseline du dernier audit
BASELINE_SHA="1bf9b5f"  # commit au moment de AUDIT_ATOMIC.md
CURRENT_SHA=$(git rev-parse HEAD)

# Liste des fichiers modifiés entre baseline et HEAD
git diff --name-only "$BASELINE_SHA" "$CURRENT_SHA" \
  | grep -E '\.(ts|tsx|prisma|sql)$' \
  > /tmp/audit-sweep-files.txt

# Lancer la passe A (delta) via les agents atomiques
# Voir AUDIT_METHODOLOGY.md section "Stratégie multi-LLM"
# Un agent par question, code quoté, cross-validation humaine sur les P0
```

Alternative rapide si le temps presse : réutiliser
`scripts/audit-code-llm.ts` (créé par claude/audit-docs) avec le flag
`--files-from=/tmp/audit-sweep-files.txt`.

### 5.3 Critères de passage

L'audit pré-prod est **vert** si et seulement si :

- [ ] Passe A ne trouve aucun finding de sévérité HIGH ou CRITICAL sur
      le delta
- [ ] Passe B confirme "clean" sur les 5 zones déjà validées par
      AUDIT_ATOMIC.md
- [ ] Passe C : zéro adversarial review trouve une raison de rollback
- [ ] `pnpm test` passe localement sur `main`
- [ ] `pnpm test:smoke` passe localement sur `main` (<= 1s, 18 tests)
- [ ] `pnpm build` passe localement pour les 4 services + web
- [ ] `prisma validate` passe sur `main`
- [ ] Aucun `TODO: before prod`, `FIXME: P0`, ou `// @ts-ignore` ajouté
      dans les fichiers du delta

Si une seule de ces cases n'est pas cochée : **STOP, on ne deploy pas**.
On ouvre un ticket, on fixe, on re-audit, puis on reprend.

### 5.4 Durée estimée

- Passe A : 10-15 min (3-4 agents atomiques en parallèle, delta ~12-15
  fichiers)
- Passe B : 15-20 min (5 agents en parallèle, scope complet zones
  critiques)
- Passe C : 10 min par P0 (4 P0 × 10 min = 40 min), parallélisable
- Total : **~1h wallclock** si on parallélise Passe A / B / C

### 5.5 Résultat

Un nouveau fichier `docs/audits/AUDIT_PREPROD_<date>.md` versionné sur
`main` (sur une PR dédiée `claude/preprod-audit-<date>`) qui documente :

- Commit baseline + commit HEAD
- Liste des fichiers audités
- Findings par passe (zéro si tout est vert)
- Décisions d'adversarial review
- Liste des checkboxes §5.3 cochées
- Approval tag : `@Lsardi` + signature `Claude` + signature `Codex`

Ce fichier est le **passport de prod**. Sans lui signé, le
`workflow_dispatch` prod est refusé par convention (et à terme par
branch protection + custom GitHub Action).

---

## 6. Procédure de déploiement

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

## 7. Post-deploy checks

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

## 8. Rollback (si ça tourne mal)

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

## 9. Ce qui peut attendre (post go-live)

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

## 10. Décisions — **TOUTES TRANCHÉES** le 2026-04-10

Validées conjointement Claude ↔ Codex après revue terrain de Codex
sur les outils 2026 (Rulesets, Merge Queue, Testcontainers, Neon,
SLSA, ASVS, SSDF).

1. **Ordre de merge** — ✅ validé tel que décrit §3 : governance
   (4) → P0 (4) → P1 (4) → spec rétro (1). Pas de regroupement
   stacked, merges linéaires, un par un.

2. **P0-A migration heal** — ✅ **heal existing negative stock AVANT
   le `CHECK` constraint**. La migration `20260410151000_stock_quantity_non_negative`
   doit contenir :
   ```sql
   UPDATE "ecommerce"."product_variants"
   SET stock_quantity = 0
   WHERE stock_quantity < 0;
   ALTER TABLE "ecommerce"."product_variants"
   ADD CONSTRAINT stock_quantity_non_negative
   CHECK (stock_quantity >= 0);
   ```
   Alternative valide : `ADD CONSTRAINT ... NOT VALID;` puis
   `VALIDATE CONSTRAINT ...;` pour minimiser le lock si la table
   est grosse. Codex décidera selon la taille réelle du dataset prod.

3. **Release tag** — ✅ `v0.9.0-rc1`. Ce n'est pas un simple patch,
   c'est un lot fixes-sécurité + gouvernance. `rc1` signale
   "release candidate sous contrôle renforcé". Pas de `v1.0.0`
   avant staging + smoke + pre-prod sweep complet.

4. **Fenêtre de deploy** — créneau faible trafic avec présence
   active @Lsardi + Claude + Codex, hors pic commercial e-commerce.
   Fenêtre courte, surveillée. Pas vendredi soir, pas veille de
   week-end férié. Date exacte à caler par @Lsardi.

5. **Qui déclenche `workflow_dispatch`** — ✅ @Lsardi **unique**
   déclencheur, après lecture et signature du passport pre-prod.
   Un seul décideur final réduit l'ambiguïté opérationnelle.
   Pas d'automation sur tag push pour ce premier ship.

6. **Qui exécute l'audit sweep §5** — ✅ **option C** :
   - **Claude** : passes A (delta) + B (smoke)
   - **Codex** : passe C (adversarial par P0)
   Meilleur usage des rôles actuels : Claude a le contexte
   consolidé delta + smoke, Codex est en mode adversarial reviewer
   depuis le début de la journée. Deux niveaux de validation
   indépendants.

7. **Audit tooling semaine 0** — ✅ **pas d'Ollama 7b** pour le
   gate critique. Agents Explore Claude/Codex uniquement + revue
   humaine augmentée. L'Ollama local reste valide pour du triage
   post-semaine 0, pas pour une décision de ship.

---

## 11. Ce que Claude fait pendant que @Lsardi signe

Par défaut, en attendant le feu vert exécution :

- Attendre
- Ne rien merger sans OK explicite
- Ne rien push sur main directement

Si @Lsardi veut avancer en parallèle sur quelque chose qui ne touche
pas le critical path de la semaine 0 :

- [ ] Spec rétro P0-A (valide le workflow governance sur un bug data/migration)
- [ ] Spec rétro P0-4 (valide sur un bug transaction)
- [ ] Property tests fast-check sur `cart-totals` (layer 5)
- [ ] Prototype du script `pnpm audit:spec` qui vérifie que chaque MUST d'un ticket a un test référencé dans les commits

Tous ces items iront en semaine 1-4 de toute façon ; les avancer en
semaine 0 ne les accélère que si le critical path de la semaine 0
bloque sur une décision externe et qu'on a du temps libre.

---

## 12. Plan 30 jours — industrialisation (semaine 1-4)

Après la semaine 0 (ship contrôlé des 4 P0), on durcit le dispositif.
Veille terrain Codex 2026, sources citées en §13.

### Semaine 1 — Policy as code

**Objectif** : remplacer la branch protection legacy + les gates
manuelles par [GitHub Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
et [Merge Queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue).

Livrables :

- [ ] Ruleset `protect-main` configuré sur `refs/heads/main` avec :
  - `required_status_checks` : `audit-gate.yml` (tous les jobs),
    `ci.yml` (lint + build + tests), `audit-sweep` (nouveau job §5
    automatisé)
  - `required_reviews` : 1 approve + code-owner review
  - `required_deployments` : `staging` vert avant merge
  - `non_fast_forward` : true
  - `deletion` + `update` : deny
- [ ] Merge Queue activée sur `main`, merge method = squash,
  max-entries-to-build = 3, required-checks = idem Ruleset
- [ ] [Merge protection code scanning](https://docs.github.com/en/enterprise-cloud%40latest/code-security/concepts/code-scanning/merge-protection)
  activée pour bloquer tout merge avec un finding Semgrep/CodeQL
  HIGH ou CRITICAL non-dismissed
- [ ] `claude/governance-tooling` mis à jour :
  - La branch protection legacy retirée
  - `.github/CODEOWNERS` conservé (les Rulesets s'appuient dessus)
  - `.github/workflows/audit-gate.yml` adapté pour émettre sur
    `merge_group` et pas seulement `pull_request`
- [ ] Test sur une PR non-critique (par ex. un fix typo) pour valider
  que la Merge Queue tourne end-to-end avant de laisser les P1 passer
  dessus
- [ ] Les 4 P1 (`claude/fix-orders-status-idor`,
  `claude/fix-sav-quote-accept-idor`,
  `claude/fix-password-reset-race`,
  `claude/fix-order-item-product-index`) passent via la Merge Queue
  pour valider le setup en conditions réelles

Gate semaine 1 : une PR non-governance non-critique ne peut plus
merger sans passer la Merge Queue.

### Semaine 2 — Tests qui prouvent la sémantique

**Objectif** : remplacer les mocks séquentiels par des vrais
Postgres éphémères qui exercent la sérialisation réelle.

Raison : P0-A et P1-5 ont été fixés avec des mocks. Les tests prouvent
le *pattern* (`updateMany` guardé), pas l'atomicité Postgres
réellement observée sous contention. [Testcontainers Node PostgreSQL](https://node.testcontainers.org/modules/postgresql/)
lance un container éphémère par suite de tests.

Livrables :

- [ ] `pnpm add -D @testcontainers/postgresql` dans `packages/database`
- [ ] Helper partagé `packages/database/test-helpers/pg-container.ts`
  qui expose `startTestPostgres()` et `stopTestPostgres()`, gère
  le port dynamique, applique les migrations Prisma, expose un
  `prisma` client connecté
- [ ] Suite `services/ecommerce/src/routes/orders/orders.race.real.test.ts` :
  property test fast-check avec **100 commandes parallèles sur 1
  unité de stock**. Assert `final.stockQuantity >= 0` après résolution.
  Remplace le mock séquentiel du `orders.race.test.ts` actuel.
- [ ] Suite `services/ecommerce/src/routes/auth/password-reset.real.test.ts` :
  2 callers concurrents sur le même token. Assert 1 gagne, 1 perd,
  `user.passwordHash` est celui du gagnant.
- [ ] Suite `services/crm/src/routes/customers/customer-merge.real.test.ts` :
  merge de 2 comptes avec vraie data (orders + tickets + loyaltyPoint),
  assert que tout est migré dans la même transaction, crash-inject
  avec `SIGKILL` mid-transaction et assert que la DB est dans un
  état propre après restart.
- [ ] Les 3 nouvelles suites tournent en CI via un service Postgres
  Testcontainers (pas le `services: postgres` du YAML, qui est statique).

Gate semaine 2 : les bugs P0-A, P1-5 et P0-4 ont une preuve réelle
d'atomicité, pas juste de pattern.

### Semaine 3 — Migration rehearsal sur data réaliste

**Objectif** : tester les migrations Prisma sur une copie anonymisée
du dataset prod avant de les merger.

Outil : [Neon branch](https://api-docs.neon.tech/reference/createprojectbranch)
+ [anonymized branch](https://api-docs.neon.tech/reference/createprojectbranchanonymized).
Une branche Neon se crée en secondes, contient la data prod anonymisée
(PII strippée automatiquement), on rejoue les migrations dessus, on
valide, on détruit la branche.

Livrables :

- [ ] Neon project configuré (ou équivalent — si le stack prod reste
  sur Railway Postgres, étudier le provisioning d'une instance
  Postgres dédiée rehearsal qui restaure nightly un dump anonymisé)
- [ ] GitHub Action `migration-rehearsal.yml` qui, sur toute PR
  touchant `packages/database/prisma/`, :
  - Crée une branche Neon anonymized depuis main
  - Applique les migrations pending via `prisma migrate deploy`
  - Lance `prisma validate` + un subset des intégration tests
  - Rapport posté comme comment PR
  - Détruit la branche
- [ ] Gate : pas de merge d'une PR avec migration si le rehearsal
  Neon fail (required status check)
- [ ] Documentation : `docs/MIGRATION_REHEARSAL.md` qui explique le
  workflow pour les futurs contributeurs

Gate semaine 3 : aucune migration ne peut merger sans avoir été
rejouée sur vraie data récente.

### Semaine 4 — Provenance et contrat ASVS

**Objectif** : prouver ce qu'on build et ce qu'on déploie, ancrer les
specs dans des référentiels versionnés.

Outils : [GitHub artifact attestations](https://docs.github.com/actions/concepts/security/artifact-attestations)
pour la provenance SLSA, [SLSA 1.2](https://slsa.dev/spec/v1.2/whats-new)
comme niveau cible, [ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/)
comme référentiel d'exigences, [NIST SSDF Rev.1 (draft déc. 2025)](https://csrc.nist.gov/pubs/sp/800/218/r1/ipd)
comme cadre méthodologique.

Livrables provenance :

- [ ] `.github/workflows/docker-build.yml` émet des attestations
  SLSA niveau 3 pour les 5 images Docker (ecommerce/crm/sav/analytics/web)
  via `actions/attest-build-provenance`
- [ ] `deploy-production.yml` vérifie la provenance avec
  `gh attestation verify` avant de push sur Railway
- [ ] Règle : pas de deploy prod sans attestation valide, signée,
  liée à un commit sur `main` qui a passé la Merge Queue
- [ ] Ajout d'une section "Provenance" dans `docs/GOVERNANCE.md`

Livrables ASVS/SSDF :

- [ ] Template `security-spec.md` augmenté pour exiger une citation
  [ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/)
  valide par MUST (déjà présent, à valider par une action custom)
- [ ] GitHub Action `validate-asvs-refs.yml` qui vérifie sur chaque
  PR que les `Refs: ASVS V_._._` du body pointent vers des
  requirements réels du JSON ASVS
- [ ] Intégration des 4 pratiques SSDF Rev.1 pertinentes dans
  `docs/GOVERNANCE.md` (PO.1, PO.3, PW.1, PW.7)
- [ ] Spec rétroactive P0-3 (`docs/security-specs/P0-3-crm-cron-bypass.md`)
  re-signée avec les nouvelles références ASVS validées par l'action
- [ ] Spec rétroactive P0-A et P0-4 écrites sur le même format pour
  avoir 3 exemples canoniques

Gate semaine 4 : aucun deploy prod sans provenance + aucune spec
sensitive sans ASVS valide.

### Synthèse du plan 30j

```
Sem 0  ── ship contrôlé des 4 P0 avec outils actuels
Sem 1  ── Rulesets + Merge Queue + merge protection     (policy as code)
Sem 2  ── Testcontainers sur stock, auth, merge         (sémantique DB)
Sem 3  ── Neon rehearsal sur toutes les migrations      (data réaliste)
Sem 4  ── SLSA provenance + ASVS/SSDF enforced          (preuve + contrat)
```

Chaque semaine a **un gate mesurable** qui rend la régression
impossible. Si une semaine N échoue son gate, la semaine N+1 n'ouvre
pas — on fix et on recommence. Pas de "on rattrapera plus tard".

---

## 13. Sources 2026

### Policy as code & merge governance

- [GitHub Rulesets — available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [GitHub Merge Queue — management](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- [GitHub Code Scanning — merge protection](https://docs.github.com/en/enterprise-cloud%40latest/code-security/concepts/code-scanning/merge-protection)
- [GitHub CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

### Tests sémantiques

- [Testcontainers Node — PostgreSQL module](https://node.testcontainers.org/modules/postgresql/)
- [fast-check — property-based testing](https://fast-check.dev/)

### Migration rehearsal

- [Neon API — create project branch](https://api-docs.neon.tech/reference/createprojectbranch)
- [Neon API — create anonymized branch](https://api-docs.neon.tech/reference/createprojectbranchanonymized)

### Provenance & supply chain

- [GitHub Artifact Attestations](https://docs.github.com/actions/concepts/security/artifact-attestations)
- [SLSA 1.2 — what's new](https://slsa.dev/spec/v1.2/whats-new)

### Specs & référentiels

- [OWASP ASVS v5.0.0](https://owasp.org/www-project-application-security-verification-standard/) (30 mai 2025)
- [NIST SP 800-218 SSDF v1.1 (final)](https://csrc.nist.gov/pubs/sp/800/218/final)
- [NIST SP 800-218 Rev 1 (draft, 17 déc. 2025)](https://csrc.nist.gov/pubs/sp/800/218/r1/ipd)
- [OWASP Requirements in Practice](https://devguide.owasp.org/en/03-requirements/01-requirements/)
- [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) + [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- [Google SRE Postmortem Culture](https://sre.google/workbook/postmortem-culture/)

### Internal references

- `AUDIT_METHODOLOGY.md` — les 7 layers de vérification
- `AUDIT_ATOMIC.md` — le dernier atomic audit (source du delta)
- `AUDIT_PRODUCTION_CRITICAL.md` — les 4 P0 originaux
- `HANDOFF_CODEX.md` — protocole de coopération Claude ↔ Codex
- `docs/GOVERNANCE.md` — operating manual specs + CODEOWNERS
- `docs/security-specs/P0-3-crm-cron-bypass.md` — premier exemple de spec rempli
- `.github/ISSUE_TEMPLATE/security-spec.md` — template Codex
- `.semgrep/trottistore.yml` — custom rules auditées
