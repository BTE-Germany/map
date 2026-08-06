CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" json,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."bte_sync_status" AS ENUM('pending', 'synced', 'error');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bte_sync_state" (
	"region_id" uuid PRIMARY KEY NOT NULL,
	"claim_id" uuid,
	"status" "bte_sync_status" DEFAULT 'pending' NOT NULL,
	"fingerprint" varchar(64),
	"last_error" text,
	"last_attempt_at" timestamp,
	"synced_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bte_sync_state_status_idx" ON "bte_sync_state" USING btree ("status");
