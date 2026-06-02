"use server";

import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { region } from "@/db/schema";
import db from "@/db/drizzle";
import { eq } from "drizzle-orm";
import { fetchLandUseStats } from "@/lib/landuse";
import { fetchBuildingCount } from "@/lib/buildings";

function closePolygon(coords: [number, number][]): [number, number][] {
    if (coords.length < 2) return coords;
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return coords;
    return [...coords, first];
}

export async function updateRegionPolygon(regionId: string, polygon: [number, number][]) {
    const session = await getSession();
    if (!session?.user) throw new Error("Not authenticated");

    const roles = (session.user as any)?.realm_access?.roles ?? [];
    const isAdmin = hasPermission(roles, PERMISSIONS.REGIONS_EDIT);

    const existing = await db
        ?.select({ creatorUUID: region.creatorUUID })
        .from(region)
        .where(eq(region.id, regionId))
        .limit(1)
        .then((r) => r[0]);

    if (!existing) throw new Error("Region not found");

    const isCreator = existing.creatorUUID === (session.user as any)?.minecraft_uuid;
    if (!isCreator && !isAdmin) throw new Error("Not authorized");

    const closed = closePolygon(polygon);

    // Save polygon immediately, clear stale landuse + buildings so the UI shows
    // "wird neu berechnet" while the background jobs run.
    await db
        ?.update(region)
        .set({ polygon: closed, landuse: null, buildings: 0 })
        .where(eq(region.id, regionId));

    // Recalculate landuse + buildings in the background — doesn't block the response
    fetchLandUseStats(closed)
        .then((landuse) => db?.update(region).set({ landuse }).where(eq(region.id, regionId)))
        .catch((err) =>
            console.error(`[updateRegionPolygon] landuse refresh failed for ${regionId}:`, err.message)
        );

    fetchBuildingCount(closed)
        .then((buildings) => db?.update(region).set({ buildings }).where(eq(region.id, regionId)))
        .catch((err) =>
            console.error(`[updateRegionPolygon] building refresh failed for ${regionId}:`, err.message)
        );

    return { success: true };
}
