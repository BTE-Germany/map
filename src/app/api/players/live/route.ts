import { NextResponse } from "next/server";
import { and, gte, eq, notInArray } from "drizzle-orm";
import db from "@/db/drizzle";
import { playerPosition, playerPrivacy } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the latest known positions of all online players except those who
 * have opted out via the privacy settings. Stale rows (last_seen > 90s ago)
 * are dropped.
 */
export async function GET() {
    const cutoff = new Date(Date.now() - 90_000);

    const hidden = await db!
        .select({ uuid: playerPrivacy.minecraftUUID })
        .from(playerPrivacy)
        .where(eq(playerPrivacy.hideOnMap, true));
    const hiddenIds = hidden.map((r) => r.uuid);

    const where =
        hiddenIds.length > 0
            ? and(
                  gte(playerPosition.lastSeenAt, cutoff),
                  notInArray(playerPosition.minecraftUUID, hiddenIds),
              )
            : gte(playerPosition.lastSeenAt, cutoff);

    const rows = await db!.select().from(playerPosition).where(where);

    return NextResponse.json({
        players: rows.map((r) => ({
            uuid: r.minecraftUUID,
            username: r.username,
            serverKey: r.serverKey,
            world: r.world,
            x: Number(r.x),
            y: Number(r.y),
            z: Number(r.z),
            yaw: Number(r.yaw),
            lat: r.lat === null ? null : Number(r.lat),
            lng: r.lng === null ? null : Number(r.lng),
            lastSeenAt: r.lastSeenAt.toISOString(),
        })),
    });
}
