-- Link each product to its primary supplier (nullable). Additive.
ALTER TABLE "ecommerce"."products"
  ADD COLUMN "primary_supplier_id" UUID,
  ADD CONSTRAINT "products_primary_supplier_id_fkey"
    FOREIGN KEY ("primary_supplier_id")
    REFERENCES "ecommerce"."suppliers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "products_primary_supplier_id_idx"
  ON "ecommerce"."products"("primary_supplier_id");
