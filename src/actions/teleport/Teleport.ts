"use server";

import { eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { region, teleportRequest } from "@/db/schema";
import { getSession } from "@/lib/auth";

function polygonCenterLatLng(polygon: [number, number][]): [number, number] {
    let lat = 0;
    let lng = 0;
    for (const [a, b] of polygon) {
        lat += a;
        lng += b;
    }
    return [lat / polygon.length, lng / polygon.length];
}

async function authedUuid(): Promise<string> {
    const session = await getSession();
    const uuid = (session?.user as any)?.minecraft_uuid as string | undefined;
    if (!uuid) throw new Error("Not authenticated or no Minecraft account linked");
    return uuid;
}

export interface TeleportResponse {
    id: string;
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
    const uuid = await authedUuid();

    const r = await db!
        .select()
        .from(region)
        .where(eq(region.id, regionId))
        .limit(1)
        .then((rows) => rows[0]);
    if (!r) throw new Error("Region not found");

    const [lat, lng] = polygonCenterLatLng(r.polygon as [number, number][]);

    const inserted = await db!
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
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Invalid coordinates");
    const uuid = await authedUuid();

    const inserted = await db!
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
