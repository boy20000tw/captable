ALTER TABLE "notifications" ADD COLUMN "source" varchar(32);
--> statement-breakpoint

-- Backfill existing rows: anything with metadata "source":"deadline" → 'deadline',
-- anything with broadcast:true (legacy broadcasts) → 'broadcast'.
UPDATE "notifications" SET "source" = 'deadline'
  WHERE "metadata" LIKE '%"source":"deadline"%' AND "source" IS NULL;
--> statement-breakpoint

UPDATE "notifications" SET "source" = 'broadcast'
  WHERE "type" = 'platform_broadcast' AND "source" IS NULL;
--> statement-breakpoint

-- Index for the deadline-dedup hot path: companyId + source + createdAt.
CREATE INDEX IF NOT EXISTS "notifications_source_idx"
  ON "notifications" ("companyId", "source", "createdAt" DESC);
