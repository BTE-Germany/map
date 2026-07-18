"use server";

import { desc, eq, or, sql } from "drizzle-orm";

import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { normalizeMinecraftUuid } from "@/lib/minecraftUuid";

export async function getRegionsByBuilder(builderUuid: string) {
    const normalizedUuid = normalizeMinecraftUuid(builderUuid);
    if (!normalizedUuid) return [];

    return db!
        .select({
            id: region.id,
            creatorUUID: region.creatorUUID,
            builders: region.builders,
            polygon: region.polygon,
            city: region.city,
            state: region.state,
            area: region.area,
            buildings: region.buildings,
            landuse: region.landuse,
            createdAt: region.createdAt,
            modifiedAt: region.modifiedAt,
            type: region.type,
            address: region.address,
            finished: region.finished,
        })
        .from(region)
        .where(
            or(
                eq(region.creatorUUID, normalizedUuid),
                sql<boolean>`coalesce(${region.builders}, '[]'::json)::jsonb @> ${JSON.stringify([normalizedUuid])}::jsonb`,
            ),
        )
        .orderBy(desc(region.modifiedAt), desc(region.createdAt));
}

export type BuilderRegion = Awaited<ReturnType<typeof getRegionsByBuilder>>[number];
