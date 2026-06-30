import { sql } from "drizzle-orm"
import { boolean, index, integer, json, numeric, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const regionType = pgEnum('region_type', ['default', 'plot', 'event']);

export type LandUseStats = {
	forest: number;
	water: number;
	farmland: number;
	residential: number;
	industrial: number;
	park: number;
};

export const region = pgTable("regions", {
	id: uuid().primaryKey().defaultRandom(),
	description: text().default(''),
	creatorUUID: uuid().notNull(),
	polygon: json().$type<[number, number][]>().notNull(),
	city: varchar("city", { length: 265 }).notNull(),
	state: varchar("state", { length: 2 }).notNull().default(''),
	area: numeric().notNull(),
	buildings: integer().default(0).notNull(),
	landuse: json("landuse").$type<LandUseStats>(),
	createdAt: timestamp().defaultNow(),
	modifiedAt: timestamp().defaultNow().$onUpdate(() => new Date()).notNull(),
	type: regionType().default('default').notNull(),
	address: text().default('').notNull(),
	finished: boolean().default(false).notNull(),
	builders: json("builders").$type<string[]>(),
}, (table) => [
	index("regions_creator_uuid_idx").on(table.creatorUUID),
]);

export const regionImage = pgTable("region_images", {
	id: uuid().primaryKey().defaultRandom(),
	regionId: uuid("region_id").notNull(),
	uploaderUUID: uuid("uploader_uuid").notNull(),
	s3Key: text("s3_key").notNull(),
	mimeType: varchar("mime_type", { length: 64 }).notNull(),
	sizeBytes: integer("size_bytes").notNull(),
	originalName: varchar("original_name", { length: 256 }),
	createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
	index("region_images_region_id_idx").on(table.regionId),
]);

/**
 * A single Minecraft Paper server in the network. The plugin running on it
 * authenticates with one or more `mcApiToken` rows that reference this row.
 *
 * `states` is the list of Bundesland-codes ("BE", "BB", …) that this server
 * is responsible for. Teleports are routed to the server that handles the
 * region's state.
 */
export const mcServer = pgTable("mc_servers", {
	id: uuid().primaryKey().defaultRandom(),
	key: varchar("key", { length: 64 }).notNull().unique(),
	name: varchar("name", { length: 128 }).notNull(),
	states: json("states").$type<string[]>().notNull().default(sql`'[]'::json`),
	/**
	 * Bearer-token hash (SHA-256, hex). The plain token is shown to the admin
	 * exactly once on creation/rotation. `null` means no token configured —
	 * the server can't authenticate until one is set.
	 */
	tokenHash: varchar("token_hash", { length: 64 }),
	tokenRotatedAt: timestamp("token_rotated_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Per-player privacy / preference flags (e.g. opt out of live position
 * broadcasting). Keyed on the Minecraft UUID so we can write to it from the
 * plugin (which only knows UUIDs) and read it from the website.
 */
export const playerPrivacy = pgTable("player_privacy", {
	minecraftUUID: uuid("minecraft_uuid").primaryKey(),
	hideOnMap: boolean("hide_on_map").default(false).notNull(),
	updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

/**
 * Latest known position of an online player. Rows are upserted by the plugin
 * on every position tick. `lastSeenAt` lets the website filter out stale rows
 * once a player goes offline.
 */
export const playerPosition = pgTable("player_positions", {
	minecraftUUID: uuid("minecraft_uuid").primaryKey(),
	username: varchar("username", { length: 32 }).notNull(),
	serverKey: varchar("server_key", { length: 64 }).notNull(),
	x: numeric("x").notNull(),
	y: numeric("y").notNull(),
	z: numeric("z").notNull(),
	yaw: numeric("yaw").default('0').notNull(),
	world: varchar("world", { length: 64 }).notNull().default("world"),
	lat: numeric("lat"),
	lng: numeric("lng"),
	lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
}, (table) => [
	index("player_positions_server_last_seen_idx").on(table.serverKey, table.lastSeenAt),
	index("player_positions_last_seen_idx").on(table.lastSeenAt),
]);

export const teleportStatus = pgEnum('teleport_status', ['pending', 'delivered', 'failed', 'expired']);

/**
 * Teleport requests created by website users. The plugin polls
 * /api/mc/teleports/pending, executes them, and marks them delivered.
 */
/**
 * Teleport requests are broadcast to every plugin instance — the network's
 * proxy + plugin-channel handles cross-server routing. The first plugin that
 * has the player online (or successfully forwards via plugin message) acks
 * the row, after which subsequent acks become no-ops because the status is
 * no longer `pending`.
 */
export const teleportRequest = pgTable("teleport_requests", {
	id: uuid().primaryKey().defaultRandom(),
	minecraftUUID: uuid("minecraft_uuid").notNull(),
	regionId: uuid("region_id"),
	x: numeric("x").notNull(),
	y: numeric("y"),
	z: numeric("z").notNull(),
	world: varchar("world", { length: 64 }).notNull().default("world"),
	status: teleportStatus().default('pending').notNull(),
	/** Server that ultimately delivered the teleport (null until claimed). */
	deliveredByServerKey: varchar("delivered_by_server_key", { length: 64 }),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	deliveredAt: timestamp("delivered_at"),
	error: text("error"),
}, (table) => [
	index("teleport_requests_status_idx").on(table.status),
]);

