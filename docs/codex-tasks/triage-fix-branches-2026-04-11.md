---
owner: codex
created: 2026-04-11
status: ready
priority: P1
parallel-with: claude is on claims-audit (C1)
---

# Codex task — Triage des branches `claude/fix-*`

## Contexte

6 branches `claude/fix-*` contiennent des bugfixes sécurité/perf déjà écrits avec red tests, jamais ouvertes en PR. Origine: passe sécurité antérieure. Toutes 15 commits derrière `main` au 2026-04-11. `git merge-tree` ne signale **aucun conflit textuel** mais on n'a pas vérifié les conflits sémantiques (ex: PR #89 vient de toucher `services/ecommerce/src/routes/orders/index.ts` et le plugin `auth.ts` sur les 4 services).

Objectif: trier les 6, ouvrir des PR pour celles qui tiennent la route, jeter ou réécrire le reste. **Une PR par branche** (pas de bundle), pour garder la review atomique.

## Les 6 branches

| # | Branche | Sujet | Fichiers touchés | Red test ? |
|---|---|---|---|---|
| 1 | `claude/fix-crm-cron-bypass` | P0-3: x-internal-cron auth via per-process secret nonce + scope POST `/triggers/run` only | `crm/src/index.ts`, `crm/src/lib/cron-auth.ts`, `crm/src/routes/triggers/index.ts`, test (+365/-11) | ✅ |
| 2 | `claude/fix-crm-customer-merge` | P0-4: rendre le merge customer atomique (transaction) | `crm/src/routes/customers/index.ts`, test (+209/-41) | ✅ |
| 3 | `claude/fix-order-item-product-index` | P1-8: index sur `order_items.product_id` + `variant_id` | `prisma/schema.prisma` + nouvelle migration (+40/-0) | n/a (DDL) |
| 4 | `claude/fix-orders-status-idor` | P1-1: supprime la route legacy `PUT /orders/:id/status` (IDOR) | `ecommerce/src/routes/orders/index.ts`, test (+92/-130) | ✅ |
| 5 | `claude/fix-password-reset-race` | P1-5: claim atomique du token de reset password (anti-race) | `ecommerce/src/routes/auth/index.ts`, test (+77/-14) | ✅ |
| 6 | `claude/fix-sav-quote-accept-idor` | P1-2: TECHNICIAN guard `assignedTo` sur `/quote/accept` | `sav/src/routes/tickets/index.ts`, test (+155/-3) | ✅ |

## Points d'attention par branche

- **#3 (index migration)** : la migration utilise `CREATE INDEX` (non CONCURRENTLY) — vérifier le `Prepare DB` step de `deploy-production.yml` et la taille actuelle de `order_items` en prod (Neon/Postgres). Si la table est grosse, ça peut lock en write pendant la migration. Soit accepter le lock (valider avec @Lsardi), soit basculer en CONCURRENTLY hors `prisma migrate deploy` (script séparé).
- **#4 (orders-status-idor)** : touche `services/ecommerce/src/routes/orders/index.ts` qui a été modifié par PR #89 (ajout de `getSessionIdFromCartKey`). `git merge-tree` clean mais valider que le retrait de la route legacy ne casse aucun appel admin/dashboard côté `apps/web/src/app/(admin)`. Grep sur `/orders/.*/status` dans `apps/web` avant merge.
- **#5 (password-reset-race)** : touche `routes/auth/index.ts`. PR #89 n'a pas touché ce fichier (que `plugins/auth.ts`). Clean a priori.
- **#1 (crm-cron-bypass)** : per-process nonce — vérifier que `cron-triggers-run.yml` (workflow) génère le secret au runtime et le passe dans le header. Sinon on casse la prod cron.

## Format de sortie attendu

Pour chaque branche, produis une décision dans un commentaire de PR ou ce doc:

- **MERGE** — rebasable clean, tests verts, pas de régression sémantique → ouvrir PR + mark prête à merger
- **REWRITE** — bonne intention mais conflit sémantique avec main / approche obsolète → rouvrir l'issue technique, écrire une nouvelle branche
- **OBSOLETE** — déjà fixé sur main par un autre PR → fermer la branche, supprimer
- **BLOCKED** — dépend de quelque chose d'autre (decision produit, var d'env) → noter le bloqueur

Exemple d'output souhaité (par branche):

```
### claude/fix-crm-cron-bypass — DECISION: MERGE
- Rebase: clean
- CI: pass (lien run)
- Risk: low — touche que crm cron path
- Action: PR ouverte #NNN, ready to squash
```

## Procédure recommandée

```bash
# Pour chaque branche, dans cet ordre (#3 et #4 en dernier car risque le + élevé):
git fetch origin
git checkout -b review/fix-crm-cron-bypass origin/claude/fix-crm-cron-bypass
git rebase origin/main
# résoudre conflits si présents
pnpm install && pnpm test:project crm  # service ciblé
pnpm test:smoke
git push -u origin review/fix-crm-cron-bypass
gh pr create --base main --head review/fix-crm-cron-bypass --title "fix(crm): scope cron bypass to POST /triggers/run only (P0-3)" --body "Rebased from claude/fix-crm-cron-bypass — see docs/codex-tasks/triage-fix-branches-2026-04-11.md"
```

## Coordination avec Claude

Claude est en parallèle sur le **Chantier 1 — Claims audit** (`claude/fix-claims-audit`).
- Pas de chevauchement de fichiers attendu (claims = `apps/web` UI/copy, fix-* = services backend + DB).
- Si un conflit apparaît (peu probable), priorité au merge claims audit (P0 légal).

Statut courant des deux pistes à mettre à jour ici à la fin.

## À faire après triage

Si toutes les 6 mergent: la dette security P0-3, P0-4, P1-1, P1-2, P1-5, P1-8 est purgée. Ça débloque le chantier S2 Testcontainers (C5) qui n'a plus de doute dormant à porter.

---

*Brief rédigé par Claude Opus 4.6 — 2026-04-11*
