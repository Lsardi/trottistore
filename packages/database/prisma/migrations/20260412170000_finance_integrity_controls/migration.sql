-- Finance controls: immutable ledger + critical invariants

CREATE TABLE "ecommerce"."financial_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "order_number" INTEGER NOT NULL,
    "operation" VARCHAR(30) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "provider" VARCHAR(30) NOT NULL,
    "provider_ref" VARCHAR(255),
    "balance_before" INTEGER,
    "balance_after" INTEGER,
    "performed_by" UUID,
    "reason" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_ledger_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "financial_ledger_order_id_fkey" FOREIGN KEY ("order_id")
      REFERENCES "ecommerce"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "financial_ledger_currency_check" CHECK ("currency" = 'EUR'),
    CONSTRAINT "financial_ledger_operation_check" CHECK (
      "operation" IN ('CHARGE', 'REFUND_FULL', 'REFUND_PARTIAL', 'CANCEL', 'MANUAL_CONFIRM')
    )
);

CREATE INDEX "financial_ledger_order_id_idx" ON "ecommerce"."financial_ledger"("order_id");
CREATE INDEX "financial_ledger_order_number_idx" ON "ecommerce"."financial_ledger"("order_number");
CREATE INDEX "financial_ledger_operation_idx" ON "ecommerce"."financial_ledger"("operation");
CREATE INDEX "financial_ledger_created_at_idx" ON "ecommerce"."financial_ledger"("created_at");

-- Prevent duplicate provider events (for Stripe/webhook replay safety).
CREATE UNIQUE INDEX "financial_ledger_provider_operation_ref_key"
  ON "ecommerce"."financial_ledger"("provider", "operation", "provider_ref")
  WHERE "provider_ref" IS NOT NULL;

-- Immutable table: no UPDATE/DELETE, append-only.
CREATE OR REPLACE FUNCTION "ecommerce"."prevent_financial_ledger_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'financial_ledger is append-only';
END;
$$;

CREATE TRIGGER "financial_ledger_no_update"
BEFORE UPDATE ON "ecommerce"."financial_ledger"
FOR EACH ROW EXECUTE FUNCTION "ecommerce"."prevent_financial_ledger_mutation"();

CREATE TRIGGER "financial_ledger_no_delete"
BEFORE DELETE ON "ecommerce"."financial_ledger"
FOR EACH ROW EXECUTE FUNCTION "ecommerce"."prevent_financial_ledger_mutation"();

-- Critical payment/order consistency guardrails.
ALTER TABLE "ecommerce"."payments"
  ADD CONSTRAINT "payments_provider_ref_required_for_stripe_check"
  CHECK (provider <> 'stripe' OR provider_ref IS NOT NULL);

ALTER TABLE "ecommerce"."orders"
  ADD CONSTRAINT "orders_total_consistency_check"
  CHECK (total_ttc = subtotal_ht + tva_amount + shipping_cost);

CREATE INDEX "payments_status_created_at_idx"
  ON "ecommerce"."payments"("status", "created_at");
