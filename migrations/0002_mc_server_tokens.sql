ALTER TABLE "mc_servers" ADD COLUMN IF NOT EXISTS "token_hash" varchar(64);
--> statement-breakpoint
ALTER TABLE "mc_servers" ADD COLUMN IF NOT EXISTS "token_rotated_at" timestamp;
