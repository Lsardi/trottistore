-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "crm";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ecommerce";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sav";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "shared";

-- CreateTable
CREATE TABLE "shared"."users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone" VARCHAR(20),
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" VARCHAR(255),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "avatar_url" VARCHAR(500),
    "role" VARCHAR(20) NOT NULL DEFAULT 'CLIENT',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ,
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared"."refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "device_info" JSONB,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared"."password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared"."audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "user_name" VARCHAR(200),
    "action" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "resource_id" VARCHAR(100),
    "details" TEXT,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared"."addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'SHIPPING',
    "label" VARCHAR(100),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "company" VARCHAR(200),
    "street" VARCHAR(500) NOT NULL,
    "street2" VARCHAR(500),
    "city" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(10) NOT NULL,
    "country" VARCHAR(2) NOT NULL DEFAULT 'FR',
    "phone" VARCHAR(20),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(250) NOT NULL,
    "description" TEXT,
    "image_url" VARCHAR(500),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "meta_title" VARCHAR(200),
    "meta_description" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."brands" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(250) NOT NULL,
    "logo_url" VARCHAR(500),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."products" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(550) NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "brand_id" UUID,
    "price_ht" DECIMAL(10,2) NOT NULL,
    "tva_rate" DECIMAL(4,2) NOT NULL DEFAULT 20.0,
    "weight_grams" INTEGER,
    "dimensions" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "meta_title" VARCHAR(200),
    "meta_description" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."product_categories" (
    "product_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("product_id","category_id")
);

-- CreateTable
CREATE TABLE "ecommerce"."product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "alt" VARCHAR(300),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(200),
    "content" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "verified_purchase" BOOLEAN NOT NULL DEFAULT false,
    "service_tag" VARCHAR(30),
    "admin_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "price_override_ht" DECIMAL(10,2),
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "stock_reserved" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "attributes" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."pro_leads" (
    "id" UUID NOT NULL,
    "company" VARCHAR(200) NOT NULL,
    "contact_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "fleet_size" VARCHAR(50),
    "message" TEXT,
    "source" VARCHAR(30) NOT NULL DEFAULT 'WEB',
    "status" VARCHAR(20) NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pro_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."stock_alerts" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "notified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."stock_movements" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "reference_id" VARCHAR(100),
    "reference_type" VARCHAR(30),
    "performed_by" UUID,
    "stock_before" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."orders" (
    "id" UUID NOT NULL,
    "order_number" SERIAL NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "payment_method" VARCHAR(30) NOT NULL,
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "shipping_address" JSONB NOT NULL,
    "billing_address" JSONB NOT NULL,
    "subtotal_ht" DECIMAL(10,2) NOT NULL,
    "tva_amount" DECIMAL(10,2) NOT NULL,
    "shipping_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_ttc" DECIMAL(10,2) NOT NULL,
    "shipping_method" VARCHAR(20) NOT NULL DEFAULT 'DELIVERY',
    "notes" TEXT,
    "tracking_number" VARCHAR(100),
    "pickup_ready_at" TIMESTAMPTZ,
    "pickup_collected_at" TIMESTAMPTZ,
    "shipped_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "quantity" INTEGER NOT NULL,
    "unit_price_ht" DECIMAL(10,2) NOT NULL,
    "tva_rate" DECIMAL(4,2) NOT NULL,
    "total_ht" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" VARCHAR(30) NOT NULL,
    "to_status" VARCHAR(30) NOT NULL,
    "note" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "provider_ref" VARCHAR(255),
    "amount" DECIMAL(10,2) NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "bank_reference" VARCHAR(100),
    "received_at" TIMESTAMPTZ,
    "reconciled_at" TIMESTAMPTZ,
    "reconciled_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."payment_installments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "total_installments" INTEGER NOT NULL,
    "amount_due" DECIMAL(10,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "payment_reference" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "reminder_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "carrier" VARCHAR(50) NOT NULL,
    "tracking_number" VARCHAR(100),
    "label_url" VARCHAR(500),
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "weight_grams" INTEGER,
    "shipped_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."daily_sales" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "avgOrderValue" DECIMAL(12,2) NOT NULL,
    "newCustomers" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecommerce"."product_rankings" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(550) NOT NULL,
    "imageUrl" VARCHAR(500),
    "totalRevenue" DECIMAL(12,2) NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "rankingDate" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."customer_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" VARCHAR(30) NOT NULL DEFAULT 'WEBSITE',
    "loyalty_tier" VARCHAR(20) NOT NULL DEFAULT 'BRONZE',
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "last_order_at" TIMESTAMPTZ,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scooter_models" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "rfm_recency" INTEGER,
    "rfm_frequency" INTEGER,
    "rfm_monetary" DECIMAL(12,2),
    "health_score" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."loyalty_tier_summary" (
    "id" UUID NOT NULL,
    "tier" VARCHAR(30) NOT NULL,
    "customerCount" INTEGER NOT NULL,
    "avgSpent" DECIMAL(12,2) NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "loyalty_tier_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."customer_interactions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "channel" VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    "subject" VARCHAR(300),
    "content" TEXT,
    "agent_id" UUID,
    "reference_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."loyalty_points" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "reference_id" VARCHAR(100),
    "description" VARCHAR(300),
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."customer_segments" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "criteria" JSONB NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "is_automatic" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."email_campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "template_id" VARCHAR(100),
    "segment_id" UUID,
    "content" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "stats" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."campaign_sends" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SENT',
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT,

    CONSTRAINT "campaign_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."automated_triggers" (
    "id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "delay_hours" INTEGER NOT NULL,
    "channel" VARCHAR(10) NOT NULL DEFAULT 'EMAIL',
    "template_id" VARCHAR(100),
    "sms_content" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "automated_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm"."notification_logs" (
    "id" UUID NOT NULL,
    "trigger_id" UUID,
    "ticket_id" UUID,
    "customer_id" UUID,
    "channel" VARCHAR(10) NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500),
    "content" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SENT',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sav"."repair_tickets" (
    "id" UUID NOT NULL,
    "ticket_number" SERIAL NOT NULL,
    "customer_id" UUID,
    "customer_name" VARCHAR(200),
    "customer_email" VARCHAR(255),
    "customer_phone" VARCHAR(20),
    "order_id" UUID,
    "product_model" VARCHAR(200) NOT NULL,
    "serial_number" VARCHAR(100),
    "type" VARCHAR(30) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'RECU',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "visit_reason" VARCHAR(300),
    "issue_description" TEXT NOT NULL,
    "diagnosis" TEXT,
    "estimated_cost" DECIMAL(10,2),
    "actual_cost" DECIMAL(10,2),
    "estimated_days" INTEGER,
    "assigned_to" UUID,
    "received_by" UUID,
    "photos_before" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photos_after" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photos_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tracking_token" UUID NOT NULL,
    "quote_accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "closed_at" TIMESTAMPTZ,

    CONSTRAINT "repair_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sav"."repair_status_log" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "from_status" VARCHAR(30) NOT NULL,
    "to_status" VARCHAR(30) NOT NULL,
    "note" TEXT,
    "performed_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_status_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sav"."repair_activity_log" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "performed_by" UUID,
    "performer_name" VARCHAR(200),
    "details" TEXT,
    "handover_note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sav"."repair_parts_used" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "variant_id" UUID,
    "part_name" VARCHAR(200) NOT NULL,
    "part_reference" VARCHAR(100),
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_parts_used_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sav"."technicians" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "specialities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "max_concurrent_tickets" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sav"."repair_appointments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID,
    "customer_id" UUID,
    "customer_name" VARCHAR(200) NOT NULL,
    "customer_email" VARCHAR(255),
    "customer_phone" VARCHAR(20) NOT NULL,
    "service_type" VARCHAR(30) NOT NULL DEFAULT 'REPARATION',
    "is_express" BOOLEAN NOT NULL DEFAULT false,
    "express_surcharge" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'BOOKED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "repair_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "shared"."users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "shared"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "shared"."users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "shared"."users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "shared"."refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "shared"."refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "shared"."password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "shared"."password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "shared"."audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "shared"."audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "shared"."audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "shared"."audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "shared"."addresses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "ecommerce"."categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "ecommerce"."categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "ecommerce"."categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "ecommerce"."brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "ecommerce"."products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "ecommerce"."products"("slug");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "ecommerce"."products"("sku");

-- CreateIndex
CREATE INDEX "products_slug_idx" ON "ecommerce"."products"("slug");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "ecommerce"."products"("brand_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "ecommerce"."products"("status");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "ecommerce"."product_images"("product_id");

-- CreateIndex
CREATE INDEX "reviews_product_id_idx" ON "ecommerce"."reviews"("product_id");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "ecommerce"."reviews"("status");

-- CreateIndex
CREATE INDEX "reviews_created_at_idx" ON "ecommerce"."reviews"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_product_id_key" ON "ecommerce"."reviews"("user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "ecommerce"."product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "ecommerce"."product_variants"("product_id");

-- CreateIndex
CREATE INDEX "product_variants_sku_idx" ON "ecommerce"."product_variants"("sku");

-- CreateIndex
CREATE INDEX "pro_leads_email_idx" ON "ecommerce"."pro_leads"("email");

-- CreateIndex
CREATE INDEX "pro_leads_status_idx" ON "ecommerce"."pro_leads"("status");

-- CreateIndex
CREATE INDEX "pro_leads_created_at_idx" ON "ecommerce"."pro_leads"("created_at");

-- CreateIndex
CREATE INDEX "stock_alerts_variant_id_idx" ON "ecommerce"."stock_alerts"("variant_id");

-- CreateIndex
CREATE INDEX "stock_alerts_status_idx" ON "ecommerce"."stock_alerts"("status");

-- CreateIndex
CREATE INDEX "stock_alerts_created_at_idx" ON "ecommerce"."stock_alerts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_alerts_product_id_email_key" ON "ecommerce"."stock_alerts"("product_id", "email");

-- CreateIndex
CREATE INDEX "stock_movements_variant_id_idx" ON "ecommerce"."stock_movements"("variant_id");

-- CreateIndex
CREATE INDEX "stock_movements_type_idx" ON "ecommerce"."stock_movements"("type");

-- CreateIndex
CREATE INDEX "stock_movements_reference_id_idx" ON "ecommerce"."stock_movements"("reference_id");

-- CreateIndex
CREATE INDEX "stock_movements_created_at_idx" ON "ecommerce"."stock_movements"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "ecommerce"."orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "ecommerce"."orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "ecommerce"."orders"("status");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "ecommerce"."orders"("payment_status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "ecommerce"."orders"("created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "ecommerce"."order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "ecommerce"."order_status_history"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "ecommerce"."payments"("provider_ref");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "ecommerce"."payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_provider_ref_idx" ON "ecommerce"."payments"("provider_ref");

-- CreateIndex
CREATE INDEX "payment_installments_order_id_idx" ON "ecommerce"."payment_installments"("order_id");

-- CreateIndex
CREATE INDEX "payment_installments_due_date_idx" ON "ecommerce"."payment_installments"("due_date");

-- CreateIndex
CREATE INDEX "payment_installments_status_idx" ON "ecommerce"."payment_installments"("status");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "ecommerce"."shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_tracking_number_idx" ON "ecommerce"."shipments"("tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sales_date_key" ON "ecommerce"."daily_sales"("date");

-- CreateIndex
CREATE INDEX "product_rankings_rankingDate_idx" ON "ecommerce"."product_rankings"("rankingDate");

-- CreateIndex
CREATE UNIQUE INDEX "product_rankings_productId_rankingDate_key" ON "ecommerce"."product_rankings"("productId", "rankingDate");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_user_id_key" ON "crm"."customer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "customer_profiles_loyalty_tier_idx" ON "crm"."customer_profiles"("loyalty_tier");

-- CreateIndex
CREATE INDEX "customer_profiles_total_spent_idx" ON "crm"."customer_profiles"("total_spent");

-- CreateIndex
CREATE INDEX "customer_profiles_health_score_idx" ON "crm"."customer_profiles"("health_score");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_tier_summary_tier_key" ON "crm"."loyalty_tier_summary"("tier");

-- CreateIndex
CREATE INDEX "customer_interactions_customer_id_idx" ON "crm"."customer_interactions"("customer_id");

-- CreateIndex
CREATE INDEX "customer_interactions_type_idx" ON "crm"."customer_interactions"("type");

-- CreateIndex
CREATE INDEX "customer_interactions_created_at_idx" ON "crm"."customer_interactions"("created_at");

-- CreateIndex
CREATE INDEX "loyalty_points_profile_id_idx" ON "crm"."loyalty_points"("profile_id");

-- CreateIndex
CREATE INDEX "loyalty_points_created_at_idx" ON "crm"."loyalty_points"("created_at");

-- CreateIndex
CREATE INDEX "email_campaigns_status_idx" ON "crm"."email_campaigns"("status");

-- CreateIndex
CREATE INDEX "campaign_sends_campaign_id_idx" ON "crm"."campaign_sends"("campaign_id");

-- CreateIndex
CREATE INDEX "campaign_sends_customer_id_idx" ON "crm"."campaign_sends"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_sends_campaign_id_customer_id_key" ON "crm"."campaign_sends"("campaign_id", "customer_id");

-- CreateIndex
CREATE INDEX "automated_triggers_type_idx" ON "crm"."automated_triggers"("type");

-- CreateIndex
CREATE INDEX "automated_triggers_is_active_idx" ON "crm"."automated_triggers"("is_active");

-- CreateIndex
CREATE INDEX "notification_logs_trigger_id_idx" ON "crm"."notification_logs"("trigger_id");

-- CreateIndex
CREATE INDEX "notification_logs_ticket_id_idx" ON "crm"."notification_logs"("ticket_id");

-- CreateIndex
CREATE INDEX "notification_logs_customer_id_idx" ON "crm"."notification_logs"("customer_id");

-- CreateIndex
CREATE INDEX "notification_logs_created_at_idx" ON "crm"."notification_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "repair_tickets_ticket_number_key" ON "sav"."repair_tickets"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "repair_tickets_tracking_token_key" ON "sav"."repair_tickets"("tracking_token");

-- CreateIndex
CREATE INDEX "repair_tickets_customer_id_idx" ON "sav"."repair_tickets"("customer_id");

-- CreateIndex
CREATE INDEX "repair_tickets_tracking_token_idx" ON "sav"."repair_tickets"("tracking_token");

-- CreateIndex
CREATE INDEX "repair_tickets_status_idx" ON "sav"."repair_tickets"("status");

-- CreateIndex
CREATE INDEX "repair_tickets_assigned_to_idx" ON "sav"."repair_tickets"("assigned_to");

-- CreateIndex
CREATE INDEX "repair_tickets_created_at_idx" ON "sav"."repair_tickets"("created_at");

-- CreateIndex
CREATE INDEX "repair_status_log_ticket_id_idx" ON "sav"."repair_status_log"("ticket_id");

-- CreateIndex
CREATE INDEX "repair_activity_log_ticket_id_idx" ON "sav"."repair_activity_log"("ticket_id");

-- CreateIndex
CREATE INDEX "repair_activity_log_performed_by_idx" ON "sav"."repair_activity_log"("performed_by");

-- CreateIndex
CREATE INDEX "repair_activity_log_created_at_idx" ON "sav"."repair_activity_log"("created_at");

-- CreateIndex
CREATE INDEX "repair_parts_used_ticket_id_idx" ON "sav"."repair_parts_used"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "technicians_user_id_key" ON "sav"."technicians"("user_id");

-- CreateIndex
CREATE INDEX "repair_appointments_starts_at_idx" ON "sav"."repair_appointments"("starts_at");

-- CreateIndex
CREATE INDEX "repair_appointments_status_idx" ON "sav"."repair_appointments"("status");

-- CreateIndex
CREATE INDEX "repair_appointments_ticket_id_idx" ON "sav"."repair_appointments"("ticket_id");

-- CreateIndex
CREATE INDEX "repair_appointments_customer_id_idx" ON "sav"."repair_appointments"("customer_id");

-- AddForeignKey
ALTER TABLE "shared"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "shared"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "shared"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared"."addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "shared"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ecommerce"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "ecommerce"."brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."product_categories" ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ecommerce"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."product_categories" ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ecommerce"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ecommerce"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "shared"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ecommerce"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ecommerce"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."stock_alerts" ADD CONSTRAINT "stock_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ecommerce"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."stock_alerts" ADD CONSTRAINT "stock_alerts_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "ecommerce"."product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "ecommerce"."product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "shared"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ecommerce"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "ecommerce"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "ecommerce"."product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ecommerce"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ecommerce"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecommerce"."payment_installments" ADD CONSTRAINT "payment_installments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ecommerce"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "shared"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."customer_interactions" ADD CONSTRAINT "customer_interactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "shared"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."customer_interactions" ADD CONSTRAINT "customer_interactions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "shared"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."loyalty_points" ADD CONSTRAINT "loyalty_points_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "crm"."customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."campaign_sends" ADD CONSTRAINT "campaign_sends_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm"."email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."notification_logs" ADD CONSTRAINT "notification_logs_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "crm"."automated_triggers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav"."repair_tickets" ADD CONSTRAINT "repair_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "shared"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav"."repair_tickets" ADD CONSTRAINT "repair_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "shared"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav"."repair_tickets" ADD CONSTRAINT "repair_tickets_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "shared"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav"."repair_status_log" ADD CONSTRAINT "repair_status_log_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sav"."repair_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav"."repair_activity_log" ADD CONSTRAINT "repair_activity_log_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sav"."repair_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav"."repair_parts_used" ADD CONSTRAINT "repair_parts_used_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sav"."repair_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav"."repair_parts_used" ADD CONSTRAINT "repair_parts_used_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "ecommerce"."product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav"."technicians" ADD CONSTRAINT "technicians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "shared"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav"."repair_appointments" ADD CONSTRAINT "repair_appointments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "sav"."repair_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav"."repair_appointments" ADD CONSTRAINT "repair_appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "shared"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
