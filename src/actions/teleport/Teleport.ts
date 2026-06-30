"use server";

import { and, eq, gt } from "drizzle-orm";
import db from "@/db/drizzle";
import { region, teleportRequest } from "@/db/schema";
import { assertUuid, requireLinkedUuid } from "@/lib/guards";
import { polygonCenterLatLng } from "@/lib/geo";

export interface TeleportResponse {
    id: string;
}

/** Reject a new teleport if the user already queued one in the last few seconds. */
async function assertNoRecentPending(uuid: string): Promise<void> {
    const since = new Date(Date.now() - 5_000);
    const recent = await db
        .select({ id: teleportRequest.id })
        .from(teleportRequest)
        .where(
            and(
                eq(teleportRequest.minecraftUUID, uuid),
                eq(teleportRequest.status, "pending"),
                gt(teleportRequest.createdAt, since),
            ),
        )
        .limit(1);
    if (recent.length > 0) {
        throw new Error("Bitte warte einen Moment, bevor du erneut teleportierst.");
    }
}

/**
 * Queue a teleport for the currently authenticated user. The request is
 * broadcast to every plugin in the network; the plugin where the player is
 * online (or whichever can reach them via the proxy plugin-channel) executes
 * and atomically claims the request via the ack endpoint.
 *
 * Coordinates: `x = lat`, `z = lng`. Plugins are expected to project these
 * to MC world coordinates via Terra++.
 */
export async function teleportToRegion(regionId: string): Promise<TeleportResponse> {
    const uuid = await requireLinkedUuid();
    assertUuid(regionId, "Region-ID");
    await assertNoRecentPending(uuid);

    const r = await db
        .select()
        .from(region)
        .where(eq(region.id, regionId))
        .limit(1)
        .then((rows) => rows[0]);
    if (!r) throw new Error("Region not found");

    const [lat, lng] = polygonCenterLatLng(r.polygon as [number, number][]);

    const inserted = await db
        .insert(teleportRequest)
        .values({
            minecraftUUID: uuid,
            regionId: r.id,
            x: lat.toString(),
            z: lng.toString(),
            world: "world",
        })
        .returning({ id: teleportRequest.id });

    return { id: inserted[0].id };
}

/**
 * Free-form teleport to an arbitrary lat/lng — used by the right-click
 * context menu on the map. `regionId` is null so the plugin knows this is a
 * coordinate teleport, not a region teleport.
 */
export async function teleportToCoordinates(lat: number, lng: number): Promise<TeleportResponse> {
    if (
        !Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
        throw new Error("Invalid coordinates");
    }
    const uuid = await requireLinkedUuid();
    await assertNoRecentPending(uuid);

    const inserted = await db
        .insert(teleportRequest)
        .values({
            minecraftUUID: uuid,
            regionId: null,
            x: lat.toString(),
            z: lng.toString(),
            world: "world",
        })
        .returning({ id: teleportRequest.id });

    return { id: inserted[0].id };
}
