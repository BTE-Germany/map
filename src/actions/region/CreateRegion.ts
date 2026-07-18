"use server";

import * as turf from "@turf/turf";
import { eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { assertUuid, requirePermission } from "@/lib/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { closePolygon } from "@/lib/geo";
import { geocodeRegionCenter } from "@/lib/regionGeocode";
import { fetchBuildingCount } from "@/lib/buildings";
import { fetchLandUseStats } from "@/lib/landuse";
import { getErrorMessage } from "@/lib/errors";

export interface CreateRegionInput {
    /** Polygon vertices in the DB format `[lat, lng][]`. */
    polygon: [number, number][];
    creatorUUID: string;
    type: "default" | "plot" | "event";
    finished: boolean;
}

const MAX_POLYGON_POINTS = 1000;

function isValidLatLng(point: unknown): point is [number, number] {
    return (
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === "number" &&
        typeof point[1] === "number" &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]) &&
        point[0] >= -90 &&
        point[0] <= 90 &&
        point[1] >= -180 &&
        point[1] <= 180
    );
}

/**
 * Create a region from the admin panel. Mirrors the plugin's POST /api/region
 * flow: the caller supplies only the geometry, creator, type and status —
 * city, state, address and area are derived server-side via reverse geocoding
 * and turf, while the slow Overpass calls (buildings, landuse) run
 * fire-and-forget and backfill the row afterwards.
 *
 * Requires the REGIONS_EDIT permission (the same guard the edit/transfer/delete
 * admin actions use).
 */
export async function createRegionByAdmin(input: CreateRegionInput): Promise<{ id: string }> {
    await requirePermission(PERMISSIONS.REGIONS_EDIT);

    const creatorUUID = assertUuid(input.creatorUUID, "Creator-UUID");

    if (!Array.isArray(input.polygon) || input.polygon.length < 3) {
        throw new Error("Das Polygon muss mindestens 3 Punkte haben.");
    }
    if (input.polygon.length > MAX_POLYGON_POINTS) {
        throw new Error(`Das Polygon darf höchstens ${MAX_POLYGON_POINTS} Punkte haben.`);
    }
    if (!input.polygon.every(isValidLatLng)) {
        throw new Error("Ungültige Polygon-Koordinaten.");
    }
    if (!["default", "plot", "event"].includes(input.type)) {
        throw new Error("Ungültiger Regionstyp.");
    }

    const polygon = closePolygon(input.polygon);
    const turfPolygon = turf.polygon([polygon.map(([lat, lng]) => [lng, lat])]);
    const area = turf.area(turfPolygon);

    // Only the geocode (fast) blocks the response. Building count and landuse
    // are slow Overpass calls, so they backfill the row afterwards.
    const meta = await geocodeRegionCenter(polygon);

    const inserted = await db
        .insert(region)
        .values({
            polygon,
            creatorUUID,
            finished: input.finished,
            type: input.type,
            address: meta.address,
            city: meta.city,
            state: meta.state,
            area: area.toFixed(2),
        })
        .returning({ id: region.id });

    const regionId = inserted[0].id;

    // Fire-and-forget; never block the response on Overpass.
    fetchBuildingCount(polygon)
        .then((buildings) => db.update(region).set({ buildings }).where(eq(region.id, regionId)))
        .catch((err) => console.error(`[createRegionByAdmin] building count failed for ${regionId}:`, getErrorMessage(err)));

    fetchLandUseStats(polygon)
        .then((landuse) => db.update(region).set({ landuse, landuseUpdatedAt: new Date() }).where(eq(region.id, regionId)))
        .catch((err) => console.error(`[createRegionByAdmin] landuse fetch failed for ${regionId}:`, getErrorMessage(err)));

    return { id: regionId };
}
