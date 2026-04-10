UPDATE "ecommerce"."product_variants"
SET "stock_quantity" = 0
WHERE "stock_quantity" < 0;

ALTER TABLE "ecommerce"."product_variants"
ADD CONSTRAINT "stock_quantity_non_negative"
CHECK ("stock_quantity" >= 0)
NOT VALID;

ALTER TABLE "ecommerce"."product_variants"
VALIDATE CONSTRAINT "stock_quantity_non_negative";
