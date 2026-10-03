-- Staff-only notes must not leak into the public tracking page or CLIENT views.
ALTER TABLE "sav"."repair_status_log" ADD COLUMN "is_internal" BOOLEAN NOT NULL DEFAULT false;
-- Existing free-form notes (no status change) were added through the internal notes route.
UPDATE "sav"."repair_status_log" SET "is_internal" = true WHERE "from_status" = "to_status" AND "note" IS NOT NULL;
