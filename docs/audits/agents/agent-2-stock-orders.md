# Agent 2 — Stock / Orders / Checkout / SAV

> **Date :** 2026-04-11
> **Agent :** Claude Code Explore subagent
> **Méthodologie :** scope strict 4 fichiers, max 5 findings, contexte injecté pour éviter doublons

## Scope effectif
- `services/ecommerce/src/routes/orders/index.ts` (1 800 lignes)
- `services/ecommerce/src/routes/checkout/index.ts` (494 lignes)
- `services/ecommerce/src/routes/stock/index.ts` (284 lignes)
- `services/sav/src/routes/tickets/index.ts` (1 139 lignes)

## Findings supplémentaires (au-delà des 3 P1 déjà connus du codex audit)

### 1. P1 — Race condition loyaltyPoints double-attribution

**Réf :** `checkout/index.ts:442-448` (check `alreadyAwarded`) puis `451-459` (create) puis `462-474` (update customerProfile)

**Symptôme :** Le check `alreadyAwarded` utilise `findFirst`, puis crée si absent. Si deux webhooks Stripe arrivent ultra-proches (Stripe peut retry), les deux `findFirst` peuvent passer (race). Pire : `loyaltyPoints: newPoints` utilise la valeur lue à la ligne 433, pas de guard atomique.

**Risque :** Double-attribution de points (ex: 100 points attribués 2x = 200 au lieu de 100). Tier client peut monter incorrectement (ex: devient GOLD au lieu de SILVER).

**Fix proposé :**
1. Ajouter une UNIQUE constraint sur `loyaltyPoint(profileId, referenceId, type)` dans le schema Prisma
2. Utiliser `upsert` au lieu de `findFirst` + `create`
3. Lire `customerProfile.loyaltyPoints` INSIDE la transaction avant d'incrémenter, OU utiliser `{ increment: pointsToAdd }` au lieu de `loyaltyPoints: newPoints`

### 2. P2 — Race condition status transitions (fromStatus stale)

**Réf :** `orders/index.ts:1396-1399` (findUnique) puis `1432` (fromStatus utilisé dans createHistory)

**Symptôme :** Deux admins appelant `PUT /admin/orders/:id/status` simultanément peuvent lire le même `order.status`, puis créent deux historiques avec le même `fromStatus`. Si le second appel réussit d'abord, son `fromStatus` sera obsolète (le statut a déjà changé entre-temps).

**Risque :** Trace d'audit incohérente, transitions fantômes (ex: PENDING→SHIPPED et PENDING→CANCELLED au lieu de PENDING→SHIPPED→CANCELLED visible dans l'historique).

**Fix proposé :** Relire le status INSIDE la transaction avant l'update, OU utiliser une colonne de version (optimistic locking) avec `updateMany ... where status = ?` qui retourne 0 si race.

### 3. P2 — Idempotence webhook Stripe fragile si orderId absent

**Réf :** `checkout/index.ts:350-353`

**Symptôme :** Si `pi.metadata.orderId` est vide, le code log un warning et return sans créer de record. Stripe retente le webhook → chaque retry log juste un warning, zéro idempotence.

**Risque :** Perte silencieuse de notification Stripe ou order jamais finalisée (wedged state). Aucun moyen de récupérer sans intervention manuelle.

**Fix proposé :**
- Soit lever une exception pour forcer un 500 et que Stripe retry (avec backoff)
- Soit créer un record `orphaned_payment_event` avec le `event.id` complet pour reconciliation manuelle ultérieure
- Idéalement les deux : log + table d'orphans

### 4. P2 — Boucles N+1 dans cancel / refund

**Réf :** `orders/index.ts:1442-1455` (cancel) et `1608-1615` (refund)

**Symptôme :** Boucle `for (const item of items) { await tx.productVariant.update(...) }` effectue N updates séquentiels au lieu d'un `updateMany` batch.

**Risque :** Chaque update prend du temps, bloque la transaction plus longtemps, augmente le risque de timeout et de lock escalation.

**Fix proposé :** Grouper les updates par variant et utiliser `updateMany` avec `where: { id: { in: variantIds } }` et calculs précalculés de `{ increment/decrement: totalQtyForVariant }`. Note : nécessite un map/reduce pour additionner les quantities par variantId si plusieurs items partagent le même variant.

### 5. P2 — TVA divergence à 3 endroits

**Réf :** `orders/index.ts:433-442` (calc à checkout), `checkout/index.ts:206-210` (calc alternatif), `734-737` (guest checkout autre calc)

**Symptôme :** TVA calculée 3 fois différemment (coefficient hardcodé 0.20, `TVA_RATE` constante, `product.tvaRate` par variant). Si `product.tvaRate` varie par produit, la TVA totale peut diverger entre l'affichage cart, la création order, et la facture émise.

**Risque :** Facture émise à `totalTtc=100€` mais recalcul de TVA = 20.5€ si produit a `tvaRate=0.205`. Divergence comptable observable côté client.

**Fix proposé :** Stocker la TVA itemized (`tvaAmount` par OrderItem) à la création de l'order, sommer pour le total. Verrouiller à la facture sans recalc.

## Non-findings (vérifié, OK)

- **Payment intent idempotence** (`checkout/index.ts:231, 357-363`) : OK. `findFirst` avec `status: "CONFIRMED"` prévient le double-traitement du webhook. Upsert dans la transaction.
- **Stock reserve installments** (`orders/index.ts:521-526`) : OK. Stocké dans `stockReserved` au lieu de `stockQuantity`. Cancel relâche correctement via `decrement: stockReserved`.
- **Webhook signature verification** (`checkout/index.ts:279`) : OK. `stripe.webhooks.constructEvent` valide la signature avant traitement.

## Angles non vérifiés

- Refund webhook Stripe vs paiement double (concurrence inverse)
- Calcul de taxe per-région (EU VAT 20% vs autre) — qui gère le TVA OSS ?
- Atomicité du `orderNumber` generation (auto-increment Postgres ou UUID ?)

## Recommandations

### Quick wins (< 30 min)
- Ajouter `// TODO idempotence` au webhook orphaned payment case avec un ticket
- Documenter dans CLAUDE.md que la TVA est fixe 0.20 vs `tvaRate` par produit (clarifier la spec de design)

### Structurants (> 1h)
- Refactor cancel/refund pour batch `updateMany` au lieu de boucles
- Ajouter version column ou optimistic lock sur les status transitions order
- Implémenter une table `orphaned_webhook_events` pour Stripe recovery
- Ajouter constraint UNIQUE sur `loyaltyPoint(profileId, referenceId, type)`
