import { sql } from "drizzle-orm"
import {boolean, integer, json, numeric, pgEnum, pgTable, text, timestamp, uuid, varchar} from "drizzle-orm/pg-core";

export const regionType = pgEnum('region_type', ['default', 'plot', 'event']);

export const region = pgTable("regions", {
	id: uuid().primaryKey().defaultRandom(),
	description: text().default(''),
	creatorUUID: uuid().notNull(),
	polygon: json().$type<[number, number][]>().notNull(),
	city: varchar({ length: 265 }).notNull(),
	area: numeric().notNull(),
    buildings: integer().default(0).notNull(),
	createdAt: timestamp().defaultNow(),
    modifiedAt: timestamp().defaultNow().$onUpdate(() => new Date()).notNull(),
    type: regionType().default('default').notNull(),
    address: text().default('').notNull(),
    finished: boolean().default(false).notNull()
});

