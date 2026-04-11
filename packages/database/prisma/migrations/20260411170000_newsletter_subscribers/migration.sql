-- CreateTable
CREATE TABLE "crm"."newsletter_subscribers" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "confirm_token" VARCHAR(64),
    "unsubscribe_token" VARCHAR(64) NOT NULL,
    "source" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ,
    "unsubscribed_at" TIMESTAMPTZ,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "crm"."newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_confirm_token_key" ON "crm"."newsletter_subscribers"("confirm_token");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_key" ON "crm"."newsletter_subscribers"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_idx" ON "crm"."newsletter_subscribers"("status");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_created_at_idx" ON "crm"."newsletter_subscribers"("created_at");
