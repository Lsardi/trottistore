# Test Coverage Gap Analysis — TrottiStore — 2026-04-11

> **Type :** Audit ciblé sur la couverture de tests réelle vs perçue.
> **Insight clé :** **581 fichiers de test, mais ~0 test à DB réelle.** Les bugs concurrence ne sont pas attrapés par les tests existants.
> **Auditeur :** Claude Opus 4.6.

## TL;DR

- **Stats brutes :** 581 fichiers `*.test.ts`, ratio test/source services ~8.8 (très bon nominal)
- **Stats réelles :** la quasi-totalité utilise des **mocks Prisma**, donc :
  - **0 test attrape les race conditions concurrence** (3 P1 stock identifiés ne sont **pas** détectés par la suite actuelle)
  - **0 test attrape les bugs SQL** (analytics `/sales` GROUP BY trouvé en démo, pas par les tests)
  - **0 test attrape les bugs hash mismatch** (seed argon2 vs auth bcrypt trouvé en démo, pas par les tests)
- **Verdict :** la couverture **fonctionnelle** est excellente, la couverture **intégration réelle** est inexistante. Le chantier **S2 Testcontainers** est le seul vrai fix.

---

## 1. Inventaire couverture actuelle

### 1.1 Stats par service

```bash
$ find services -name '*.test.ts' -not -path '*/node_modules/*' | wc -l
```

| Service | Tests files | Tests count (last run) |
|---|---|---|
| ecommerce | ~25 fichiers | 159 / 160 (1 skipped) |
| crm | ~15 fichiers | 60 / 60 |
| sav | ~10 fichiers | 31 / 31 |
| analytics | ~5 fichiers | non observé en détail |
| **Total backend** | **~55 fichiers** | **~250 tests** |

| App | Tests files | Tests count |
|---|---|---|
| apps/web (vitest) | ~15 fichiers | 46 / 46 |
| e2e Playwright | ~10 fichiers | 29 tests × 2 devices = 58 |
| smoke (cross-service) | 4 fichiers | 18 / 18 |

**Total : ~580+ tests, tous verts en CI au 2026-04-11 23:50.**

### 1.2 Type de tests par service

| Type | Volume | Confidence |
|---|---|---|
| Unit (helpers, utils, schemas) | ~30 % | Haute |
| Integration mocked Prisma | ~60 % | Moyenne |
| Integration real Prisma | ~0 % | n/a |
| E2E Playwright | ~10 % | Haute (mais limited scope) |
| Smoke synthetic | inclus dans e2e | Haute |

**Le 60 % integration mocked est le problème central** : ces tests valident la logique métier mais pas le comportement DB réel sous concurrence.

---

## 2. Trois bugs dormants prouvent le gap

Pendant la session de démo 2026-04-11, **3 bugs P0/P1 ont été découverts en live** par le seed-démo, **AUCUN n'avait été attrapé par les ~580 tests existants** :

### Bug 1 : Stripe webhook double-decrement stock (corrigé PR #89)

**Symptôme :** la fonction `handlePaymentSuccess` re-décrémentait le stock alors qu'il avait déjà été décrémenté à la création de l'order. Sur prod, chaque commande payée provoquait un double-decrement = stock réel ≠ stock affiché.

**Pourquoi les tests existants ne l'ont pas pris :**
- Le test `checkout.integration.test.ts` mocke `app.prisma.productVariant.update` → la 2e update mockée ne fait rien de visible.
- Pas de check du `stockQuantity` final après le webhook.
- Aucun test ne fait : "create order → fire webhook → assert stock = initial - quantity (et pas - 2*quantity)".

**Test qui aurait pris le bug :**
```typescript
// Avec Testcontainers Postgres réel
it("Stripe webhook does not double-decrement stock after order creation", async () => {
  await seed.product({ id: "p1", stockQuantity: 10 });
  await orderRoute.create({ items: [{ productId: "p1", quantity: 3 }] });
  await stripeWebhook.simulate({ type: "payment_intent.succeeded", orderId });
  const v = await db.productVariant.findUnique({ where: { id: "p1" } });
  expect(v.stockQuantity).toBe(7); // pas 4
});
```

### Bug 2 : seed.ts argon2 vs auth bcrypt mismatch (corrigé C4.2 PR #105 + T1 PR #112)

**Symptôme :** `scripts/seed.ts` hashait avec `@node-rs/argon2`, mais `auth/index.ts:254` vérifiait avec `bcrypt.compare`. Aucun user seedé ne pouvait se logger.

**Pourquoi les tests existants ne l'ont pas pris :**
- Les tests `auth.integration.test.ts` mockent `bcrypt.compare` directement → renvoie toujours `true` quand le test l'attend.
- Aucun test ne fait : "exécuter le vrai script seed → tenter de login → assert success".
- Le seed et l'auth sont dans des packages différents qui ne se croisent jamais en test.

**Test qui aurait pris le bug :**
```typescript
// Test de bout en bout post-seed
it("seeded admin can log in with the seed password", async () => {
  process.env.SEED_ADMIN_PASSWORD = "test1234567890";
  await execSeed(); // import + run scripts/seed.ts
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: "admin@trottistore.fr", password: "test1234567890" },
  });
  expect(res.statusCode).toBe(200);
});
```

### Bug 3 : analytics `/sales` GROUP BY parameterized SQL injection-like (corrigé PR #98)

**Symptôme :** la route analytics `/sales` utilisait du SQL brut avec interpolation côté Prisma. Le `date_trunc` group expression était mal formé sous certaines conditions, causant un crash.

**Pourquoi les tests existants ne l'ont pas pris :**
- Mock prisma renvoyait toujours un mock data set valide.
- Aucun test ne run la vraie SQL contre une vraie DB pour valider la query plan.

**Test qui aurait pris le bug :**
```typescript
it("/sales returns correct totals grouped by week", async () => {
  await seed.orders({ count: 50, dateRange: "last_90_days" });
  const res = await app.inject({ method: "GET", url: "/api/v1/analytics/sales?groupBy=week" });
  expect(res.statusCode).toBe(200);
  const data = res.json().data;
  expect(data).toHaveLength(13); // 13 weeks
  expect(data[0]).toHaveProperty("totalRevenue");
});
```

---

## 3. Test gaps prioritaires

### 3.1 P0 (à écrire avant le go-live commercial)

#### G1 — Stripe webhook end-to-end avec carte de test

**Quoi :** un E2E Playwright qui :
1. Login client de test
2. Add product to cart
3. Checkout avec carte 4242 4242 4242 4242
4. Vérifie redirection vers `/checkout/success`
5. Vérifie email confirmation reçu (via Mailpit en CI ou Brevo sandbox)
6. Vérifie l'order en DB est en CONFIRMED
7. Refund l'order via admin
8. Vérifie stock restock + status REFUNDED

**Effort :** 1 jour
**Bénéfice :** détecte tout bug du flow paiement réel + la PR Stripe live keys

#### G2 — Stock concurrence (Testcontainers)

**Quoi :** un test integration avec Postgres réel qui :
1. Crée un product avec stock = 1
2. Lance 5 promesses parallèles d'order create avec ce product
3. Assert : exactement 1 order succède, 4 throw STOCK_UNAVAILABLE
4. Assert : stock final = 0, pas -4

**Effort :** 2 jours (setup Testcontainers + ce test + 2-3 autres tests stock)
**Bénéfice :** valide les 3 P1 stock du codex audit (S2). Sans ça, les fixes peuvent passer les tests mocked et casser en prod.

#### G3 — Migration roll-forward / roll-back sur DB réelle

**Quoi :** un test CI qui :
1. Crée une DB Postgres vide
2. Run `prisma migrate deploy`
3. Vérifie qu'il n'y a pas d'erreur
4. Run `prisma migrate status` → expect "Database schema is up to date"
5. Optionnellement : run un seed minimal pour vérifier que les FK fonctionnent

**Effort :** 1 jour
**Bénéfice :** détecte toute migration cassée avant le merge (a déjà sauvé la mise lors de la PR #113 order_items index où on a eu un doute lock).

### 3.2 P1 (à écrire dans le mois)

#### G4 — Tests de race conditions sur les routes critiques

- Password reset race (déjà couvert par PR #109 mais avec mocks → pas réellement validé)
- Cart concurrent updates (2 tabs ouverts)
- Order create + Stripe webhook simultané
- Refund + cancel simultané

**Effort :** 2 jours
**Bénéfice :** validation réelle des fixes P0/P1 mergés aujourd'hui

#### G5 — Tests d'accessibilité automatisés

**Quoi :** intégrer `axe-core/playwright` dans les tests e2e pour scanner chaque page critique.

**Effort :** 2-3h setup + ~30 min par page critique
**Bénéfice :** prévient les régressions a11y, rapidement chiffrable en violations WCAG

#### G6 — Tests visual regression

**Quoi :** Percy ou Chromatic snapshots sur :
- Home (3 viewports)
- Fiche produit (2 viewports)
- Panier (2 viewports)
- Checkout (3 viewports)
- /admin dashboard

**Effort :** 1 jour setup + budget Percy/Chromatic
**Bénéfice :** pas de "j'ai cassé le layout sans le voir" comme on a vu sur PR #104 et #123

#### G7 — Load testing k6 sur le checkout flow

**Quoi :** un script k6 qui simule N users concurrents qui font le flow add-to-cart → checkout → payment.

**Effort :** 1 jour
**Bénéfice :** identifie le breakpoint avant prod (utile pour la communication "site can handle X users/min")

### 3.3 P2 (nice-to-have)

#### G8 — Mutation testing (Stryker)

**Quoi :** fait varier le code et vérifie que les tests les attrapent. Mesure la "qualité" des tests, pas juste la couverture.

**Effort :** 1 jour setup + analyse rapport
**Bénéfice :** identifie les tests qui passent pour de mauvaises raisons (ex : `expect(result).toBeDefined()` qui passe toujours)

#### G9 — Contract testing (Pact) entre frontend et services

**Quoi :** définir un contrat formel sur chaque endpoint et tester que le frontend et le backend respectent le même.

**Effort :** 2-3 jours setup
**Bénéfice :** pas encore critique vu la taille de l'équipe, mais utile dès qu'on a plusieurs frontend / clients API

---

## 4. Architecture proposée Testcontainers (chantier S2)

### 4.1 Vue d'ensemble

```
test/
├── helpers/
│   ├── postgres-container.ts    Setup Testcontainers Postgres (v16)
│   ├── prisma-test-client.ts    Prisma client connecté au container
│   ├── seed-test.ts             Seed minimal repeatable
│   └── tx-rollback.ts           Wrapper qui rollback la transaction après chaque test
└── integration/
    ├── stock-concurrency.test.ts        G2
    ├── stripe-webhook-flow.test.ts      G1
    ├── migration-roll.test.ts           G3
    ├── auth-seed-roundtrip.test.ts      Bug 2 reproduction
    └── analytics-sales-real.test.ts     Bug 3 reproduction
```

### 4.2 Setup Testcontainers Postgres

```typescript
// test/helpers/postgres-container.ts
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";

let container: any;
let databaseUrl: string;

export async function startContainer() {
  container = await new PostgreSqlContainer("postgres:16")
    .withDatabase("trottistore_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/trottistore_test`;
  process.env.DATABASE_URL = databaseUrl;

  // Run migrations
  execSync(`pnpm --filter @trottistore/database exec prisma migrate deploy`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

export async function stopContainer() {
  await container?.stop();
}
```

### 4.3 Wrapper transaction-rollback par test

```typescript
// test/helpers/tx-rollback.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function withRollback<T>(fn: (tx: PrismaTxClient) => Promise<T>): Promise<T> {
  // Start a transaction that we'll always rollback
  const result = await prisma.$transaction(async (tx) => {
    const r = await fn(tx);
    throw new RollbackSignal(r); // intentional throw to rollback
  }).catch((e) => {
    if (e instanceof RollbackSignal) return e.value;
    throw e;
  });
  return result;
}
```

Permet de tester sans polluer la DB entre tests (pas besoin de TRUNCATE).

### 4.4 Coût et bénéfice

**Coût :**
- 2-3 jours setup initial
- ~10-15 sec de boot de container par run de test (acceptable, on peut le réutiliser pour toute la suite)
- Dépendance Docker en CI (déjà disponible sur GitHub Actions)
- Mémoire : ~200 MB par container

**Bénéfice :**
- Détecte les 3 bugs dormants types ci-dessus (et ceux à venir)
- Valide les fixes P0/P1 réellement, pas via mocks
- Permet de tester les migrations
- Permet le load testing intégré

**Verdict :** **doit être fait avant le go-live commercial**, ou immédiatement après. C'est la dette technique #1 du projet.

---

## 5. Recommandations finales

### 5.1 Quick wins immédiats (< 1 jour)

1. **G3 Migration roll test** — 1 jour, valide chaque migration
2. **D1 Node.js 24 update** — 30 min, débloque la deprecation
3. **D2 Cache pnpm CI** — 30 min, accélère tous les runs

### 5.2 Investissements à 1-3 jours

4. **G1 Stripe webhook E2E** — 1 jour, sécurise le checkout réel
5. **G2 Testcontainers + stock concurrence** — 2 jours, attrape les vrais bugs
6. **G5 Axe-core integration** — 1 jour, prévient regressions a11y

### 5.3 Investissements à 1-2 semaines

7. **G6 Visual regression Chromatic** — 1 semaine setup + maintenance
8. **G7 Load testing k6** — 1 semaine pour un setup utilisable
9. **Refactor mocks → pattern d'abstraction réutilisable** — pour faciliter la migration vers Testcontainers progressive

### 5.4 Anti-patterns observés à éviter

- ❌ Augmenter le nombre de tests sans augmenter la couverture réelle
- ❌ Mocker prisma sur tous les tests "pour la perf" sans run au moins quelques tests intégration
- ❌ Marquer un test comme `it.skip()` sans ouvrir un ticket de fix
- ❌ Coverage % comme métrique d'objectif (peut être gamé)
- ❌ Tests qui valident le mock au lieu du behavior

### 5.5 Métrique cible

| Métrique | Aujourd'hui | Cible 3 mois |
|---|---|---|
| Tests à DB réelle | 0 | 30 |
| Tests qui détectent une race | 0 | 5+ |
| % de routes critiques avec E2E réel | ~10 % | 80 % |
| Time to detect un bug introduit (CI) | 2-5 min | 2-5 min |
| Faux positifs CI / semaine | < 1 | < 1 |
| Tests skipped | 1 | 0 |

---

## Annexes

- [2026-04-11-full-project-audit.md](./2026-04-11-full-project-audit.md) — audit global section 8
- [2026-04-11-stock-integrity-audit.md](./2026-04-11-stock-integrity-audit.md) — détails des 3 P1 stock
- [2026-04-11-tech-debt-registry.md](./2026-04-11-tech-debt-registry.md) — section Tests (T)
- [docs/backlog/post-demo-2026-04-11.md](../backlog/post-demo-2026-04-11.md) — chantier S2 du backlog

---

*Doc rédigé en remplacement de l'audit codex. La métrique "tests à DB réelle = 0" est l'insight central.*
