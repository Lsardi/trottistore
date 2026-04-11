---
owner: codex
created: 2026-04-11
status: ready
priority: mixed (P0 → P3)
---

# Codex next batch — 2026-04-11

Triage `fix-*` terminé, PRs #106-#110 ouvertes par Claude pour le compte de Codex (sandbox `gh pr create` cassé). Pendant que le merge train tourne, voici la suite.

## Ordre d'exécution recommandé

T1 (5 min) → T2 (15 min) → T3 (1-2h) → T4 (2-3h) → T5 (déblocage DB)

---

## T1 — Fix `seed.ts` upsert qui ne touche pas le passwordHash existant

**Sévérité:** P1 (bloque le compte admin prod après C4.2)
**Effort:** 5 min

**Contexte:** C4.2 vient de migrer `seed.ts` de argon2 à bcrypt (PR #105 mergée). MAIS `prisma.user.upsert` utilise `update: {}` → un user existant garde son **vieux hash argon2 invalide**. L'admin de prod (`admin@trottistore.fr`) ne peut donc toujours pas se logger même après le déploiement de #105 et la rotation du secret `SEED_ADMIN_PASSWORD`.

**Action:**
- `scripts/seed.ts` : passer `update: { passwordHash, emailVerified: true }` dans le `upsert` pour les 3 users seedés.
- Effet bord à documenter dans le commit : chaque re-run de `pnpm seed` clobbera le password admin si jamais quelqu'un l'a changé via UI. Acceptable pour la phase démo, à reconsidérer post-prod.

**Validation:**
- `pnpm test:smoke` reste vert
- Re-run staging seed et tester le login `admin@trottistore.fr` avec la valeur du secret `SEED_ADMIN_PASSWORD`

**Refs:**
- `scripts/seed.ts:182` (l'upsert avec `update: {}`)
- `services/ecommerce/src/routes/auth/index.ts:254` (le bcrypt.compare authoritative)

---

## T2 — C4.3 Stale `start` scripts `node dist/index.js` dans 4 services Fastify

**Sévérité:** P2 (dette runtime, n'impacte pas le déploiement actuel via tsx)
**Effort:** 5 min

**Contexte:** Audit Lite Railway (PR #94) a noté F2 : les `package.json` des 4 services Fastify ont `"start": "node dist/index.js"` mais `dist/` n'existe plus depuis qu'on est passé à `tsx --import` au runtime (PR #93). Le Dockerfile prod utilise tsx, donc fonctionnel — mais n'importe qui qui run `pnpm --filter @trottistore/service-X start` localement va être confus.

**Action:**
- 4 fichiers `services/{ecommerce,crm,sav,analytics}/package.json` : remplacer `"start": "node dist/index.js"` par `"start": "tsx --import tsx src/index.ts"` (ou ce qui matche le runtime Docker).
- Valider que les Dockerfiles ne dépendent pas du script `start` (ils invoquent directement la commande, normalement).

**Validation:**
- `pnpm --filter @trottistore/service-ecommerce start` doit démarrer en local
- CI build vert sur les 4 docker images

---

## T3 — C4.1 Stripe webhook stock decrement non guardé + sibling SAV

**Sévérité:** P1 (vrai bug d'intégrité stock, peut causer oversell)
**Effort:** 1-2h

**Contexte:** Audit Lite Railway PR #94 + finding pendant la session démo. Le webhook Stripe `handlePaymentSuccess` décrémentait le stock une 2e fois (déjà fixé par PR #89). MAIS le pattern reste fragile : pas de guard contre "stock insuffisant au moment du décrément", pas d'extraction en module shared, pas de gestion du cas "client déjà chargé mais stock épuisé entre l'order create et le webhook" (race condition production-grade).

**Action proposée:**
1. Extraire `decrementStockOrThrow(tx, variantId, qty)` dans `packages/shared/src/stock.ts` (ou similaire) — opération atomique avec garde `stockQuantity >= qty`.
2. L'utiliser dans `services/ecommerce/src/routes/orders/index.ts` (création d'order) ET `services/ecommerce/src/routes/checkout/index.ts` `handlePaymentSuccess`.
3. Sur échec stock dans le webhook : déclencher un flow "STOCK_REGRET" — soit refund Stripe automatique, soit insertion dans une queue pour décision manuelle (ticket SAV ?).
4. Sibling SAV : vérifier si le pattern existe aussi dans `services/sav` (probablement non, mais à confirmer — pièces réservées sur ticket repair).
5. Red test : 2 webhooks concurrents pour le même variant à stock 1 → un seul succède.

**Validation:**
- Tests unit + integration ciblés sur ecommerce checkout
- `pnpm test:smoke` vert
- Idéalement testcontainers (chantier S2) mais OK avec mocks robustes pour cette PR

**Refs:**
- `services/ecommerce/src/routes/checkout/index.ts:393` (commentaire actuel sur le double-decrement déjà fixé par #89)
- `services/ecommerce/src/routes/orders/index.ts:521` (le decrement initial)

---

## T4 — Décision DB sizing pour `claude/fix-order-item-product-index` (BLOCKED)

**Sévérité:** dette perf, pas de bug
**Effort:** 30 min analyse + 1h runbook

**Contexte:** La branche ajoute des index `product_id` et `variant_id` sur `order_items`. Migration valide mais utilise `CREATE INDEX` (non-CONCURRENTLY) sous `prisma migrate deploy` → lock write potentiel sur prod si la table est grosse.

**Action:**
1. Mesurer la taille actuelle de `ecommerce.order_items` en prod via Railway :
   ```
   railway run --service @trottistore/service-ecommerce --environment production -- node -e \
     "(async()=>{const{PrismaClient}=require('@trottistore/database');const p=new PrismaClient();const r=await p.\$queryRaw\`SELECT COUNT(*) FROM ecommerce.order_items\`;console.log(r);await p.\$disconnect()})()"
   ```
2. Si < 100k rows : accepter le lock (qq centaines de ms). Reformuler la PR comme MERGE.
3. Si >= 100k : runbook séparé :
   - Sortir l'index de la migration Prisma
   - Marquer la migration comme `applied` via `prisma migrate resolve --applied <name>`
   - Exécuter `CREATE INDEX CONCURRENTLY` à la main via psql Railway, hors heure de pointe
   - Documenter dans `RELEASE_RUNBOOK.md`

**Décision finale:** à valider avec @Lsardi avant action.

**Refs:**
- `claude/fix-order-item-product-index` (branche source, déjà rebasée)
- `docs/codex-tasks/triage-fix-branches-2026-04-11.md` section BLOCKED

---

## T5 — (Optionnel, si T1-T4 finis) C4.7 Audit Lite F3 doc

**Sévérité:** méthodologie / doc
**Effort:** 10 min

Ajouter F3 (seed argon2/bcrypt mismatch) au registre `docs/audits/2026-04-11-railway-rehab-lite.md` comme dette honnête découverte par la session démo. Aujourd'hui le doc liste F1 (Stripe webhook stock) et F2 (start scripts dist/) mais pas F3. Cohérence du registre.

---

## Coordination

- Pendant cette batch, Claude est sur le merge train des PRs #106-#110 (sécurité P0/P1 codex) puis surveille les déploys.
- Pas de chevauchement de fichiers attendu :
  - T1 = `scripts/seed.ts` (touché par #105 mergée, isolé)
  - T2 = 4 `package.json` services (aucune autre PR ne les touche)
  - T3 = `services/ecommerce/checkout` + `orders` (touchés par #108 et anciennement #89, mais sur d'autres lignes — vérifier au moment du rebase)
  - T4 = pas de code, juste une décision et potentiellement un nouveau runbook
- Si conflit avec une PR du merge train, priorité au merge train (c'est P0 sécurité), T3 rebase.

## Ouverture des PRs

Pour ouvrir tes PRs : si le sandbox `gh pr create` est toujours cassé, push tes branches `review/fix-*` ou `codex/*`, et Claude pourra les ouvrir via le même canal qu'aujourd'hui.

---

*Brief rédigé par Claude Opus 4.6 — 2026-04-11*
