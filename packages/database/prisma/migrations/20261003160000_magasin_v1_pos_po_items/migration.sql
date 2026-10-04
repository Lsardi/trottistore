-- Magasin V1: vente comptoir, réception fournisseur, scan.

CREATE TABLE "ecommerce"."pos_sessions" (
  "id" UUID NOT NULL,
  "status" VARCHAR(10) NOT NULL DEFAULT 'OPEN',
  "opened_by" UUID NOT NULL,
  "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "opening_cash_cents" INTEGER NOT NULL,
  "closed_by" UUID,
  "closed_at" TIMESTAMPTZ,
  "closing_cash_cents" INTEGER,
  "expected_cash_cents" INTEGER,
  "note" TEXT,
  CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pos_sessions_status_idx" ON "ecommerce"."pos_sessions"("status");
CREATE INDEX "pos_sessions_opened_at_idx" ON "ecommerce"."pos_sessions"("opened_at" DESC);
-- At most one open register at a time (single-store V1).
CREATE UNIQUE INDEX "pos_sessions_single_open_idx" ON "ecommerce"."pos_sessions"("status") WHERE "status" = 'OPEN';

ALTER TABLE "ecommerce"."orders"
  ADD COLUMN "channel" VARCHAR(10) NOT NULL DEFAULT 'WEB',
  ADD COLUMN "pos_session_id" UUID;
ALTER TABLE "ecommerce"."orders"
  ADD CONSTRAINT "orders_pos_session_id_fkey" FOREIGN KEY ("pos_session_id")
  REFERENCES "ecommerce"."pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "orders_channel_created_at_idx" ON "ecommerce"."orders"("channel", "created_at" DESC);
CREATE INDEX "orders_pos_session_id_idx" ON "ecommerce"."orders"("pos_session_id");

ALTER TABLE "ecommerce"."product_variants" ADD COLUMN "barcode" VARCHAR(64);
CREATE UNIQUE INDEX "product_variants_barcode_key" ON "ecommerce"."product_variants"("barcode");

CREATE TABLE "ecommerce"."purchase_order_items" (
  "id" UUID NOT NULL,
  "purchase_order_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "quantity_ordered" INTEGER NOT NULL,
  "quantity_received" INTEGER NOT NULL DEFAULT 0,
  "unit_cost_ht" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_order_items_qty_check" CHECK ("quantity_ordered" > 0 AND "quantity_received" >= 0)
);
CREATE UNIQUE INDEX "purchase_order_items_purchase_order_id_variant_id_key" ON "ecommerce"."purchase_order_items"("purchase_order_id", "variant_id");
CREATE INDEX "purchase_order_items_variant_id_idx" ON "ecommerce"."purchase_order_items"("variant_id");
ALTER TABLE "ecommerce"."purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id")
  REFERENCES "ecommerce"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ecommerce"."purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_variant_id_fkey" FOREIGN KEY ("variant_id")
  REFERENCES "ecommerce"."product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
