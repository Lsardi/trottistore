-- T-60: Order totalTtc must be non-negative
ALTER TABLE ecommerce.orders
  ADD CONSTRAINT chk_order_total_ttc_non_negative CHECK (total_ttc >= 0);

-- T-61: Payment amount must be non-negative
ALTER TABLE ecommerce.payments
  ADD CONSTRAINT chk_payment_amount_non_negative CHECK (amount >= 0);

-- T-62: Review rating must be between 1 and 5
ALTER TABLE ecommerce.reviews
  ADD CONSTRAINT chk_review_rating_range CHECK (rating >= 1 AND rating <= 5);

-- T-63: Product variant lowStockThreshold must be non-negative
ALTER TABLE ecommerce.product_variants
  ADD CONSTRAINT chk_low_stock_threshold_non_negative CHECK (low_stock_threshold >= 0);

-- T-64: LoyaltyPoint points — no overflow guard needed, but ensure reasonable range
-- Points can be negative (redemptions), so we only guard against extreme values
ALTER TABLE crm.loyalty_points
  ADD CONSTRAINT chk_loyalty_points_range CHECK (points >= -1000000 AND points <= 1000000);

-- T-39: Unique constraint on notification_logs (trigger_id, ticket_id)
-- Prevents duplicate trigger notifications for the same ticket
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_trigger_ticket
  ON crm.notification_logs (trigger_id, ticket_id)
  WHERE trigger_id IS NOT NULL AND ticket_id IS NOT NULL;
