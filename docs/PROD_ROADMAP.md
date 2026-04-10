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

- **Semaine 0** (aujourd'hui → demain matin) : ship contrôlé des 4 P0
  avec le dispositif actuel. Critical path minimal : **governance
  minimale → P0 → audit sweep → tag → staging → prod**. Les P1 et
  la spec rétro sont **explicitement reportés en post-prod** pour
  réduire le delta audité et la surface de rollback. Détails §1-§11.

- **Semaines 1-4** : industrialisation. Passe de "manual gates signés
  par Claude+Codex" à "policy-as-code, merge queue, artifact
  attestations, testcontainers, Neon rehearsal". Détails §12.

Retarder la semaine 0 pour attendre l'industrialisation serait une
erreur : les 4 P0 sont des vulnérabilités exposées en production
actuellement. On ship d'abord, on durcit ensuite.

Décisions finales (Claude ↔ Codex, 2026-04-10 après 2 rounds
d'adversarial review) :

| Question | Décision |
|---|---|
| Séquence en 2 temps | ✅ validée |
| Tag de release | `v0.9.0-rc1` (référence **unique** partout dans le doc) |
| Qui exécute audit sweep | Claude = passes A+B, Codex = passe C adversarial |
| P0-A migration heal | heal existing negative stock **avant** `CHECK`, pas en follow-up |
| Fenêtre de deploy | créneau faible trafic, surveillé, hors pic commercial |
| Qui déclenche `workflow_dispatch` | @Lsardi seul, après lecture du passport |
| Audit tooling semaine 0 | agents Explore + revue humaine — **pas** d'Ollama pour le gate |
| Ordre de merge critical path | governance minimale → P0 → sweep → tag → staging → prod |
| P1 et spec rétro | **post-prod** (après staging + prod OK, via Merge Queue semaine 1 si possible) |
| Passport pre-prod | **hors main** — release asset attaché au tag via `gh release create` |
| `claude/governance-tooling` | **reporté semaine 1** — sera réécrit pour merge_group + Rulesets |

### Corrections apportées par l'adversarial review Codex

**Round 2** du 2026-04-10 — 3 findings bloquants que Codex a trouvés :

1. **Boucle auto-référentielle du passport** : la version précédente
   versionnait le passport sur `main` via une PR dédiée, ce qui
   changeait le HEAD audité après signature. Corrigé : le passport
   est maintenant un artifact hors main, attaché au tag via
   `gh release create` (§5.5).

2. **P1 dans le critical path** : la version précédente mergeait les
   4 P1 et la spec rétro avant l'audit sweep, élargissant le delta
   audité et la surface de rollback. Corrigé : le critical path
   semaine 0 contient uniquement governance minimale + P0 + sweep +
   deploy. P1 et spec rétro sont en étapes post-prod (§3).

3. **Tag incohérent** : la version précédente avait `v0.9.0-rc1`
   dans les décisions mais `v1.0.0` dans la procédure de deploy.
   Corrigé : `v0.9.0-rc1` est maintenant l'unique référence
   opérationnelle (§4, §6, §10).

**Round 3** du 2026-04-10 — 2 findings bloquants supplémentaires :

4. **Deploy non pin sur le SHA audité** : la procédure §6 précédente
   utilisait `gh workflow run deploy-*.yml` sans `--ref`. Les
   workflows checkoutent le ref du run via `actions/checkout@v4`.
   Si `main` bougeait entre le tag et le `workflow_dispatch`, on
   pouvait déployer un autre commit que celui du passport. Même
   classe de boucle auto-référentielle que le round 2 point 1,
   appliquée au workflow au lieu du passport. Corrigé : chaque
   `gh workflow run` passe désormais `--ref v0.9.0-rc1`, la
   procédure vérifie le SHA déployé après chaque déclenchement, et
   un durcissement workflow (`expected_sha` input) est planifié en
   semaine 1 (§12).

5. **Migration P1-8 encore dans la checklist semaine 0** : §4.2
   listait la migration `20260410160000_order_item_product_variant_indexes`
   comme prérequis semaine 0, alors que P1-8 est maintenant
   post-prod (§3 étape 5). Un opérateur aurait cru devoir appliquer
   cette migration avant le go P0. Corrigé : §4.2 ne liste plus
   que la migration P0-A, avec une note explicite que P1-8 est
   hors scope semaine 0.

**Round 4** du 2026-04-10 — 1 finding bloquant sur la corrélation de runs :

6. **Corrélation `gh run list --limit 1` racable** : la procédure
   round 3 récupérait le run ID via `gh run list --limit 1 --jq '.[0]'`
   après chaque `gh workflow run`. Si plusieurs runs du même workflow
   partaient en parallèle ou en séquence rapprochée (par exemple
   pendant les 5 déclenchements service-par-service initialement
   prévus), le `.[0]` pouvait pointer sur un run antérieur ou parallèle
   au lieu du run qu'on venait de déclencher. Risque : vérifier le
   SHA du mauvais run et croire que le deploy est OK alors qu'il
   part ailleurs.

   Corrigé sur deux dimensions (recommandations Codex round 4) :
   - **Simplification opérationnelle** : un seul `gh workflow run -f service=all`
     au lieu de 5 runs séquentiels. Supprime la classe entière de bugs
     multi-runs par construction. Plus un seul point de rollback.
     Moins de fenêtres d'état intermédiaire.
   - **Corrélation multi-critères robuste** : le `gh run list` filtre
     maintenant par `headSha == TARGET_SHA` + `event == workflow_dispatch`
     + `createdAt >= DISPATCH_TIME`. Aucun risque de capturer un run
     antérieur ou concurrent.
   - **Plan semaine 1** : ajout d'un input `deploy_token` (UUID)
     et d'un `run-name` qui inclut le token, pour une corrélation
     déterministe sans race même en scénario multi-run (§12).

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

**Principe** : le critical path semaine 0 contient **uniquement** ce qui
est strictement nécessaire pour shipper les 4 P0 en toute sécurité. Les
P1 et la spec rétro sont retirés du chemin critique pour **minimiser le
delta audité**, **réduire la surface de rollback**, et **éviter qu'une
migration P1-8 supplémentaire ne s'ajoute au bundle**. Correction suite
à finding adversarial Codex du 2026-04-10.

```
SEMAINE 0 — CRITICAL PATH (ship des 4 P0)

ÉTAPE 1 — Governance minimale (rend le reste traçable, non intrusif)
├── [1] codex/governance-spec-template       (template seul)
├── [2] codex/methodology-threatmodel        (threat model + runbook)
└── [3] claude/audit-docs                    (docs audit)

  Note : claude/governance-tooling est REPORTÉ en semaine 1. La
  branch protection legacy suffit pour la semaine 0. Ses Rulesets
  + custom workflow seront repensés pour merge_group en semaine 1
  (voir §12 semaine 1), il est contre-productif de les merger
  maintenant puis de les réécrire dans 5 jours.

ÉTAPE 2 — P0 (débloque la prod)
├── [4] codex/fix-stock-race-oversell        ← stock
├── [5] codex/fix-checkout-decimal-math      ← argent
├── [6] claude/fix-crm-cron-bypass           ← auth
└── [7] claude/fix-crm-customer-merge        ← data

ÉTAPE 3 — Pre-prod audit sweep (OBLIGATOIRE avant tag)
└── [8] Exécution des passes A/B/C — voir §5
        Produit le passport (voir §5.5 pour le stockage)

ÉTAPE 4 — Tag + deploy
├── [9]  git tag -a v0.9.0-rc1 -m "…"
├── [10] gh workflow run deploy-staging.yml
├── [11] Smoke staging (health + parcours critiques)
└── [12] gh workflow run deploy-production.yml  ← @Lsardi seul

─────────────────────────────────────────────────────────────────
POST-PROD (semaine 0 suite, après go live confirmé)

ÉTAPE 5 — P1 (réduit le risque résiduel)
├── [13] claude/fix-orders-status-idor
├── [14] claude/fix-sav-quote-accept-idor
├── [15] claude/fix-password-reset-race
└── [16] claude/fix-order-item-product-index ← contient une migration
         ⚠ deuxième deploy nécessaire pour appliquer la migration
         en prod. Peut attendre semaine 1 via Merge Queue.

ÉTAPE 6 — Clôture boucle governance
└── [17] claude/spec-retro-p03
```

**Pourquoi P1 et spec rétro sont hors du critical path** :

1. Les P1 ne bloquent pas la prod (par définition). Les inclure avant
   l'audit sweep élargit le delta audité inutilement.
2. `claude/fix-order-item-product-index` contient une migration
   (`20260410160000_order_item_product_variant_indexes`). La merger
   avant le sweep oblige à auditer un ALTER TABLE en plus des 4 P0.
   Hors chemin critique, on peut la merger via la Merge Queue semaine 1
   avec le rehearsal Neon actif.
3. Rollback surface : si prod part mal après les P0, on revert les 4
   P0. Avec 4 P1 + 1 spec en plus, le revert couvre 9 changements au
   lieu de 4. Moins de precision, plus de risque d'effets bord.
4. `claude/governance-tooling` est retiré aussi : il sera réécrit
   semaine 1 pour cibler `merge_group` et les Rulesets. Le merger
   semaine 0 crée de la dette immédiate.

**Ordre = zéro conflit connu** sur les 3 étapes de la semaine 0. Les
3 governance docs sont additives entre elles et avec les 4 P0. Les 4 P0
touchent des fichiers distincts (stock dans `orders/`, decimal dans
`checkout/` + `cart-totals.ts`, cron dans `crm/triggers/`, merge dans
`crm/customers/`).

**Fenêtre réaliste** :

- Étapes 1-2 : ~20 min de merges + CI si tout va bien
- Étape 3 (audit sweep) : ~1h wallclock, non négociable
- Étape 4 (tag + deploy) : ~30 min avec staging + smoke + prod
- **Total semaine 0 critical path : ~2h** entre "go" et "prod live"
- Étapes 5-6 (post-prod) : à faire J+1 ou semaine 1

---

## 4. Checklist pré-prod (à cocher avant le `workflow_dispatch`)

### 4.1 Code et merges

- [ ] Les 4 P0 de l'étape 2 sont mergés sur `main`
- [ ] CI verte sur le commit HEAD de `main` (lint + tests + smoke + build + security scan)
- [ ] `pnpm audit --audit-level=high` passe
- [ ] Aucun commit WIP ou `wip:` sur `main`
- [ ] Git tag créé : `git tag -a v0.9.0-rc1 -m "TrottiStore v0.9.0-rc1 — P0 fixes + governance" && git push origin v0.9.0-rc1`

### 4.2 Base de données (semaine 0)

Seules les migrations liées aux P0 du critical path sont attendues
en semaine 0. La migration `20260410160000_order_item_product_variant_indexes`
appartient à `claude/fix-order-item-product-index` (P1-8) qui est
**explicitement reporté en post-prod** (§3 étape 5). Ne pas l'appliquer
dans la fenêtre semaine 0 — elle sera traitée en post-prod, idéalement
via le rehearsal Neon de la semaine 3.

- [ ] `prisma validate` passe sur `main`
- [ ] Migration `20260410151000_stock_quantity_non_negative` (P0-A)
      **appliquée manuellement en staging en premier** pour valider
      le heal des données négatives existantes et le `CHECK` constraint
  - ⚠️ Peut échouer en prod si rows avec `stock_quantity < 0` existent
  - Solution : la migration elle-même contient
    `UPDATE product_variants SET stock_quantity = 0 WHERE stock_quantity < 0;`
    **avant** le `ADD CONSTRAINT` (décision §10 point 2)
- [ ] Backup DB fraîche (`infra/backup-db.sh` sur staging, pareil en prod)
      **avant** le deploy prod, pas après

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
# Point de départ : main à jour, les 4 P0 mergés, rien d'autre
git checkout main && git pull

# Capturer le SHA baseline du dernier audit
BASELINE_SHA="1bf9b5f"  # commit au moment de AUDIT_ATOMIC.md
TARGET_SHA=$(git rev-parse HEAD)
TARGET_SHORT=$(git rev-parse --short=7 HEAD)

# Liste des fichiers modifiés entre baseline et HEAD
git diff --name-only "$BASELINE_SHA" "$TARGET_SHA" \
  | grep -E '\.(ts|tsx|prisma|sql)$' \
  > /tmp/audit-sweep-files.txt

# Lancer la passe A (delta) via les agents Explore
# Voir AUDIT_METHODOLOGY.md section "Stratégie multi-LLM"
# Un agent par question, code quoté, vérification humaine des
# findings HIGH/CRITICAL

# Écrire le passport dans /tmp, JAMAIS dans main
mkdir -p /tmp/trottistore-passport
PASSPORT=/tmp/trottistore-passport/AUDIT_PREPROD_${TARGET_SHORT}.md
```

**Outil d'audit pour la semaine 0 : agents Explore Claude/Codex
uniquement.** L'Ollama 7b local est **explicitement exclu** du gate
critique (décision §10 point 7). Il reste un outil de triage valide
pour des investigations post-ship ou des surveys exploratoires, mais
**jamais pour la décision de shipper**.

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

### 5.5 Résultat — passport de prod (hors main)

**Contrainte auto-référentielle** : la passe A audite le delta
`BASELINE_SHA → CURRENT_SHA`. Si on versionne le passport sur `main`
via une PR dédiée, HEAD change après l'audit, et le passport ne couvre
plus exactement le commit qui sera taggé. Le passport devient
invalidé par son propre acte de signature.

**Solution semaine 0** : le passport est un **artifact hors main**.
Concrètement :

1. Le fichier s'appelle `AUDIT_PREPROD_<TARGET_SHA>.md`, où
   `TARGET_SHA` est le 7 premiers caractères du commit qu'on va
   tagger (pas `<date>`).
2. Il est écrit dans `/tmp/trottistore-passport/` pendant l'audit,
   **jamais** committé sur `main`.
3. À la fin de l'audit, le fichier est uploadé comme release asset
   sur le tag `v0.9.0-rc1` via `gh release create ... --attach` —
   ou, alternative, attaché à un GitHub Issue dédié
   `[Release v0.9.0-rc1] Pre-prod audit passport` pour traçabilité.
4. Une copie est archivée par `@Lsardi` dans un stockage long-terme
   (S3, drive, peu importe) pour audit trail réglementaire.

**Alternative envisagée et rejetée** : re-signer le passport sur le
SHA final avec un commit `chore(audit): passport for <sha>`. Rejetée
parce que (a) ça demande un 2e passage d'audit sur le 2e SHA pour
être cohérent, (b) ça relance la boucle auto-référentielle, (c) ça
pollue l'historique `main`.

**Format du passport** (contenu du fichier) :

```markdown
# Pre-prod audit passport — v0.9.0-rc1

Target SHA: <40-char full SHA>
Target tag: v0.9.0-rc1
Baseline SHA: 1bf9b5f (last atomic audit)
Audit window: <ISO8601 start> → <ISO8601 end>

## Delta audité

<git diff --name-only baseline target>

## Passes

### Passe A — Delta audit
Executor: Claude
Findings: <N> (HIGH: <n>, CRITICAL: <n>)
Verdict: PASS | FAIL
Details: <link or inline>

### Passe B — Smoke audit
Executor: Claude
Findings: <N>
Verdict: PASS | FAIL
Details: <link or inline>

### Passe C — Adversarial per P0
Executor: Codex
P0-A stock race:        PASS | ROLLBACK (reason)
P0-B decimal math:      PASS | ROLLBACK (reason)
P0-3 cron bypass:       PASS | ROLLBACK (reason)
P0-4 customer merge:    PASS | ROLLBACK (reason)
Verdict: PASS | FAIL

## Gate §5.3

- [x/ ] Pass A: 0 HIGH/CRITICAL
- [x/ ] Pass B: 0 regression
- [x/ ] Pass C: 0 rollback reason
- [x/ ] pnpm test local
- [x/ ] pnpm test:smoke local
- [x/ ] pnpm build local (4 services + web)
- [x/ ] prisma validate local
- [x/ ] No TODO/FIXME/@ts-ignore added in delta

## Approval

- @Lsardi: <signature>
- Claude: <signature>
- Codex: <signature>
```

**Sans ce fichier signé par les trois parties, le
`workflow_dispatch` prod ne doit pas être déclenché.** C'est une
convention semaine 0 ; semaine 1+, la Merge Queue + un required
status check automatisé s'en chargent mécaniquement et le passport
devient un artifact attesté SLSA.

---

## 6. Procédure de déploiement

**Précondition** : l'audit sweep §5 est vert, le passport
`/tmp/trottistore-passport/AUDIT_PREPROD_<sha>.md` est signé par
@Lsardi + Claude + Codex, les 4 P0 sont mergés sur `main`, aucune
autre branche n'a été mergée depuis le début de l'audit (pour éviter
la boucle auto-référentielle décrite en §5.5).

**Règle opérationnelle non négociable** : chaque `gh workflow run`
ci-dessous utilise `--ref v0.9.0-rc1`. Le workflow
`deploy-production.yml` (ligne 26) utilise `actions/checkout@v4` qui
checkout par défaut le ref du run — donc sans `--ref`, un run lancé
depuis n'importe où déploierait `main` actuel, **pas** le commit du
tag audité. Si `main` bouge entre le tag et le `workflow_dispatch`
(autre merge, force-push, hotfix parallèle), on déploierait autre
chose que ce qui est dans le passport. **Toujours pin sur `--ref
v0.9.0-rc1`.** Un durcissement workflow est planifié semaine 1
(voir §12).

```bash
# 0. Vérifier que le HEAD de main est bien celui qui a été audité
TARGET_SHA=$(git rev-parse HEAD)
TARGET_SHORT=$(git rev-parse --short=7 HEAD)
PASSPORT=/tmp/trottistore-passport/AUDIT_PREPROD_${TARGET_SHORT}.md
test -f "$PASSPORT" || { echo "ABORT: no passport for $TARGET_SHA"; exit 1; }
grep -q "Claude: signed" "$PASSPORT" || { echo "ABORT: missing Claude signature"; exit 1; }
grep -q "Codex: signed" "$PASSPORT" || { echo "ABORT: missing Codex signature"; exit 1; }
grep -q "Lsardi: signed" "$PASSPORT" || { echo "ABORT: missing Lsardi signature"; exit 1; }

# 1. Tagger la release (le tag pointe exactement sur le SHA audité)
git tag -a v0.9.0-rc1 "$TARGET_SHA" -m "TrottiStore v0.9.0-rc1 — P0 fixes + governance"
git push origin v0.9.0-rc1

# 1 bis. Vérifier que le tag pointe bien sur le SHA audité (paranoïa)
TAG_SHA=$(git rev-list -n 1 v0.9.0-rc1)
test "$TAG_SHA" = "$TARGET_SHA" || { echo "ABORT: tag points to $TAG_SHA, audited $TARGET_SHA"; exit 1; }

# 1 ter. Attacher le passport au tag comme release asset
gh release create v0.9.0-rc1 \
  --title "v0.9.0-rc1 — P0 fixes + governance" \
  --notes "Pre-prod audit passport attached. See docs/PROD_ROADMAP.md §5." \
  "$PASSPORT"

# 2. Staging d'abord — un seul run avec service=all
#    Simplification volontaire pour la semaine 0 : un seul run par
#    workflow supprime la classe entière de bugs de corrélation
#    multi-runs (cf. Codex round 4 adversarial review). Semaine 1+
#    utilisera un deploy_token unique par run pour corréler sans
#    ambiguïté (§12).
DISPATCH_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gh workflow run deploy-staging.yml --ref v0.9.0-rc1 -f service=all

# 2 bis. Corrélation robuste du run staging par (headSha, event,
#    timestamp). Le filtre multi-critères élimine les runs concurrents
#    ou antérieurs qui pourraient contaminer un `--limit 1` naïf.
sleep 5  # Laisser le temps au dispatch d'apparaître dans l'API
STAGING_RUN_ID=$(gh run list \
  --workflow deploy-staging.yml \
  --json databaseId,headSha,event,createdAt,status \
  --jq "[.[] | select(.headSha == \"$TARGET_SHA\" and .event == \"workflow_dispatch\" and .createdAt >= \"$DISPATCH_TIME\")] | .[0].databaseId")
test -n "$STAGING_RUN_ID" || { echo "ABORT: no staging run matching $TARGET_SHA since $DISPATCH_TIME"; exit 1; }

STAGING_RUN_SHA=$(gh run view "$STAGING_RUN_ID" --json headSha --jq '.headSha')
test "$STAGING_RUN_SHA" = "$TARGET_SHA" || { echo "ABORT: staging run on wrong SHA $STAGING_RUN_SHA"; exit 1; }

# 3. Smoke tests staging (après que le run ait terminé)
gh run watch "$STAGING_RUN_ID"
for port in 3001 3002 3003 3004; do
  curl -fsS https://<staging-host>:$port/health || exit 1
done

# 4. Prod — un seul run avec service=all, même simplification
PROD_DISPATCH_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gh workflow run deploy-production.yml --ref v0.9.0-rc1 -f service=all

# 4 bis. Corrélation robuste du run prod
sleep 5
PROD_RUN_ID=$(gh run list \
  --workflow deploy-production.yml \
  --json databaseId,headSha,event,createdAt,status \
  --jq "[.[] | select(.headSha == \"$TARGET_SHA\" and .event == \"workflow_dispatch\" and .createdAt >= \"$PROD_DISPATCH_TIME\")] | .[0].databaseId")
test -n "$PROD_RUN_ID" || { echo "ABORT: no prod run matching $TARGET_SHA since $PROD_DISPATCH_TIME"; exit 1; }

PROD_RUN_SHA=$(gh run view "$PROD_RUN_ID" --json headSha --jq '.headSha')
test "$PROD_RUN_SHA" = "$TARGET_SHA" || { echo "ABORT: prod run on wrong SHA $PROD_RUN_SHA"; exit 1; }

gh run watch "$PROD_RUN_ID"
```

**Pourquoi `service=all` et pas service-par-service** (décision Codex round 4) :
- 1 run = 0 ambiguïté de corrélation par construction
- 1 point de rollback au lieu de 5
- Plus simple à surveiller (un seul `gh run watch`)
- Le workflow `deploy-production.yml` handle déjà `service=all` nativement (voir lignes 45-77 du workflow)
- L'approche "service par service pour isoler un échec" est séduisante mais crée un risque de déploiement hétérogène si le 3e service échoue — on se retrouve avec 2 services sur v0.9.0-rc1 et 3 sur la version précédente, état dangereux.

Rollback semaine 0 : si le run échoue à mi-parcours, on rollback via Railway UI (§8) sur **tous** les services ensemble, pas par service.

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
#   IMPORTANT: le redeploy doit être pinné sur le commit du revert,
#   pas sur main HEAD. Même règle que §6 pour éviter la boucle
#   auto-référentielle. Tagger explicitement un tag rollback.
git revert <bad-commit-sha>
git push origin main
REVERT_SHA=$(git rev-parse HEAD)
git tag -a v0.9.0-rc1-rollback-1 "$REVERT_SHA" -m "Rollback of v0.9.0-rc1 — reason: <describe>"
git push origin v0.9.0-rc1-rollback-1
gh workflow run deploy-production.yml --ref v0.9.0-rc1-rollback-1 -f service=all

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
- [ ] **Audit des workflows existants** pour les assumptions de contexte :
  tout workflow qui lit `github.event.pull_request.*` ou des champs
  absents sur `merge_group` doit être corrigé. Risque identifié par
  Codex dans sa review 2026-04-10 — le trigger `merge_group` est
  documenté mais les workflows qui dépendent du contexte PR peuvent
  planter silencieusement dans la queue. Buffer de 1-2 jours prévu
  pour traquer ces cas.
- [ ] Les 4 P1 (`claude/fix-orders-status-idor`,
  `claude/fix-sav-quote-accept-idor`,
  `claude/fix-password-reset-race`,
  `claude/fix-order-item-product-index`) passent via la Merge Queue
  pour valider le setup en conditions réelles. `fix-order-item-product-index`
  déclenche en plus le rehearsal Neon de la semaine 3 si ce dernier
  est en avance.

- [ ] **Durcir `deploy-production.yml` et `deploy-staging.yml`** pour
  fermer les 2 brèches identifiées en semaine 0 (rounds 3 et 4
  adversarial review) :
  - **`expected_sha` input** (string, required: true) — défense
    contre un opérateur qui oublie `--ref` sur le CLI.
  - **Premier step du job** : `if [ "$GITHUB_SHA" != "${{ inputs.expected_sha }}" ]; then echo "SHA mismatch: got $GITHUB_SHA expected ${{ inputs.expected_sha }}"; exit 1; fi`.
  - **`deploy_token` input** (string, required: true) — token unique
    généré par l'opérateur à chaque dispatch (`uuidgen` ou `openssl rand -hex 16`).
  - **`run-name`** au niveau workflow YAML :
    ```yaml
    run-name: "deploy ${{ inputs.service }} — ${{ inputs.expected_sha }} — ${{ inputs.deploy_token }}"
    ```
    Le token rend le `run-name` unique par dispatch, ce qui permet
    une corrélation **déterministe et sans race** via :
    ```bash
    RUN_ID=$(gh run list --workflow deploy-production.yml \
      --json databaseId,name --jq \
      "[.[] | select(.name | contains(\"$DEPLOY_TOKEN\"))] | .[0].databaseId")
    ```
  - La procédure semaine 1+ passera `-f expected_sha=<sha> -f deploy_token=<uuid>`
    à chaque `gh workflow run`.
  - Refs : §6 procédure semaine 0 (pin `--ref` + corrélation multi-critères
    pour la période transitoire).

Source : [GitHub Docs — events that trigger workflows (merge_group)](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

Gate semaine 1 : une PR non-governance non-critique ne peut plus
merger sans passer la Merge Queue, aucun workflow ne crash sur
`merge_group` faute de contexte PR, et aucun deploy ne peut partir
sans `expected_sha` explicite.

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

**Décision infra** : on **ne migre pas** la prod de Railway vers Neon
juste pour le branching. C'est un changement d'infra distinct avec son
propre risque. Le bon compromis :

- **Prod reste sur Railway Postgres** (pas touché)
- **Rehearsal uniquement sur Neon** (ou instance Postgres dédiée sur
  un autre provider, peu importe tant que ce n'est pas la prod)
- Le rehearsal ingère un dump anonymisé de la prod nightly

Outils : [Neon API — create branch](https://api-docs.neon.tech/reference/createprojectbranch)
+ [anonymized branch](https://api-docs.neon.tech/reference/createprojectbranchanonymized)
pour la version Neon. Alternative no-Neon : cron nightly qui fait
`pg_dump` de la prod Railway, `pg_anonymize` (ou équivalent home-made
sur les colonnes PII identifiées via schéma Prisma), restore sur une
instance rehearsal.

Livrables :

- [ ] Choix tranché Neon vs "dedicated Postgres + pg_dump anonymized"
  (arbitrage coût/simplicité à faire en ouverture de semaine 3)
- [ ] Provider rehearsal configuré avec credentials séparés,
  firewall-isolé de la prod
- [ ] Pipeline d'anonymisation (colonnes PII identifiées, stratégies
  de masking documentées dans `docs/MIGRATION_REHEARSAL.md`)
- [ ] GitHub Action `migration-rehearsal.yml` qui, sur toute PR
  touchant `packages/database/prisma/` :
  - Provisionne une branche rehearsal (Neon) ou restaure un snapshot
    anonymisé (Postgres dedicated)
  - Applique les migrations pending via `prisma migrate deploy`
  - Lance `prisma validate` + un subset des intégration tests
  - Rapport posté comme comment PR avec le timing + les `\d+` des
    tables touchées
  - Détruit la branche / drop la base
- [ ] Gate : pas de merge d'une PR avec migration si le rehearsal
  fail (required status check sur le Ruleset semaine 1)
- [ ] `docs/MIGRATION_REHEARSAL.md` qui documente le workflow et
  l'escape hatch (run manuel si la CI est down)

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
- [ ] **Source de vérité ASVS** : le CSV officiel v5.0.0 depuis le
  [repo OWASP/ASVS](https://github.com/OWASP/ASVS) (le readme du repo
  mentionne explicitement la publication CSV + une traduction française
  officielle). Pas de parsing Markdown maison. Le CSV est committé
  dans `packages/shared/asvs-v5.0.0.csv` et versionné avec checksum
  SHA256 dans le workflow pour détecter un changement upstream.
- [ ] GitHub Action `validate-asvs-refs.yml` qui vérifie sur chaque
  PR que les `Refs: ASVS V_._._` du body pointent vers des
  requirements réels parsés depuis le CSV.
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
