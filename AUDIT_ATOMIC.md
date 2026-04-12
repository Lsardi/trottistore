# Audit atomique — TrottiStore

Date: 2026-04-10  
Méthode: 10 agents Claude (Explore) lancés en parallèle, **un agent par question atomique**, code quoté pour chaque finding et **vérification manuelle des P0**.

## Diff vs anciens audits

| Source | Date | Findings | Faux positifs détectés |
|---|---|---|---|
| `TECHLEAD_AUDIT.md` | 2026-03-28 | ~15 stratégiques | 0 (audit thématique, pas ligne par ligne) |
| `docs/ROADMAP_SITE_Q2_AUDIT.md` | 2026-04-09 | ~10 stratégiques | 0 (idem) |
| `AUDIT_REPORT.md` (1er audit large, 6 agents) | 2026-04-10 matin | ~106 | **4** confirmés à la main |
| `AUDIT_PRODUCTION_CRITICAL.md` (3 agents focus) | 2026-04-10 midi | 4 P0 + 8 P1 | 0 |
| `AUDIT_ATOMIC.md` (10 agents atomiques) | 2026-04-10 après-midi | 4 P0 + 6 P1 + ~13 mediums | 0 |

### Nouveaux findings que les audits précédents avaient ratés

| # | Finding | Sévérité | Source qui l'a trouvé |
|---|---|---|---|
| 1 | **Stock race oversell** (`orders/index.ts` check hors transaction) | 🔴 P0 | atomic #2 |
| 2 | **Float math en cart-first checkout** (Decimal → number → Stripe) | 🔴 P0 | atomic #5 |
| 3 | **IDOR `PUT /repairs/:id/quote/accept`** (TECHNICIAN sans `assignedTo`) | 🟠 P1 | atomic #6 |
| 4 | **IDOR `PUT /orders/:id/status`** (pas d'ownership check) | 🟠 P1 | atomic #6 |
| 5 | **Password reset token race serveur** (check-then-act sur `usedAt`) | 🟠 P1 | atomic #8 |
| 6 | **IDOR guest payment intent** (introduit par le merge de main) | 🔴 P0 ✅ fixé | production-critical |
| 7 | **Double stock decrement Stripe** (orders + webhook) | 🔴 P0 ✅ fixé | production-critical |

→ **5 nouveaux P0/P1** dont 2 déjà fixés dans PR #89.

### Faux positifs débunkés de `AUDIT_REPORT.md`

| Le 1er audit prétendait | Réalité (vérifiée à la main) |
|---|---|
| 🔴 SQL injection `stock/index.ts:214` | Prisma `$queryRaw` tagged template = paramétré + Zod `z.coerce.number()` |
| 🔴 SQL injection `analytics/sales.ts:63` | Prisma `$queryRaw` paramétré + `z.enum()` |
| 🔴 Stripe webhook fail-open si secret manquant | **Faux** : `checkout/index.ts:267-269` retourne 400 immédiat |
| 🔴 JWT HS256 risqué (P0 dans audit auth) | Architectural, pas un bug ; algo pinné, `verify()` partout |

### Findings confirmés par plusieurs audits indépendants

Plus la confirmation indépendante est forte, plus le finding est crédible.

| Finding | Audit large | Production-critical | Atomic |
|---|---|---|---|
| Bypass `x-internal-cron` CRM | ✅ critical | ✅ P0 | (n/a — pas dans le scope) |
| JWT en localStorage | ✅ critical | ✅ P1 | ✅ P1 |
| N+1 campaigns send loop | ✅ critical | (n/a) | ✅ high |
| N+1 triggers idempotence | ✅ critical | (n/a) | ✅ high |
| Customer merge transaction split | ✅ critical | ✅ P0 | ✅ P1 |
| `POST /campaigns/:id/preview` body sans Zod | ✅ critical | (n/a) | ✅ critical |
| Appointment booking race SAV | ✅ medium | (n/a) | ✅ P1 |

→ Ces 7 findings sont **vérifiés par 2 ou 3 audits indépendants**, donc fiabilité maximale.

### Zones explicitement validées propres

L'audit atomique conclut **clean** sur 3 zones que les autres audits ne savaient pas trancher :

1. **Stripe webhook signature** — 7/7 checks (fail-closed, raw body, idempotence, try/catch)
2. **JWT verification 4 services** — pas de fallback secret, pas de `decode()`, algo HS256 pinné
3. **Secret leakage** — 120+ fichiers scannés, 0 secret en dur, 0 `.env` committé



## Table de contrôle

| # | Question | Verdict | Findings |
|---|---|---|---|
| 1 | Stripe webhook fail-closed ? | ✅ **clean** | 7/7 checks OK |
| 2 | Stock peut-il aller négatif ? | 🔴 **P0** | 1 (race outside tx) |
| 3 | JWT verification trustworthy ? | ✅ **clean** | 0 |
| 4 | Routes consommant body/query/params sans Zod ? | 🟡 1 critical + 6 medium | 7 |
| 5 | Money math safe end-to-end ? | 🔴 **P0/P1** | 4 |
| 6 | IDOR sur ressources `:id` ? | 🟠 **P1** | 2 |
| 7 | Tokens stockés en sécurité ? | 🟡 1 P1 connu | 1 |
| 8 | Race conditions check-then-act ? | 🟠 **P1** | 3 |
| 9 | N+1 sur hot paths ? | 🟠 high | 3 |
| 10 | Secrets / clés en dur ? | ✅ **clean** | 0 |

**Total : 4 P0, 6 P1, ~13 mediums.** Pas de secret leak, pas de bug d'auth crypto, pas de problème Stripe webhook.

---

## ✅ Audits sans finding

### Audit #1 — Stripe webhook signature (clean)

7/7 checks OK :
1. ✅ Secret checké à chaque requête (`checkout/index.ts:265-269`)
2. ✅ Fail-closed si secret absent (return 400 immédiat)
3. ✅ `stripe.webhooks.constructEvent(rawBody, sig, secret)` appelé avec le buffer brut
4. ✅ Custom contentTypeParser préserve le raw body (lignes 59-76)
5. ✅ Header lu depuis `request.headers["stripe-signature"]`
6. ✅ try/catch → 400 si signature invalide
7. ✅ Idempotence : `payment.findFirst({ providerRef: pi.id, status: "CONFIRMED" })` avant traitement

### Audit #3 — JWT verification (clean)

| Service | `JWT_ACCESS_SECRET` requis au boot | Fallback secret | `verify()` partout | Algo pinné |
|---|---|---|---|---|
| ecommerce | ✅ | ❌ | ✅ | ✅ HS256 |
| crm | ✅ | ❌ | ✅ | ✅ HS256 |
| sav | ✅ | ❌ | ✅ | ✅ HS256 |
| analytics | ✅ | ❌ | ✅ | ✅ HS256 |

`packages/shared/src/env-check.ts` enforce `process.exit(1)` si manquant. `request.jwtVerify()` (avec signature) utilisé partout, jamais `decode()`. Pas de `alg: none` accepté (fjwt rejette). HS256 partagé entre les 4 services = compromis d'un secret = compromis de tous, mais c'est du design intentionnel.

### Audit #10 — Secret leakage (clean)

120+ fichiers scannés. Aucun secret hardcodé, aucune fallback dangereuse, pas de `.env` committé. Seuls placeholders dans `.env.example` et `infra/.env.production.example` (`sk_test_...`, `whsec_...`). Test fixtures avec `test-secret` clairement marqués. Demo seeds avec `demo1234` intentionnel.

---

## 🔴 P0 — vérifiés manuellement, à fixer immédiatement

### P0-A — Stock race (`services/ecommerce/src/routes/orders/index.ts`)

**Vérifié à la main lignes 348-487.**

```ts
// Ligne 360 — HORS transaction
const available = variant.stockQuantity - variant.stockReserved;
if (available < item.quantity) {
  return reply.status(409).send({ ... INSUFFICIENT_STOCK ... });
}

// ... 70 lignes plus loin ...

// Ligne 432 — entrée en transaction
const order = await app.prisma.$transaction(async (tx) => {
  // ... création de l'order ...
  // Ligne 485 — décrement (pas de re-check !)
  await tx.productVariant.update({
    where: { id: item.variantId },
    data: { stockQuantity: { decrement: item.quantity } },
  });
});
```

**Bug:** Le check de stock est avant le `$transaction`. Aucune re-vérification dans la transaction. Aucune contrainte `CHECK (stock_quantity >= 0)` au niveau Postgres.

**Scénario d'attaque:** Variant à 1 unité, 100 commandes simultanées :
1. 100 requêtes lisent `stockQuantity=1`, `stockReserved=0`, `available=1` → toutes passent le check
2. 100 requêtes entrent dans des transactions distinctes
3. 100 `decrement: 1` s'exécutent atomiquement → `stockQuantity = -99`
4. 100 commandes succès, 99 unités vendues qui n'existent pas

**Présent aussi sur:** flow guest checkout (`orders/index.ts:668`) et création admin (`orders/index.ts:1740+`).

**Fix recommandé:** Re-vérifier le stock **dans** la transaction, idéalement avec un `SELECT … FOR UPDATE`. Plus simple et idiomatique en Prisma : utiliser une condition dans le `update` qui échoue si insuffisant + une contrainte SQL.

```ts
const order = await app.prisma.$transaction(async (tx) => {
  for (const item of cart.items) {
    if (!item.variantId) continue;
    // Atomic check-and-decrement: échoue si pas assez de stock
    const result = await tx.productVariant.updateMany({
      where: {
        id: item.variantId,
        stockQuantity: { gte: item.quantity },
      },
      data: { stockQuantity: { decrement: item.quantity } },
    });
    if (result.count === 0) {
      throw new InsufficientStockError(item.variantId);
    }
  }
  // ... create order ...
});
```

**Et migration SQL** : `ALTER TABLE ecommerce.product_variants ADD CONSTRAINT stock_quantity_non_negative CHECK (stock_quantity >= 0);` — ceinture + bretelles.

### P0-B — Float math sur prix en cart-first checkout (`checkout/index.ts:195-211`)

**Vérifié à la main.**

```ts
let totalHt = 0;                                           // ← float
for (const item of cart.items) {
  const product = productMap.get(item.productId);
  // ...
  const unitPriceHt =
    variant && variant.productId === item.productId && variant.priceOverride != null
      ? Number(variant.priceOverride)                     // ← Decimal → float
      : Number(product.priceHt);
  totalHt += unitPriceHt * (item.quantity || 1);          // ← float math
}
const tvaRate = 0.20;
const tvaAmount = Math.round(totalHt * tvaRate * 100) / 100;
const shippingCost = body.shippingMethod === "STORE_PICKUP" ? 0 : (totalHt >= 100 ? 0 : 6.90);
totalTtc = totalHt + tvaAmount + shippingCost;
amountCents = Math.round(totalTtc * 100);                 // ← envoyé à Stripe
```

**Bug:** Le flow cart-first du checkout express (`POST /checkout/payment-intent` sans `orderId`) recalcule les totaux en `number` au lieu de `Decimal`, alors que `orders/index.ts:376-398` le fait correctement avec `new Decimal(...).mul().add()`. Sur des montants comme `19.99 × 7 + TVA + 6.90`, l'erreur d'arrondi peut produire un cent de différence entre l'affichage cart et le montant Stripe.

**Production impact:** Le client voit 159.83 € dans son panier puis est facturé 159.84 € (ou inversement). Disputes de remboursement, ticket support, mais pas de fraude exploitable. **P0 sur le principe** (incohérence d'argent en prod), **P1 en pratique** (express checkout pas activé par défaut, gated par `FEATURE_CHECKOUT_EXPRESS`).

**Mêmes problèmes:**
- `checkout/index.ts:373` : `amount: pi.amount / 100` stocké en Decimal (OK car `pi.amount` est int Stripe)
- `checkout/index.ts:470` : `totalSpent: { increment: amountEur }` où `amountEur` est `pi.amount / 100`
- `orders/index.ts:1562-1575` : refund — `Number(order.totalTtc)` puis `Math.round(refundAmount * 100)`. Vérifier.

**Fix:** Utiliser `new Decimal(0)` et `.add(...).mul(...)` exactement comme `orders/index.ts`. Extraire un helper `computeCartTotals(cartItems, products, variants)` réutilisé entre les deux flows.

---

## 🟠 P1 — vérifications recommandées avant fix

### P1-1 — IDOR sur `PUT /orders/:id/status` (`orders/index.ts:1280-1303`)

```ts
if (!isBackofficeRole(user.role)) {
  return reply.status(403).send({...});
}
// ... pas de findUnique sur l'order pour vérifier ownership ...
const updated = await app.prisma.order.update({
  where: { id },                                          // ← ID arbitraire
  data: { status: body.status },
});
```

Tout ADMIN/MANAGER/STAFF peut changer le statut de **n'importe quelle** commande. Pas de check de boutique multi-tenant (mais TrottiStore est mono-boutique donc l'impact est limité au mauvais usage interne par STAFF).

**Note:** À évaluer selon le modèle de confiance interne. Si STAFF n'est pas censé pouvoir toucher aux commandes, ajouter `requireRole("ADMIN", "MANAGER")`. Sinon, ajouter audit log obligatoire.

### P1-2 — IDOR sur `PUT /repairs/:id/quote/accept` (SAV `tickets/index.ts:838-870`)

```ts
if (user?.role === "CLIENT") {
  return reply.status(403).send({...});
}
// ... pas de check assignedTo ...
await tx.repairTicket.update({
  where: { id },
  data: { status: "DEVIS_ACCEPTE" },
});
```

Un TECHNICIAN peut accepter le devis d'un ticket auquel il n'est pas assigné.

**Fix:** Si TECHNICIAN, exiger `ticket.assignedTo === user.userId`.

### P1-3 — Race appointment booking (`sav/routes/tickets/index.ts:461-479`)

`count()` puis `create()` hors transaction. Deux clients peuvent réserver le même créneau.

**Fix:** Wrap dans `$transaction` ou contrainte UNIQUE `(technicianId, startsAt, endsAt)`.

### P1-4 — Customer merge loyalty hors transaction (`crm/routes/customers/index.ts:710-723`)

Déjà dans `AUDIT_PRODUCTION_CRITICAL.md` comme P0-4. Race + perte de loyaltyLog.

### P1-5 — Password reset token reuse race (`auth/index.ts:691-743`)

`findUnique(token)` → check `usedAt === null` → `update password + mark used`. Deux requêtes simultanées peuvent toutes les deux passer le check.

**Fix:** Mettre `usedAt: null` dans le `where` du `findUnique` initial **et** marquer `usedAt` dans le même `$transaction` que l'update password. Idéalement avec un `updateMany` qui filtre `usedAt: null` et compte le résultat.

### P1-6 — Access token en localStorage (`apps/web/src/lib/api.ts:59-63`)

Connu, déjà documenté. XSS = vol du token pendant 15 min. Refresh token httpOnly, donc dégâts limités. Mitigation principale : `sanitize-html` sur tout le contenu user-generated. **Recommandation** : ajouter CSP headers stricts.

---

## 🟡 Mediums

### Zod validation manquante (1 critical, 6 medium)

| Méthode | Fichier:ligne | Sévérité |
|---|---|---|
| **POST** | `services/crm/src/routes/campaigns/index.ts:230` (`request.body as { email?: string }`) | **critical** |
| GET | `services/ecommerce/src/routes/admin-users/index.ts:55` | medium |
| GET | `services/ecommerce/src/routes/reviews/index.ts:33,85,306` | medium |
| DELETE | `services/ecommerce/src/routes/admin/index.ts:313` | medium |
| GET | `services/ecommerce/src/routes/admin-invoices/index.ts:21` | medium |

**Fix critical:** `z.object({ email: z.string().email() }).parse(request.body)` sur `/campaigns/:id/preview`.

### N+1 hot paths (3 high)

| Fichier:ligne | Loop sur | Op | Hot path |
|---|---|---|---|
| `services/crm/src/routes/campaigns/index.ts:328` | profiles | `campaignSend.findUnique` per profile | campaign send |
| `services/crm/src/routes/campaigns/index.ts:345` | profiles | `campaignSend.create` per profile | campaign send |
| `services/crm/src/routes/triggers/index.ts:205,235,263` | tickets | `notificationLog.findFirst` per ticket | trigger cron horaire |

**Fix campaigns:** batch lookup `findMany({ in: ids })` + `Set` pour idempotence, puis `createMany({ skipDuplicates: true })`.

**Fix triggers:** même pattern `findMany` + `Set` avant la boucle.

---

## Synthèse des actions à mener

### Tier 1 — fixer cette semaine (P0)

| ID | Titre | Effort | Branche suggérée |
|---|---|---|---|
| P0-A | Stock race (atomic check-decrement + CHECK constraint) | 1-2h + migration | `fix(ecommerce)/stock-race` |
| P0-B | Float math en cart-first checkout (helper Decimal partagé) | 2-3h | `fix(checkout)/decimal-math` |
| P0-3* | Bypass `x-internal-cron` (déjà dans `AUDIT_PRODUCTION_CRITICAL.md`) | 30min | `fix(crm)/cron-secret` |
| P0-4* | Customer merge transaction split (déjà dans `AUDIT_PRODUCTION_CRITICAL.md`) | 2h | `fix(crm)/merge-tx` |

### Tier 2 — fixer ce sprint (P1)

| ID | Titre | Effort |
|---|---|---|
| P1-1 | IDOR `PUT /orders/:id/status` ownership | 30min |
| P1-2 | IDOR `PUT /repairs/:id/quote/accept` ownership | 30min |
| P1-3 | Appointment booking transaction | 30min |
| P1-5 | Password reset token reuse race | 30min |
| Critical Zod | `POST /campaigns/:id/preview` body schema | 15min |
| N+1 campaigns | batch findMany + createMany | 1h |
| N+1 triggers | batch findMany | 30min |

### Tier 3 — à planifier

- P1-6 access token cookie httpOnly (changement architectural)
- 6 medium Zod casts (cleanup)
- CSP headers stricts sur le front

---

## Faux positifs notables (à NE PAS fixer)

- **HS256 vs RS256** — flagué P0 par un agent précédent. C'est un choix architectural valide, pas un bug.
- **`prisma.$queryRaw` SQL injection** — flagué dans `AUDIT_REPORT.md`. Faux positifs : Prisma paramétrise les tagged template literals.
- **CSRF sur `/auth/logout`** — `sameSite: strict` est suffisant.
- **Schemas Prisma sans `onDelete` sur Shipment/NotificationLog** — à classer P0 seulement si `prisma.order.delete` ou `prisma.automatedTrigger.delete` est réellement appelé. À vérifier.
