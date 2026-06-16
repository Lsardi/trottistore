-- 2FA fields on users
ALTER TABLE "shared"."users"
  ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "two_factor_secret" VARCHAR(255),
  ADD COLUMN     "two_factor_backup_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Email delivery tracking
CREATE TABLE "shared"."email_logs" (
    "id" UUID NOT NULL,
    "to_email" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "template" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(20),
    "provider_message_id" VARCHAR(255),
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_logs_to_email_idx" ON "shared"."email_logs"("to_email");
CREATE INDEX "email_logs_status_idx" ON "shared"."email_logs"("status");
CREATE INDEX "email_logs_provider_message_id_idx" ON "shared"."email_logs"("provider_message_id");
CREATE INDEX "email_logs_created_at_idx" ON "shared"."email_logs"("created_at");
