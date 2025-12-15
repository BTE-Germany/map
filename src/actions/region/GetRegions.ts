"use server"

import {region} from "@/db/schema";
import db from "@/db/drizzle";
import {eq} from "drizzle-orm";

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
                    "id": region.id
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