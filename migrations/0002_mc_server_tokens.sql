ALTER TABLE "mc_servers" ADD COLUMN "token_hash" varchar(64);
--> statement-breakpoint
ALTER TABLE "mc_servers" ADD COLUMN "token_rotated_at" timestamp;
