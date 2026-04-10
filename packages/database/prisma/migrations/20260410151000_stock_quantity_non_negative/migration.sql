ALTER TABLE "ecommerce"."product_variants"
ADD CONSTRAINT "stock_quantity_non_negative"
CHECK ("stock_quantity" >= 0);
