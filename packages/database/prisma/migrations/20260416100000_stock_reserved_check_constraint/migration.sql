-- A5-01: Ensure stock_reserved is never negative (matches stock_quantity constraint)
ALTER TABLE ecommerce.product_variants
  ADD CONSTRAINT chk_stock_reserved_non_negative CHECK (stock_reserved >= 0);
