-- Batch 2: suppliers + purchase orders + discount codes
-- All additive, no existing data touched.

-- ─── Suppliers ──────────────────────────────────────────────────
CREATE TABLE "ecommerce"."suppliers" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"          VARCHAR(200) NOT NULL,
  "slug"          VARCHAR(250) NOT NULL,
  "contact_name"  VARCHAR(200),
  "contact_email" VARCHAR(255),
  "contact_phone" VARCHAR(50),
  "website"       VARCHAR(500),
  "country"       VARCHAR(2) NOT NULL DEFAULT 'FR',
  "currency"      VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "payment_terms" VARCHAR(100),
  "lead_time_days" INTEGER,
  "notes"         TEXT,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "suppliers_slug_key" UNIQUE ("slug")
);
CREATE INDEX "suppliers_slug_idx"      ON "ecommerce"."suppliers"("slug");
CREATE INDEX "suppliers_is_active_idx" ON "ecommerce"."suppliers"("is_active");

-- ─── Purchase orders ────────────────────────────────────────────
CREATE TABLE "ecommerce"."purchase_orders" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "reference"   VARCHAR(50) NOT NULL,
  "supplier_id" UUID NOT NULL,
  "status"      VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "ordered_at"  TIMESTAMPTZ,
  "expected_at" TIMESTAMPTZ,
  "received_at" TIMESTAMPTZ,
  "total_ht"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency"    VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "note"        TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_orders_reference_key" UNIQUE ("reference"),
  CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id")
    REFERENCES "ecommerce"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "purchase_orders_supplier_id_idx" ON "ecommerce"."purchase_orders"("supplier_id");
CREATE INDEX "purchase_orders_status_idx"      ON "ecommerce"."purchase_orders"("status");

-- ─── Discount codes ─────────────────────────────────────────────
CREATE TABLE "ecommerce"."discount_codes" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"        VARCHAR(50) NOT NULL,
  "label"       VARCHAR(200),
  "kind"        VARCHAR(10) NOT NULL,
  "value"       DECIMAL(10,2) NOT NULL,
  "min_cart_ht" DECIMAL(10,2),
  "max_uses"    INTEGER,
  "used_count"  INTEGER NOT NULL DEFAULT 0,
  "starts_at"   TIMESTAMPTZ,
  "expires_at"  TIMESTAMPTZ,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discount_codes_code_key" UNIQUE ("code"),
  CONSTRAINT "discount_codes_kind_chk" CHECK ("kind" IN ('PERCENT','FIXED')),
  CONSTRAINT "discount_codes_value_chk" CHECK ("value" >= 0)
);
CREATE INDEX "discount_codes_code_idx"      ON "ecommerce"."discount_codes"("code");
CREATE INDEX "discount_codes_is_active_idx" ON "ecommerce"."discount_codes"("is_active");
