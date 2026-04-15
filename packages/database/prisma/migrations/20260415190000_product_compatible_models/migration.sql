-- Add compatible_models string array to products for the parts/scooter
-- compatibility (fitment) database. Default empty array so all existing
-- rows get a non-null value. Non-breaking change.

ALTER TABLE "ecommerce"."products"
  ADD COLUMN "compatible_models" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- GIN index so `WHERE 'Xiaomi M365 Pro' = ANY(compatible_models)` stays fast
-- when the catalog grows.
CREATE INDEX "products_compatible_models_idx"
  ON "ecommerce"."products" USING GIN ("compatible_models");
