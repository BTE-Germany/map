-- Performance indexes for the region-metadata / profile / realtime hot paths.
-- NOTE: drizzle-kit also emitted CREATE TABLE/TYPE statements for mc_servers,
-- player_positions, player_privacy and teleport_requests because the migration
-- snapshots predating this change did not describe those (out-of-band) tables.
-- Those tables already exist in the database, so only the index DDL is kept
-- here. IF NOT EXISTS keeps the migration safe to (re)apply.
CREATE INDEX IF NOT EXISTS "player_positions_server_last_seen_idx" ON "player_positions" USING btree ("server_key","last_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_positions_last_seen_idx" ON "player_positions" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teleport_requests_status_idx" ON "teleport_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regions_creator_uuid_idx" ON "regions" USING btree ("creatorUUID");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "region_images_region_id_idx" ON "region_images" USING btree ("region_id");
