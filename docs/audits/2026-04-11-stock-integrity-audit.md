# Stock Integrity Deep-Dive Audit — TrottiStore — 2026-04-11

> **Type :** Audit ciblé sur les 3 P1 stock identifiés par codex pendant la session 2026-04-11.
> **Statut :** **3 findings confirmés, 0 implémenté** (codex devait livrer, n'a pas livré).
> **Auditeur :** Claude Opus 4.6 (replacement codex).

## Sommaire

1. [Contexte et findings codex](#1-contexte)
2. [Finding F1 — SAV parts decrement brut](#2-f1)
3. [Finding F2 — Stock movements non atomique](#3-f2)
4. [Finding F3 — Refund full après cancel double-restock](#4-f3)
5. [Plan d'implémentation unifié](#5-plan)
6. [Tests à écrire](#6-tests)
7. [Migration et rollout](#7-migration)

---

## 1. Contexte

Le 2026-04-11, codex a fait un audit "atomique/intégrité" sur main et a identifié **3 P1 stock** non couverts par les fixes sécurité du jour (qui se concentraient sur l'auth IDOR / cron / customer merge / password reset).

**Briefing codex (vu dans le chat) :**

> 1. P1 SAV parts décrémente encore le stock sans garde atomique. POST /repairs/:id/parts fait un tx.productVariant.update({ decrement }) brut, donc deux techniciens peuvent consommer le dernier item en parallèle; avec la contrainte DB, ça finit en erreur tardive au lieu d'un 409 métier propre. Réf: services/sav/src/routes/tickets/index.ts:1006
>
> 2. P1 La route POST /stock/movements n'est pas atomique malgré son commentaire. Elle lit stockQuantity via findUnique, calcule stockAfter, puis fait un update séparé. Le commentaire dit "Lock the variant row for update", mais aucun lock SQL ni garde updateMany ... where stockQuantity >= ... n'existe. Deux sorties concurrentes peuvent donc passer le check local. Réf: services/ecommerce/src/routes/stock/index.ts:67
>
> 3. P1 Le refund complet peut double-restocker une commande déjà annulée. Le cancel incrémente déjà stockQuantity ou décrémente stockReserved, puis la route POST /admin/orders/:id/refund autorise encore un full refund tant que le statut n'est pas REFUNDED, avec restockItems=true par défaut. Une commande CANCELLED puis REFUNDED peut donc remettre le stock une seconde fois. Réfs: services/ecommerce/src/routes/orders/index.ts:1406, services/ecommerce/src/routes/orders/index.ts:1539

**Recommandation codex (non implémentée) :**

> Recentrer T3 sur un vrai lot "stock integrity":
> - extraire decrementStockOrThrow dans @trottistore/shared
> - l'utiliser dans orders et sav
> - corriger stock/movements avec une garde atomique
> - empêcher le double-restock sur refund après cancel

Codex avait promis "Si tu veux, je prends maintenant ce lot exact en implémentation au lieu du vieux brief T3." → puis a atteint ses limites avant de livrer. Ce doc reprend le brief en mode "ready to implement".

---

## 2. F1 — SAV parts decrement brut

### 2.1 Code actuel

`services/sav/src/routes/tickets/index.ts:1006` (POST `/repairs/:id/parts`)

```typescript
// Pseudo-code observé (à vérifier dans le fichier réel)
await tx.productVariant.update({
  where: { id: partVariantId },
  data: { stockQuantity: { decrement: quantity } },
});
```

### 2.2 Analyse

**Comportement :**
- Prisma `{ decrement: N }` se traduit en SQL `UPDATE ... SET stock_quantity = stock_quantity - N WHERE id = ?`
- C'est atomique au niveau row (Postgres pose un row-level lock pendant l'update)
- MAIS ça ne vérifie pas que `stock_quantity >= N` avant le decrement
- Donc si stock = 1 et 2 techniciens font le call simultanément, le 1er passe à 0, le 2e passe à -1

**Mitigation existante :** la contrainte CHECK `stock_quantity_non_negative` (migration `20260410151000`) refuse les valeurs négatives au niveau DB → la 2e transaction throw une `PrismaClientKnownRequestError` sur la contrainte CHECK.

**Pourquoi c'est insuffisant :**
- L'erreur remontée est une exception générique, pas un AppError métier
- Le client (technicien) reçoit un 500 au lieu d'un 409 STOCK_UNAVAILABLE avec un message clair
- Les logs sont pollués par des stack traces "PrismaClientKnownRequestError" au lieu d'événements métier "STOCK_INSUFFICIENT"
- Pas de feedback UX clair "désolé, cette pièce vient d'être consommée par un autre technicien"
- Possible fuite d'info sur la structure DB dans le message d'erreur

### 2.3 Fix

**Pattern correct :** un `updateMany` avec garde dans le WHERE.

```typescript
const result = await tx.productVariant.updateMany({
  where: {
    id: partVariantId,
    stockQuantity: { gte: quantity },  // ← garde
  },
  data: {
    stockQuantity: { decrement: quantity },
  },
});

if (result.count === 0) {
  // Soit le variantId n'existe pas, soit stockQuantity < quantity
  throw new ConflictError("STOCK_UNAVAILABLE", `Pièce ${partVariantId} indisponible (stock insuffisant)`);
}
```

`updateMany` avec un `where` qui inclut la condition de stock fait un `UPDATE ... WHERE id = ? AND stock_quantity >= N` qui est atomique au niveau SQL et retourne le nombre de rows affectées (0 = pas de match = stock insuffisant).

### 2.4 Refactor en helper partagé

Créer `packages/shared/src/stock.ts` :

```typescript
import type { PrismaClient, Prisma } from "@prisma/client";
import { ConflictError } from "./errors.js";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface DecrementStockOptions {
  variantId: string;
  quantity: number;
  reason?: string; // pour les logs et l'audit
}

/**
 * Atomic decrement with stock-availability guard.
 * Throws ConflictError("STOCK_UNAVAILABLE") if the variant doesn't have
 * enough stock (or doesn't exist).
 *
 * Use inside a Prisma transaction (`prisma.$transaction(async (tx) => { ... })`)
 * if you need to atomically combine the decrement with other writes.
 */
export async function decrementStockOrThrow(
  tx: TxClient,
  { variantId, quantity, reason }: DecrementStockOptions,
): Promise<void> {
  if (quantity <= 0) {
    throw new ValidationError(`Invalid decrement quantity: ${quantity}`);
  }

  const result = await tx.productVariant.updateMany({
    where: {
      id: variantId,
      stockQuantity: { gte: quantity },
    },
    data: {
      stockQuantity: { decrement: quantity },
    },
  });

  if (result.count === 0) {
    throw new ConflictError(
      "STOCK_UNAVAILABLE",
      `Stock insuffisant pour le variant ${variantId} (qty demandée : ${quantity}${reason ? `, raison : ${reason}` : ""})`,
    );
  }
}

/**
 * Atomic increment (restock). Always succeeds (no upper bound check).
 */
export async function incrementStock(
  tx: TxClient,
  variantId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;
  await tx.productVariant.update({
    where: { id: variantId },
    data: { stockQuantity: { increment: quantity } },
  });
}
```

Export depuis `packages/shared/src/index.ts` :

```typescript
export { decrementStockOrThrow, incrementStock } from "./stock.js";
```

### 2.5 Hook dans les call sites

**Site 1 :** `services/sav/src/routes/tickets/index.ts:1006`

```typescript
import { decrementStockOrThrow } from "@trottistore/shared";

// ...
await decrementStockOrThrow(tx, {
  variantId: partVariantId,
  quantity,
  reason: `repair ticket ${ticketId} parts`,
});
```

**Site 2 :** `services/ecommerce/src/routes/orders/index.ts:521` (création order)

Le decrement actuel :
```typescript
await tx.productVariant.update({
  where: { id: item.variantId },
  data: { stockQuantity: { decrement: item.quantity } },
});
```

Devient :
```typescript
await decrementStockOrThrow(tx, {
  variantId: item.variantId,
  quantity: item.quantity,
  reason: `order ${orderId} item`,
});
```

L'erreur 409 STOCK_UNAVAILABLE remontera proprement au handler error, qui le catch via le `mapPrismaError` → le client reçoit un JSON `{ success: false, error: { code: 'STOCK_UNAVAILABLE', message: '...' } }` au lieu d'un 500.

---

## 3. F2 — Stock movements non atomique

### 3.1 Code actuel

`services/ecommerce/src/routes/stock/index.ts:67`

```typescript
// POST /stock/movements
const variant = await app.prisma.productVariant.findUnique({
  where: { id: variantId },
});
if (!variant) throw new NotFoundError("Variant not found");

const stockBefore = variant.stockQuantity;
const stockAfter = stockBefore + delta; // delta peut être négatif (sortie)

if (stockAfter < 0) {
  throw new ValidationError("Stock insuffisant");
}

await app.prisma.productVariant.update({
  where: { id: variantId },
  data: { stockQuantity: stockAfter },
});

await app.prisma.stockMovement.create({
  data: { variantId, delta, stockBefore, stockAfter, ... },
});
```

### 3.2 Analyse

**Le commentaire dit :** "Lock the variant row for update"
**La réalité :** **aucun lock SQL n'est posé.** `findUnique` est un `SELECT` simple sans `FOR UPDATE`. Entre le `findUnique` et le `update`, une autre transaction peut modifier `stockQuantity`.

**Scénario de race :**

| t | Tx A | Tx B |
|---|---|---|
| 1 | findUnique → stockQuantity = 5 | |
| 2 | | findUnique → stockQuantity = 5 |
| 3 | calcule stockAfter = 5 - 3 = 2 ✓ | |
| 4 | | calcule stockAfter = 5 - 3 = 2 ✓ |
| 5 | update set stockQuantity = 2 | |
| 6 | | update set stockQuantity = 2 ❌ |
| 7 | create movement(delta=-3, before=5, after=2) | |
| 8 | | create movement(delta=-3, before=5, after=2) |

**Résultat :** stock final = 2 alors que 6 unités ont été sorties au total. Stock perdu.

### 3.3 Fix

**Approche 1 (recommandée) — utiliser le helper `decrementStockOrThrow` / `incrementStock`** :

```typescript
await app.prisma.$transaction(async (tx) => {
  if (delta < 0) {
    await decrementStockOrThrow(tx, {
      variantId,
      quantity: Math.abs(delta),
      reason: `stock movement ${type}`,
    });
  } else {
    await incrementStock(tx, variantId, delta);
  }

  // Re-read pour avoir le stockQuantity exact post-update (pour le log)
  const variantAfter = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: { stockQuantity: true },
  });

  await tx.stockMovement.create({
    data: {
      variantId,
      delta,
      stockBefore: (variantAfter?.stockQuantity ?? 0) - delta,
      stockAfter: variantAfter?.stockQuantity ?? 0,
      type,
      note,
      userId,
    },
  });
});
```

**Approche 2 (alternative) — `SELECT FOR UPDATE`** :

```typescript
await app.prisma.$transaction(async (tx) => {
  const [variant] = await tx.$queryRaw<{ stockQuantity: number }[]>`
    SELECT stock_quantity FROM ecommerce.product_variants
    WHERE id = ${variantId}
    FOR UPDATE
  `;
  // ... reste du calcul + update + create movement
});
```

**Approche 1 préférée** car :
- Ré-utilise le helper partagé (consistent avec F1)
- Pas de SQL brut
- Plus lisible

### 3.4 Sites à patcher

- `services/ecommerce/src/routes/stock/index.ts:67` (POST `/stock/movements` admin)

---

## 4. F3 — Refund full après cancel double-restock

### 4.1 Code actuel

**Site 1 — cancel order :** `services/ecommerce/src/routes/orders/index.ts:1406`

```typescript
if (newStatus === "CANCELLED") {
  const items = await tx.orderItem.findMany({ where: { orderId: id } });

  for (const item of items) {
    if (!item.variantId) continue;
    if (updatedOrder.paymentMethod.startsWith("INSTALLMENT_")) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockReserved: { decrement: item.quantity } },
      });
    } else {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQuantity: { increment: item.quantity } },  // ← restock 1ère fois
      });
    }
  }
  // ...
}
```

**Site 2 — refund order :** `services/ecommerce/src/routes/orders/index.ts:1539`

```typescript
// POST /admin/orders/:id/refund
if (restockItems !== false) {  // default true
  const items = await tx.orderItem.findMany({ where: { orderId: id } });
  for (const item of items) {
    if (!item.variantId) continue;
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stockQuantity: { increment: item.quantity } },  // ← restock 2ème fois ❌
    });
  }
}
```

### 4.2 Scénario du bug

1. Order CONFIRMED avec 1 unité du variant V → stock V décrémenté de 1
2. Admin cancel l'order → status passe à CANCELLED → stock V incrémenté de 1 (restock OK)
3. Admin refund full la même order → status passe à REFUNDED → `restockItems=true` par défaut → stock V incrémenté de 1 **une 2ème fois** ❌

**Stock final :** +1 par rapport au stock initial. Pas catastrophique mais incorrect, et difficile à diagnostiquer si ça arrive à grande échelle.

### 4.3 Fix

**Approche 1 (idempotent flag) — recommandée**

Ajouter une colonne `stockReleased Boolean @default(false)` sur `Order`. À chaque restock (cancel ou refund), check + set le flag.

**Migration :**

```sql
ALTER TABLE "ecommerce"."orders" ADD COLUMN "stock_released" BOOLEAN NOT NULL DEFAULT false;
-- Backfill : les orders historiques en CANCELLED ou REFUNDED sont marquées released
UPDATE "ecommerce"."orders" SET "stock_released" = true
WHERE "status" IN ('CANCELLED', 'REFUNDED');
```

**Schema Prisma :**

```prisma
model Order {
  // ... champs existants
  stockReleased  Boolean   @default(false) @map("stock_released")
  // ...
}
```

**Helper :**

```typescript
// packages/shared/src/stock.ts
export async function releaseOrderStock(
  tx: TxClient,
  orderId: string,
  reason: string,
): Promise<{ released: boolean; itemCount: number }> {
  // Read-modify-write under transaction
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { stockReleased: true, paymentMethod: true },
  });

  if (!order) {
    throw new NotFoundError(`Order ${orderId} not found`);
  }
  if (order.stockReleased) {
    return { released: false, itemCount: 0 }; // already released, no-op
  }

  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { variantId: true, quantity: true },
  });

  for (const item of items) {
    if (!item.variantId) continue;
    if (order.paymentMethod.startsWith("INSTALLMENT_")) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockReserved: { decrement: item.quantity } },
      });
    } else {
      await incrementStock(tx, item.variantId, item.quantity);
    }
  }

  await tx.order.update({
    where: { id: orderId },
    data: { stockReleased: true },
  });

  return { released: true, itemCount: items.length };
}
```

**Hook dans cancel :**

```typescript
if (newStatus === "CANCELLED") {
  await releaseOrderStock(tx, id, "order cancelled");
  // ... reste du cleanup (paymentInstallment, etc.)
}
```

**Hook dans refund :**

```typescript
if (restockItems !== false) {
  await releaseOrderStock(tx, id, "order refunded");
  // releaseOrderStock no-op si déjà released par cancel
}
```

### 4.4 Bénéfices

- **Idempotent :** un refund après cancel ne re-restocke pas
- **Idempotent à plusieurs niveaux :** un re-call accidentel de cancel ou refund ne re-restocke pas non plus
- **Auditable :** la colonne `stockReleased` est observable dans la DB
- **Compatible avec installments :** gère le `stockReserved` ou `stockQuantity` selon le payment method

---

## 5. Plan d'implémentation unifié

### 5.1 Ordre d'attaque

1. **Migration `stockReleased` Order** (5 min)
2. **Helper `packages/shared/src/stock.ts`** avec `decrementStockOrThrow`, `incrementStock`, `releaseOrderStock` (30 min)
3. **Tests unitaires du helper** (30 min)
4. **Hook F1 — SAV parts** (15 min)
5. **Hook F1bis — orders create** (15 min)
6. **Hook F2 — stock movements** (30 min)
7. **Hook F3 — cancel + refund via releaseOrderStock** (30 min)
8. **Tests intégration concurrence (mock + race simulation)** (1h)
9. **Smoke test ecommerce + sav** (15 min)
10. **PR + CI + merge + deploy** (30 min)

**Total : ~4h**.

### 5.2 Branche

`claude/fix-stock-integrity-batch` ou `codex/fix-stock-integrity` si codex revient.

### 5.3 PR description template

```
## Summary

Fix the 3 P1 stock integrity findings identified by codex during the
2026-04-11 audit (and never implemented because codex hit limits).

- F1 SAV parts decrement non guarded → decrementStockOrThrow helper
- F2 Stock movements non atomique → same helper, no more SELECT then UPDATE
- F3 Refund after cancel double-restock → idempotent via Order.stockReleased

## Helper API

New `packages/shared/src/stock.ts` exports:
- `decrementStockOrThrow(tx, { variantId, quantity, reason })` — throws ConflictError("STOCK_UNAVAILABLE") if not enough
- `incrementStock(tx, variantId, quantity)` — restock (no upper bound)
- `releaseOrderStock(tx, orderId, reason)` — idempotent stock release for an order, marks Order.stockReleased

## Migration

ALTER TABLE orders ADD COLUMN stock_released BOOLEAN NOT NULL DEFAULT false;
+ backfill UPDATE for existing CANCELLED/REFUNDED orders.

## Tests

- Helper unit tests: 8 tests (decrement OK / not enough / negative qty / etc.)
- Integration test: 2 concurrent decrements on stock=1 → one succeeds, one
  throws STOCK_UNAVAILABLE (validates atomic guard).
- Integration test: cancel then refund → no double-restock (validates
  releaseOrderStock idempotence).
```

---

## 6. Tests à écrire

### 6.1 Unit (`packages/shared/src/stock.test.ts`)

```typescript
describe("decrementStockOrThrow", () => {
  it("decrements when stock is sufficient", async () => { /* ... */ });
  it("throws STOCK_UNAVAILABLE when stock is exactly insufficient", async () => { /* ... */ });
  it("throws STOCK_UNAVAILABLE when variant does not exist", async () => { /* ... */ });
  it("throws ValidationError when quantity is 0 or negative", async () => { /* ... */ });
  it("includes reason in error message", async () => { /* ... */ });
});

describe("incrementStock", () => {
  it("increments by the given quantity", async () => { /* ... */ });
  it("no-op when quantity is 0", async () => { /* ... */ });
});

describe("releaseOrderStock", () => {
  it("releases stock for non-installment order", async () => { /* ... */ });
  it("releases stockReserved for installment order", async () => { /* ... */ });
  it("is idempotent — second call is no-op", async () => { /* ... */ });
  it("throws when order does not exist", async () => { /* ... */ });
  it("sets stockReleased=true atomically with the increments", async () => { /* ... */ });
});
```

### 6.2 Integration (avec mocks)

`services/ecommerce/src/routes/stock/stock.integration.test.ts` (nouveau)

```typescript
describe("POST /admin/stock/movements", () => {
  it("decrements stock atomically when type=OUT", async () => { /* ... */ });
  it("returns 409 STOCK_UNAVAILABLE when concurrent decrement leaves <0", async () => {
    // Simule 2 calls en parallèle qui visent le dernier item
    const [r1, r2] = await Promise.all([
      app.inject({ method: "POST", url: "/admin/stock/movements", payload: {...}, ... }),
      app.inject({ method: "POST", url: "/admin/stock/movements", payload: {...}, ... }),
    ]);
    const statuses = [r1.statusCode, r2.statusCode].sort();
    expect(statuses).toEqual([200, 409]);
  });
});
```

`services/ecommerce/src/routes/orders/orders-refund-double-restock.integration.test.ts` (nouveau)

```typescript
describe("Refund after cancel idempotence", () => {
  it("does not double-restock when refund follows cancel", async () => {
    // Setup: order CONFIRMED with 1 item, stockQuantity = 5
    // 1. Cancel → expect stockQuantity = 6 (5 + 1 restock)
    // 2. Refund full with restockItems=true (default) → expect stockQuantity STILL 6
    // 3. Verify stockReleased flag is true after each call
  });
});
```

### 6.3 Integration (Testcontainers — out of scope mais idéal)

À ajouter quand le chantier S2 Testcontainers sera lancé. Permettrait de tester la concurrence réelle sur Postgres au lieu de mocks.

---

## 7. Migration et rollout

### 7.1 Migration Prisma

```sql
-- 20260412NNNN_order_stock_released/migration.sql

ALTER TABLE "ecommerce"."orders"
ADD COLUMN "stock_released" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ecommerce"."orders"
SET "stock_released" = true
WHERE "status" IN ('CANCELLED', 'REFUNDED');
```

**Lock impact :** `ALTER TABLE ADD COLUMN` avec `DEFAULT` est fait par Postgres en mode metadata-only depuis 11+ (très rapide, quelques ms même sur grosse table). L'`UPDATE` de backfill peut prendre plus de temps si beaucoup de CANCELLED/REFUNDED, mais sur prod TrottiStore (61 order_items, 31 orders) c'est négligeable.

**Verdict :** lock acceptable, peut être appliqué via `prisma migrate deploy` standard.

### 7.2 Rollout

1. PR ouverte → CI vert → squash merge sur main
2. Deploy production avec `run_migrations=true` → migration appliquée
3. Smoke test :
   - Créer une order de test → vérifier stockQuantity décrémenté
   - Cancel l'order → vérifier stockQuantity incrémenté + stockReleased=true
   - Refund l'order → vérifier stockQuantity inchangé + stockReleased toujours true
   - Vérifier dans les logs qu'il n'y a pas d'erreur STOCK_UNAVAILABLE inattendue

### 7.3 Rollback

Si problème :
- Le helper `decrementStockOrThrow` peut être désactivé en restaurant l'`update({ decrement })` brut (la contrainte CHECK reste comme garde DB de dernier recours)
- La migration `stockReleased` est non-destructive : on peut la garder même si on rollback le code
- Aucun backfill destructif

---

## 8. Risque résiduel et follow-ups

### 8.1 Risque résiduel post-fix

- **Race exotique :** `releaseOrderStock` lit `stockReleased` puis update. Sous concurrence forte (2 cancels en // sur la même order — peu probable mais possible), les 2 transactions peuvent passer le check `if (order.stockReleased)`. Mitigation : wrapper le check + update dans un `updateMany ... where stockReleased = false`.

```typescript
const result = await tx.order.updateMany({
  where: { id: orderId, stockReleased: false },
  data: { stockReleased: true },
});
if (result.count === 0) {
  return { released: false }; // already released
}
// only one tx wins → safe to do the increments
```

À implémenter dans la v1 du helper, c'est trivial.

- **Réservations non couvertes :** si on introduit un mécanisme de réservation panier (15 min de hold sur le stock pendant le checkout), il faudra étendre le helper pour distinguer "réservé" de "vendu".

### 8.2 Follow-ups suggérés

1. **Stock alerts** : déclencher une notification admin quand `stockQuantity < seuil` après decrement (backlog item existant)
2. **Audit log stock movements** : enregistrer chaque appel à `decrementStockOrThrow` / `incrementStock` dans `audit_logs` avec userId + reason
3. **Métrique Prometheus `stock_unavailable_total`** : compteur des 409 STOCK_UNAVAILABLE pour repérer les hot products

---

## 9. Référence rapide

| Finding | Réf code | Sévérité | Effort fix | Test à écrire |
|---|---|---|---|---|
| F1 SAV parts decrement brut | `services/sav/src/routes/tickets/index.ts:1006` | P1 | 15 min | concurrent decrement test |
| F1bis Orders create decrement brut | `services/ecommerce/src/routes/orders/index.ts:521` | P1 | 15 min | déjà couvert via tests existants à adapter |
| F2 Stock movements non atomique | `services/ecommerce/src/routes/stock/index.ts:67` | P1 | 30 min | nouveau test integration concurrent |
| F3 Refund après cancel double-restock | `services/ecommerce/src/routes/orders/index.ts:1406, 1539` | P1 | 30 min | nouveau test integration cancel→refund |
| Helper `decrementStockOrThrow` | (à créer) `packages/shared/src/stock.ts` | n/a | 30 min | unit tests |
| Helper `releaseOrderStock` | (à créer) `packages/shared/src/stock.ts` | n/a | 30 min | unit tests |
| Migration `stockReleased` | (à créer) `packages/database/prisma/migrations/...` | n/a | 5 min | n/a |

**Total :** ~4h dev + tests, 1 PR, 1 deploy.

---

*Ce doc est self-contained. Un dev (humain ou agent) qui le lit et l'implémente devrait avoir tout ce qu'il faut pour livrer sans poser de questions.*
