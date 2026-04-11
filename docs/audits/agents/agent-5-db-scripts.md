# Agent 5 — DB / Scripts / Data Integrity

> **Date :** 2026-04-11
> **Agent :** Claude Code Explore subagent
> **Scope :** prisma schema + migrations + scripts/

## Scope effectif

- `packages/database/prisma/schema.prisma` (868 lignes)
- `packages/database/prisma/migrations/20260410004818_init/migration.sql`
- `packages/database/prisma/migrations/20260410151000_stock_quantity_non_negative/migration.sql`
- `packages/database/prisma/migrations/20260410160000_order_item_product_variant_indexes/migration.sql`
- `packages/database/prisma/migrations/20260411170000_newsletter_subscribers/migration.sql`
- `scripts/seed.ts` (471 lignes)
- `scripts/seed-demo.ts` (553 lignes)
- `scripts/seed-orders.ts` (191 lignes)
- `scripts/seed-scooters.ts` (170 lignes)
- `scripts/sync-woocommerce.ts` (408 lignes)
- `scripts/crawl-suppliers.ts` (340 lignes)
- `scripts/simulate-month.ts` (263 lignes)

## Findings supplémentaires

### 1. P2 — `simulate-month.ts` exécutable sans guard NODE_ENV (risque prod) 🔴

**Réf :** `scripts/simulate-month.ts:9-10`

**Symptôme :** `const prisma = new PrismaClient()` sans vérification `NODE_ENV` ni `DATABASE_URL`. Le script crée 30 jours de faux clients/commandes/tickets dans la DB pointée par `DATABASE_URL`.

**Risque :** Si un dev/script non-attentionné exécute `pnpm tsx scripts/simulate-month.ts` en pointant accidentellement vers prod (DATABASE_URL mal configuré dans le shell), 30 jours de faux ordres polluent la base en 2 secondes.

**Fix proposé :** Ajouter en tête du `main()` :

```typescript
if (process.env.NODE_ENV === "production") {
  console.error("❌ simulate-month.ts REFUSES to run in production.");
  process.exit(1);
}
```

### 2. P2 — `sync-woocommerce.ts` efface toutes les images à chaque sync

**Réf :** `scripts/sync-woocommerce.ts:333-335`

**Symptôme :** `await prisma.productImage.deleteMany({ where: { productId: product.id } })` suivi de `createMany`. Si l'API WooCommerce retourne 0 images (bug réseau, timeout partiel), toutes les images du produit sont supprimées.

**Risque :** Produits sans images en storefront. Migration data inévitable si sync est partiellement échouée.

**Fix proposé :** Implémenter idempotence via `findMany + diff` ou au minimum, logger WARN si `imageCount < countBefore` AVANT le delete.

### 3. P2 — `crawl-suppliers.ts` délai REQUEST_DELAY_MS trop court pour Wattiz

**Réf :** `scripts/crawl-suppliers.ts:28`

**Symptôme :** `const REQUEST_DELAY_MS = 400` = 2.5 req/sec. Wattiz est un Prestashop public OK pas de bot challenge, mais le délai politesse standard pour un crawler responsable est 1-2 sec entre requêtes.

**Risque :** Ban IP si Wattiz/CDN détecte abus, ou dégradation observable de leur service.

**Fix proposé :** Augmenter à `800` ms (1.25 req/sec) ou ajouter exponential backoff sur HTTP 429.

### 4. P3 — Inconsistency Decimal precision : DailySales/ProductRanking vs Orders

**Réf :** `schema.prisma:491,493,509` vs `361-364`

**Symptôme :** Tables analytics (`DailySales`, `ProductRanking`) utilisent `Decimal(12, 2)` tandis que `Order`/`Payment` utilisent `Decimal(10, 2)`. Lors d'une somme/avg sur les commandes > 9999€99, l'arrondi diverge.

**Risque :** Écart sur KPI (revenue analytique vs revenue réelle). Peu critique car rare (HT max ~5k€/produit × 10 lignes = ~50k€), mais visible sur CA annuel.

**Fix proposé :** Harmoniser à `Decimal(12, 2)` pour Order/Payment/OrderItem aussi, OU documenter la limite.

### 5. P3 — `seed-demo.ts` hardcode `demo1234` password

**Réf :** `scripts/seed-demo.ts:10`

**Symptôme :** `const PASSWORD = hashSync("demo1234", 10)` — mot de passe trivial en clair dans le code.

**Risque :** Faible en dev (c'est le but d'une démo), mais si ce script s'exécute par accident en staging/prod (DATABASE_URL mal configuré), tous les users démo deviennent accessibles via ce password.

**Fix proposé :** Ajouter env guard NODE_ENV !== production OU documenter explicitement "DEMO DATA ONLY" en banner haut du script.

## Non-findings (vérifié, OK)

- ✓ Decimal precision cohérente globalement (10,2 transactional / 12,2 analytics)
- ✓ Tous les String ont des limites VarChar (pas de TEXT non-borné en clé)
- ✓ FK cross-schema correctement référencées (User shared → ecommerce/crm/sav)
- ✓ DELETE CASCADE approprié (User → Address, RefreshToken, Orders, Tickets)
- ✓ Seed scripts idempotents : upsert, skipDuplicates, ou guards (seed-orders refuse si count >= 10)
- ✓ Migration `20260410160000` (order_items index) : CREATE INDEX non-CONCURRENT OK pour petite table (61 rows / 40 kB validé)
- ✓ Migration `20260410151000` (CHECK constraint stock) : pattern NOT VALID + VALIDATE bon
- ✓ `seed.ts` SEED_ADMIN_PASSWORD env guard strict (>= 12 chars)
- ✓ `crawl-suppliers.ts` Volt Corp désactivé justifié (Cloudflare + robots.txt opt-out)

## Angles non vérifiés

- Performance indexes : pas d'analyse `EXPLAIN ANALYZE` (taille tables prod inconnue au-delà de order_items)
- Rollback migration : `CREATE INDEX IF NOT EXISTS` safe, mais pas de `DROP IF EXISTS` en rollback
- Newsletter migration `20260411170000` : pas inspectée en détail (F1 déjà livré et vérifié end-to-end)

## Recommandations

### Quick wins
- **P2** Ajouter `if (NODE_ENV === 'prod') { throw }` dans `simulate-month.ts` (5 min)
- **P2** Augmenter `REQUEST_DELAY_MS` à 800ms dans `crawl-suppliers.ts` (1 min)

### Structurants
- Harmoniser `Decimal(12,2)` pour tous les montants (order/payment/orderitem) ou documenter la limite
- Ajouter test "2x seed.ts" → doit refuser (idempotence assertion)
- `sync-woocommerce.ts` : implémenter image diffing avant delete
