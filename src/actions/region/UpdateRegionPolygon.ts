"use server";

import { region } from "@/db/schema";
import db from "@/db/drizzle";
import { eq } from "drizzle-orm";
import { fetchLandUseStats } from "@/lib/landuse";
import { fetchBuildingCount } from "@/lib/buildings";
import { closePolygon } from "@/lib/geo";
import { requireRegionAccess } from "@/lib/guards";
import { PERMISSIONS } from "@/lib/permissions";

const MAX_POLYGON_POINTS = 1000;

/** Rejects polygons with out-of-range or non-finite coordinates. */
function assertValidPolygon(polygon: [number, number][]): void {
    if (polygon.length < 3 || polygon.length > MAX_POLYGON_POINTS) {
        throw new Error("Ungültiges Polygon.");
    }
    for (const [lat, lng] of polygon) {
        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            lat < -90 || lat > 90 ||
            lng < -180 || lng > 180
        ) {
            throw new Error("Ungültige Koordinaten im Polygon.");
        }
    }
}

export async function updateRegionPolygon(regionId: string, polygon: [number, number][]) {
    await requireRegionAccess(regionId, PERMISSIONS.REGIONS_EDIT);
    assertValidPolygon(polygon);

    const closed = closePolygon(polygon);

    // Save polygon immediately, clear stale landuse + buildings so the UI shows
    // "wird neu berechnet" while the background jobs run.
    await db
        .update(region)
        .set({ polygon: closed, landuse: null, buildings: 0 })
        .where(eq(region.id, regionId));

    // Only apply a background recalculation if the polygon still matches the
    // one we just stored — otherwise a slower recalculation from an earlier
    // edit could clobber a newer polygon.
    const applyIfUnchanged = async (set: Partial<typeof region.$inferInsert>) => {
        const current = await db
            .select({ polygon: region.polygon })
            .from(region)
            .where(eq(region.id, regionId))
            .limit(1)
            .then((r) => r[0]);
        if (current && JSON.stringify(current.polygon) === JSON.stringify(closed)) {
            await db.update(region).set(set).where(eq(region.id, regionId));
        }
    };

    // Recalculate landuse + buildings in the background — doesn't block the response.
    fetchLandUseStats(closed)
        .then((landuse) => applyIfUnchanged({ landuse }))
        .catch((err) =>
            console.error(`[updateRegionPolygon] landuse refresh failed for ${regionId}:`, err.message),
        );

    fetchBuildingCount(closed)
        .then((buildings) => applyIfUnchanged({ buildings }))
        .catch((err) =>
            console.error(`[updateRegionPolygon] building refresh failed for ${regionId}:`, err.message),
        );

    return { success: true };
}
