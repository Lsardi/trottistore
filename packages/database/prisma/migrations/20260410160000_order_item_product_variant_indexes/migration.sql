-- Add product-scoped and variant-scoped indexes on order_items.
--
-- Rationale (AUDIT_ATOMIC.md#P1-8): the table only indexed (order_id),
-- so queries that scan "all orders containing product X" or "all orders
-- referencing variant Y" required a full table scan. Under production
-- load with millions of rows, this causes lock contention on product
-- deletion, analytics aggregations, and inventory reconciliation.
--
-- CONCURRENTLY is used so the migration does not take an ACCESS
-- EXCLUSIVE lock on order_items. A tradeoff: CONCURRENTLY cannot run
-- inside a transaction, so the migration file contains one statement
-- per line and must not be wrapped. Each CREATE is idempotent via
-- IF NOT EXISTS so a retry after a partial failure is safe.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "order_items_product_id_idx"
  ON "ecommerce"."order_items" ("product_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "order_items_variant_id_idx"
  ON "ecommerce"."order_items" ("variant_id");
