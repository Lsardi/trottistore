# Handoff Codex ↔ Claude — TrottiStore audit & fixes

> Document de coordination pour bosser en parallèle sans collision, sans duplication, sans angle mort.  
> À lire en premier par Codex avant toute action sur ce repo.

Date: 2026-04-10  
Auteur: Claude (session audit fond-en-comble)  
Lecteur cible: Codex

---

## 1. Contexte en 60 secondes

Tu reprends une session d'audit qui a déjà :
1. **Résolu le conflit de PR #89** (`codex/env-hardening-runbook` ← `main`) et poussé 2 fixes P0 critiques (commit `78196c8`).
2. Produit **3 audits successifs** de qualité croissante :
   - `AUDIT_REPORT.md` — large (6 agents, ~106 findings, **4 faux positifs**)
   - `AUDIT_PRODUCTION_CRITICAL.md` — focus paiement/auth/data (3 agents)
   - `AUDIT_ATOMIC.md` — 10 agents micro-focalisés, code quoté, P0 vérifiés à la main
3. Établi une **méthodologie 7 layers** "fusée lune" : `AUDIT_METHODOLOGY.md`

**Lis ces 4 fichiers dans cet ordre avant tout :**
1. `AUDIT_ATOMIC.md` (source de vérité actionable)
2. `AUDIT_PRODUCTION_CRITICAL.md` (les 4 P0)
3. `AUDIT_METHODOLOGY.md` (comment on bosse)
4. `CLAUDE.md` + `services/*/CLAUDE.md` (conventions repo)

**N'utilise pas `AUDIT_REPORT.md` directement** : il contient 4 faux positifs documentés. Si tu y trouves quelque chose qui n'est pas dans `AUDIT_ATOMIC.md` ou `AUDIT_PRODUCTION_CRITICAL.md`, **vérifie à la main** avant d'agir.

---

## 2. Règles de coopération

### 2.1 Worktree isolé obligatoire

Le repo a un hook pre-push qui bloque les pushes hors du préfixe d'agent. Toi tu pousses sur `codex/*`, moi sur `claude/*`. Avant de bosser :

```bash
pnpm agent:init codex <topic> origin/main
cd .worktrees/codex-<topic>
```

`pnpm agent:status` te montre tous les worktrees actifs et qui touche quoi. **Toujours regarder avant de démarrer.**

### 2.2 Pas de croisement de fichiers

Avant chaque session, on **claim** explicitement les fichiers qu'on touche dans la table ci-dessous (section 5). Si tu vois `claimed by claude` sur un fichier, n'y touche pas — ouvre une nouvelle ligne pour ton fix sur un autre fichier ou propose un swap.

Si tu **dois** absolument toucher un fichier qu'on a en commun :
1. Annonce-le dans le commit message (`coord: codex needs apps/web/src/lib/api.ts for P1-6, claude please pause`)
2. Attends ma confirmation avant de commit

### 2.3 Format de commit unifié

```
<type>(<scope>): <courte description>

- bullet 1 (le quoi)
- bullet 2 (le pourquoi)

Refs: AUDIT_ATOMIC.md#P0-A
Tested-with: pnpm test:project ecommerce, pnpm vitest run src/routes/orders
Co-Authored-By: <ton modèle> <noreply@example.com>
```

`Refs:` doit pointer vers la section précise du rapport d'audit. C'est la traçabilité qu'exige la méthodologie layer 6.

### 2.4 Tests obligatoires avant push

Pour chaque fix tu écris **AVANT** :
1. Un **red test** qui reproduit le bug
2. Le fix
3. Le **green test** qui passe

Pas de fix sans test de régression. C'est non-négociable pour les P0.

### 2.5 Vérification croisée

Avant de pousser un fix P0, tu m'envoies un message via `pnpm agent:status` ou un commit `wip:` sur ta branche. Je le **review en tant qu'adversarial agent** (cf. methodology layer 5) : je cherche 3 raisons pour lesquelles ton fix ne marcherait pas. Si je n'en trouve aucune → tu pousses.

Pareil pour moi quand je fix un P0 : tu reviews en adversaire.

---

## 3. Répartition du travail recommandée

J'ai split les fixes en **4 lots indépendants**. Chaque lot = une PR. On peut bosser en parallèle si chacun prend des lots qui ne se chevauchent pas.

### Lot A — Stock race (P0-A) → **toi (Codex)**

| Élément | Détails |
|---|---|
| **Fichiers** | `services/ecommerce/src/routes/orders/index.ts` (3 spots: ligne 360, 668, 1740+) |
| **Schema** | `packages/database/prisma/schema.prisma` — ajouter `CHECK (stock_quantity >= 0)` via migration |
| **Tests** | `services/ecommerce/src/routes/orders/orders.race.test.ts` (à créer) |
| **Branche** | `codex/fix-stock-race-oversell` |
| **Effort** | 1-2h fix + migration + 1h tests |
| **Approche recommandée** | `updateMany` avec `where: { stockQuantity: { gte: qty } }` + `result.count === 0` → `throw InsufficientStockError`. Voir code dans `AUDIT_ATOMIC.md` section P0-A. |
| **Property test (bonus)** | fast-check : N requêtes parallèles sur stock initial M, vérifier `final >= 0` toujours |

### Lot B — Float math en cart-first checkout (P0-B) → **toi (Codex)**

| Élément | Détails |
|---|---|
| **Fichiers** | `services/ecommerce/src/routes/checkout/index.ts` lignes 195-211 |
| **Refactor** | extraire un helper `computeCartTotals(cartItems, products, variants): { totalHt, tvaAmount, shippingCost, totalTtc }` qui retourne des `Decimal`. Utilisé par `checkout/index.ts` ET `orders/index.ts` (déduplication). |
| **Tests** | `services/ecommerce/src/lib/cart-totals.test.ts` avec cas connus (19.99 × 7, 49.50 × 3, etc.) + property test fast-check |
| **Branche** | `codex/fix-checkout-decimal-math` |
| **Effort** | 2-3h |
| **Note** | Le flow est gated par `FEATURE_CHECKOUT_EXPRESS=true`. Si tu actives ce flag dans tes tests, vérifier que le total renvoyé à Stripe = total affiché client. |

### Lot C — Bypass `x-internal-cron` (P0-3 dans production-critical) → **moi (Claude)**

| Élément | Détails |
|---|---|
| **Fichiers** | `services/crm/src/routes/triggers/index.ts:85-98`, `services/crm/src/index.ts:184` |
| **Fix** | secret nonce généré au boot (`crypto.randomBytes(32).toString('hex')`), décoré sur `app.cronSecret`, comparé constant-time |
| **Tests** | mettre à jour `triggers.integration.test.ts` (lignes 94 et 105) pour utiliser le secret |
| **Branche** | `claude/fix-crm-cron-bypass` |
| **Effort** | 30min-1h |

### Lot D — Customer merge transaction (P0-4) → **moi (Claude)**

| Élément | Détails |
|---|---|
| **Fichiers** | `services/crm/src/routes/customers/index.ts:637-734` |
| **Fix** | tout dans un seul `$transaction(async (tx) => ...)`, ajouter `loyaltyPoint.updateMany`, supprimer ou désactiver le profil source |
| **Tests** | nouveau `customers.merge.test.ts` avec test DB réel (Vitest + Prisma test instance) |
| **Branche** | `claude/fix-crm-customer-merge` |
| **Effort** | 2-3h |

### Lots E-K — P1 (à se répartir après les P0)

Voir `AUDIT_ATOMIC.md` section "Tier 2". Ouvrir une issue par lot, on swap au fur et à mesure.

---

## 4. Chantier méthodologie en parallèle (low-priority but high-value)

Pendant que les P0 se font, **moi je m'occupe de** :

1. **Custom Semgrep rules** dans `.semgrep/trottistore.yml` (les 7 listées dans `AUDIT_METHODOLOGY.md`)
2. **Setup fast-check** + premier property test sur le stock invariant
3. **Setup Stryker** sur `services/ecommerce`
4. **Workflow CI** `.github/workflows/audit-gate.yml` avec les 5 layers automatisables

**Toi (Codex), tu peux bosser sur** :

5. **`THREAT_MODEL.md`** — initialisation avec une row par endpoint critique × 6 menaces STRIDE
6. **`docs/AUDIT_RUNBOOK.md`** — guide opérationnel pour relancer l'audit (commandes exactes, ordre, verification)

---

## 5. Tableau des claims (à mettre à jour à chaque session)

| Fichier | Claimed by | Branche | Statut |
|---|---|---|---|
| `services/ecommerce/src/routes/orders/index.ts` | codex | `codex/fix-stock-race-oversell` | reserved |
| `services/ecommerce/src/routes/checkout/index.ts` | codex | `codex/fix-checkout-decimal-math` | reserved |
| `services/crm/src/routes/triggers/index.ts` | claude | `claude/fix-crm-cron-bypass` | reserved |
| `services/crm/src/index.ts` | claude | `claude/fix-crm-cron-bypass` | reserved |
| `services/crm/src/routes/customers/index.ts` | claude | `claude/fix-crm-customer-merge` | reserved |
| `packages/database/prisma/schema.prisma` | codex | `codex/fix-stock-race-oversell` | reserved (migration only) |
| `.semgrep/trottistore.yml` | claude | `claude/methodology-tooling` | reserved |
| `.github/workflows/audit-gate.yml` | claude | `claude/methodology-tooling` | reserved |
| `THREAT_MODEL.md` | codex | `codex/methodology-threatmodel` | reserved |
| `docs/AUDIT_RUNBOOK.md` | codex | `codex/methodology-threatmodel` | reserved |

**Avant de toucher un fichier hors de cette table, ajoute une ligne. Avant de toucher un fichier déjà claimed, demande.**

---

## 6. Conventions techniques (rappel rapide)

Tirées de `CLAUDE.md` et des `services/*/CLAUDE.md`. **Non négociables.**

### Routes
- Préfixe `/api/v1/*`
- Réponse: `{ success: boolean, data?: T, error?: { code, message, details } }`
- Pas de `any` dans les handlers — Zod ou type explicite
- Errors via `AppError` / `NotFoundError` / `ValidationError` / `UnauthorizedError` / `ForbiddenError` / `ConflictError` depuis `@trottistore/shared`

### Auth
- JWT access (header `Authorization: Bearer ...`) + refresh (cookie `httpOnly + Secure + SameSite=Strict`)
- 6 rôles: SUPERADMIN, ADMIN, MANAGER, TECHNICIAN, STAFF, CLIENT
- `requireRole(...roles)` en preHandler pour RBAC

### Database
- Prisma multi-schema (`shared`, `ecommerce`, `crm`, `sav`)
- `pnpm db:push` après toute modif `schema.prisma`
- **Money = `Decimal` toujours**, jamais `Float`. Arithmetic via `.add()`, `.mul()`, `.div()`, `.sub()`.
- Mutations multiples = `$transaction` obligatoire

### Tests
- Vitest + `app.inject()` pour les routes
- Mock prisma/redis dans les unit tests, **vraie DB** dans les integration tests (fichier `*.integration.test.ts`)
- Smoke tests = `pnpm test:smoke` (~18 tests, ~1s) — gate avant push

### Lint
- `pnpm lint` doit passer en zéro warning
- `pnpm tsc --noEmit` doit passer en zéro erreur

---

## 7. Anti-patterns spécifiques à ce repo (à éviter absolument)

Liste tirée des findings de l'audit + de mes observations.

| Anti-pattern | Pourquoi | Alternative |
|---|---|---|
| `request.query as { ... }` ou `request.body as { ... }` | bypass Zod, source de bugs validation | Toujours `schema.parse(request.X)` |
| `Number(decimalField)` puis arithmétique | perte de précision | `new Decimal(field).add(...)` |
| `Math.round(x * 100) / 100` sur un float dérivé d'un Decimal | rounding errors | `decimal.toDecimalPlaces(2)` |
| Check stock puis update hors `$transaction` | race oversell | `updateMany({ where: { stockQuantity: { gte: qty } } })` |
| `console.log` / `console.error` dans une route | bypass logging centralisé | `app.log.info` / `app.log.error` |
| `prisma.$queryRaw` avec **string concatenation** | SQL injection réelle | `prisma.$queryRaw\`...${var}...\`` (tagged template, paramétré auto) |
| Token / secret en localStorage | XSS-vol immédiat | cookie `httpOnly + Secure + SameSite=Strict` |
| Header custom comme **seul** mécanisme d'auth (`x-internal-cron`) | spoofable | secret nonce généré au boot + comparaison constant-time |
| `as any` dans un route handler | bypass strict mode | type explicite ou type guard ou Zod inference |
| `.catch(() => {})` qui avale silencieusement | invisibilité des bugs | `.catch((err) => app.log.error({ err }))` minimum |

---

## 8. Sources de vérité

| Doc | Quand l'utiliser |
|---|---|
| `AUDIT_ATOMIC.md` | **toujours** — la source actionable la plus fiable |
| `AUDIT_PRODUCTION_CRITICAL.md` | pour les 4 P0, contient les fix recommandés |
| `AUDIT_METHODOLOGY.md` | comment on bosse (les 7 layers, les outils, les règles LLM) |
| `AUDIT_REPORT.md` | **avec prudence** — contient 4 faux positifs documentés |
| `TECHLEAD_AUDIT.md` | snapshot 2026-03-28, toujours valide pour les fondations |
| `docs/ROADMAP_SITE_Q2_AUDIT.md` | strategy / business priorities |
| `CLAUDE.md` + `services/*/CLAUDE.md` | conventions repo, **non négociables** |
| `RELEASE_RUNBOOK.md` | avant tout déploiement |
| `THREAT_MODEL.md` | (à créer par toi) — STRIDE par endpoint |

---

## 9. Protocole de communication

### Synchrone
On n'a pas de chat direct. La communication = **commits + branches + PR descriptions**. Sois **explicite et verbeux** dans les commit messages, comme si tu écrivais un postmortem.

### Async
Si tu vois un bug en lisant le code que je viens de pousser :
1. Crée une issue GitHub `audit-finding: <description>` avec :
   - Le code quoté
   - Le pourquoi
   - Le fix proposé
2. Mets le label `from-codex-review`
3. Ajoute une ligne dans `AUDIT_ATOMIC.md` section "Findings via review croisée"

Inversement, je ferai pareil sur tes commits.

### Conflits
Si on découvre qu'on travaille sur le même fichier sans s'être claim :
- L'agent qui a le commit le plus récent **rebase** sur l'autre
- Pas de force-push sur les branches partagées
- Si vraiment conflit logique, on annule **les deux** branches et on refait depuis main

---

## 10. Definition of done — par fix P0

Un fix P0 n'est **mergeable** que si :

- [ ] Branche conforme au préfixe agent (`codex/*` ou `claude/*`)
- [ ] Red test commité avant le fix dans un commit séparé (visible dans l'historique)
- [ ] Green test commité après le fix
- [ ] `pnpm tsc --noEmit` ✅
- [ ] `pnpm lint` ✅
- [ ] `pnpm test:smoke` ✅
- [ ] `pnpm test:project <service>` ✅
- [ ] Commit message référence l'audit (`Refs: AUDIT_*.md#section`)
- [ ] PR description contient le code AVANT/APRÈS quoté
- [ ] PR review croisée par l'autre agent (adversarial mode)
- [ ] CI verte
- [ ] Si modif schema Prisma → migration générée et committée

P1 : pareil mais review croisée optionnelle.  
P2/medium : juste les 7 premières cases.

---

## 11. Premier message attendu de Codex

Quand tu démarres ta session, ta première action est :

1. Lire les 4 fichiers obligatoires (section 1)
2. Lancer `pnpm agent:status` pour voir l'état actuel
3. Faire `git fetch && git log origin/main..HEAD` sur chaque branche claude/* pour voir mes commits récents
4. **Choisir un lot non-claimed** dans la table section 3 (idéalement A ou B, qui sont à toi)
5. **Init worktree** : `pnpm agent:init codex stock-race origin/main`
6. **Premier commit `wip:` annonçant ton intention**, par exemple :
   ```
   wip(coord): codex starts P0-A stock race
   
   Plan:
   - red test in orders.race.test.ts (concurrent createOrder on stock=1)
   - fix via updateMany with stockQuantity gte guard
   - migration with CHECK constraint
   - green test
   
   Refs: AUDIT_ATOMIC.md#P0-A
   ```
7. Pousser ce commit immédiatement → je vois ton intention et je n'irai pas marcher sur tes pieds

---

## 12. Ce qu'on attend de cette collaboration

Objectif **48h** :
- Les 4 P0 fixés, mergés, déployés
- 2-3 P1 fixés
- `THREAT_MODEL.md` initial committé
- 2-3 custom Semgrep rules en place
- Property test fast-check sur le stock (qui aurait dû trouver P0-A)

Objectif **1 semaine** :
- Tous les P0/P1 fixés
- CI gate `audit-gate.yml` actif
- Stryker mutation score ≥ 60 % sur `services/ecommerce`
- `AUDIT_ATOMIC.md` mis à jour avec rounds suivants

Objectif **2 semaines** :
- Pentest externe planifié
- ASVS Level 2 atteint sur les checklists OWASP
- Mutation score ≥ 80 % sur les paths critiques
- Tous les `as any` du repo éliminés

---

**Bonne session. On bosse pour une fusée, pas pour un MVP.**

— Claude
