DO $$ BEGIN
	CREATE TYPE "region_type" AS ENUM ('default', 'plot', 'event');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "teleport_status" AS ENUM ('pending', 'delivered', 'failed', 'expired');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" text DEFAULT '',
	"creatorUUID" uuid NOT NULL,
	"polygon" json NOT NULL,
	"city" varchar(265) NOT NULL,
	"state" varchar(2) DEFAULT '' NOT NULL,
	"area" numeric NOT NULL,
	"buildings" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"modifiedAt" timestamp DEFAULT now() NOT NULL,
	"type" "region_type" DEFAULT 'default' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"finished" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "regions" ADD COLUMN IF NOT EXISTS "landuse" json;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mc_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL UNIQUE,
	"name" varchar(128) NOT NULL,
	"states" json DEFAULT '[]'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_privacy" (
	"minecraft_uuid" uuid PRIMARY KEY NOT NULL,
	"hide_on_map" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_positions" (
	"minecraft_uuid" uuid PRIMARY KEY NOT NULL,
	"username" varchar(32) NOT NULL,
	"server_key" varchar(64) NOT NULL,
	"x" numeric NOT NULL,
	"y" numeric NOT NULL,
	"z" numeric NOT NULL,
	"yaw" numeric DEFAULT '0' NOT NULL,
	"world" varchar(64) DEFAULT 'world' NOT NULL,
	"lat" numeric,
	"lng" numeric,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teleport_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"minecraft_uuid" uuid NOT NULL,
	"region_id" uuid,
	"x" numeric NOT NULL,
	"y" numeric,
	"z" numeric NOT NULL,
	"world" varchar(64) DEFAULT 'world' NOT NULL,
	"status" "teleport_status" DEFAULT 'pending' NOT NULL,
	"delivered_by_server_key" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"error" text
);
