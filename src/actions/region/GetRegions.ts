"use server"

import { region } from "@/db/schema";
import db from "@/db/drizzle";
import { and, count, desc, eq, isNotNull, isNull, sum } from "drizzle-orm";
import type { FeatureCollection, Polygon } from "geojson";

type RegionGeoJSON = FeatureCollection<Polygon, { id: string; finished: boolean }>;

export async function getAllRegions() {
    return db?.select().from(region);
}

export async function getAllRegionsAsGeoJSON() {
    const regions = await getAllRegions();
    return {
        "type": "FeatureCollection",
        "features": regions?.map((region) => {
            return {
                "type": "Feature",
                "properties": {
                    "id": region.id,
                    "type": region.type,
                    "finished": region.finished,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [region.polygon.map(e => [e[1], e[0]]) as [number, number][]]
                }
            }
        })
    }
}

export async function getRegion(regionId: string) {
    return db?.select().from(region).where(eq(region.id, regionId)).limit(1).then(res => res[0]);
}

export async function getRegionCountByCreator(creatorUUID: string, filterFinished: boolean | null = null) {
    const query = db?.select({ count: count() }).from(region).where(and(eq(region.creatorUUID, creatorUUID), filterFinished !== null ? eq(region.finished, filterFinished) : undefined));

    return query.then(res => res[0].count);
}

export async function getRegionTotalSizeByCreator(creatorUUID: string, filterFinished: boolean | null = null) {
    const query = db?.select({ area: sum(region.area) }).from(region).where(and(eq(region.creatorUUID, creatorUUID), filterFinished !== null ? eq(region.finished, filterFinished) : undefined));

    return query.then(res => {
        const area = res[0].area;
        console.log(res);
        return area ? parseFloat(area.toString()) : 0;
    });
}

export async function getMostPopularStateByCreator(creatorUUID: string, filterFinished: boolean | null = null) {

    // fetch the state with the largest total count of regions (finished or not, depending on filterFinished) for the given creatorUUID

    const query = db?.select({ state: region.state, totalArea: sum(region.area) })
        .from(region)
        .where(and(eq(region.creatorUUID, creatorUUID), filterFinished !== null ? eq(region.finished, filterFinished) : undefined))
        .groupBy(region.state)
        .orderBy(desc(sum(region.area)))
        .limit(1);
    return query?.then(res => {
        const state = res?.[0]?.state;
        return state || null;
    });
}

export async function getRegionsByCreator(creatorUUID: string) {
    return db?.select().from(region)
        .where(eq(region.creatorUUID, creatorUUID))
        .orderBy(desc(region.createdAt));
}

export async function getRegionsByCreatorAsGeoJSON(creatorUUID: string): Promise<RegionGeoJSON> {
    const regions = await getRegionsByCreator(creatorUUID);
    return {
        type: "FeatureCollection",
        features: regions?.map((r) => ({
            type: "Feature",
            properties: { id: r.id, finished: r.finished },
            geometry: {
                type: "Polygon",
                coordinates: [r.polygon.map(e => [e[1], e[0]]) as [number, number][]]
            }
        })) ?? []
    };
}

export async function getRegionStatsByStateByCreator(creatorUUID: string) {
    return db?.select({
        state: region.state,
        count: count(),
        totalArea: sum(region.area),
    })
        .from(region)
        .where(eq(region.creatorUUID, creatorUUID))
        .groupBy(region.state)
        .orderBy(desc(count()));
}

export async function getTotalBuildingsByCreator(creatorUUID: string) {
    return db?.select({ buildings: sum(region.buildings) })
        .from(region)
        .where(eq(region.creatorUUID, creatorUUID))
        .then(res => {
            const val = res[0]?.buildings;
            return val ? parseInt(val.toString()) : 0;
        });
}

export async function getRegionsWithoutLanduse() {
    return db?.select({
        id: region.id,
        city: region.city,
        state: region.state,
        polygon: region.polygon,
    }).from(region).where(isNull(region.landuse));
}

export async function getRegionLanduseStats() {
    const total = await db?.select({ count: count() }).from(region).then(r => r[0].count);
    const withData = await db?.select({ count: count() }).from(region)
        .where(isNotNull(region.landuse)).then(r => r[0].count);
    return { total, withData, missing: total - withData };
}
