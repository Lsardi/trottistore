-- Add product-scoped and variant-scoped indexes on order_items.
--
-- Rationale (AUDIT_ATOMIC.md#P1-8): the table only indexed (order_id),
-- so queries that filter by product_id or variant_id required a full
-- table scan. Broken query patterns:
--   - "all orders containing product X" (merchant feed, analytics)
--   - "has variant Y ever been sold?" (inventory reconciliation)
--   - "orders by variant for the last N days" (cohort analytics)
--
-- Production caveat
-- -----------------
-- This migration uses a plain CREATE INDEX because Prisma Migrate wraps
-- every migration file in a transaction, and `CREATE INDEX CONCURRENTLY`
-- cannot run inside a transaction block (Postgres error 25001).
--
-- On a small or medium-sized `order_items` table this is fine: the
-- CREATE INDEX takes milliseconds and the brief ACCESS EXCLUSIVE lock
-- does not impact users.
--
-- If this repository ever has an order_items table large enough that a
-- synchronous CREATE INDEX would lock the table for seconds or more in
-- production, the DBA runbook is:
--   1. Before the release, run manually on the prod DB:
--        CREATE INDEX CONCURRENTLY IF NOT EXISTS
--          "order_items_product_id_idx" ON "ecommerce"."order_items" ("product_id");
--        CREATE INDEX CONCURRENTLY IF NOT EXISTS
--          "order_items_variant_id_idx" ON "ecommerce"."order_items" ("variant_id");
--   2. Mark this migration as already applied:
--        pnpm --filter @trottistore/database exec prisma migrate resolve \
--          --applied 20260410160000_order_item_product_variant_indexes
--   3. Proceed with the normal release.
-- This keeps the migration history clean while avoiding the prod lock.

CREATE INDEX IF NOT EXISTS "order_items_product_id_idx"
  ON "ecommerce"."order_items" ("product_id");

CREATE INDEX IF NOT EXISTS "order_items_variant_id_idx"
  ON "ecommerce"."order_items" ("variant_id");
