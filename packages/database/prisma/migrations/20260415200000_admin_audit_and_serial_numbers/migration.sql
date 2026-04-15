-- Serial numbers on order items for warranty / SAV traceability.
-- Additive, non-destructive change — safe under traffic.

ALTER TABLE "ecommerce"."order_items"
  ADD COLUMN "serial_numbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- GIN index so "find the order that shipped SN X" stays fast.
CREATE INDEX "order_items_serial_numbers_idx"
  ON "ecommerce"."order_items" USING GIN ("serial_numbers");
