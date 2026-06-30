import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql, lt, eq, and } from "drizzle-orm";
import db from "@/db/drizzle";
import { playerPosition } from "@/db/schema";
import { requireMcAuth, type McAuthContext } from "@/lib/mcAuth";

export const runtime = "nodejs";

const Body = z.object({
    players: z
        .array(
            z.object({
                uuid: z.string().uuid(),
                username: z.string().min(1).max(32),
                x: z.number(),
                y: z.number(),
                z: z.number(),
                yaw: z.number().optional(),
                world: z.string().max(64).optional(),
                lat: z.number().optional(),
                lng: z.number().optional(),
            }),
        )
        .max(500),
});

async function authOrThrow(req: NextRequest): Promise<McAuthContext | NextResponse> {
    try {
        return await requireMcAuth(req);
    } catch (res) {
        if (res instanceof Response) return res as NextResponse;
        throw res;
    }
}

export async function POST(req: NextRequest) {
    const auth = await authOrThrow(req);
    if (auth instanceof NextResponse) return auth;

    let parsed: z.infer<typeof Body>;
    try {
        parsed = Body.parse(await req.json());
    } catch {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    if (parsed.players.length === 0) {
        return NextResponse.json({ ok: true, written: 0 });
    }

    const now = new Date();
    const rows = parsed.players.map((p) => ({
        minecraftUUID: p.uuid,
        username: p.username,
        serverKey: auth.serverKey,
        x: p.x.toString(),
        y: p.y.toString(),
        z: p.z.toString(),
        yaw: (p.yaw ?? 0).toString(),
        world: p.world ?? "world",
        lat: p.lat?.toString() ?? null,
        lng: p.lng?.toString() ?? null,
        lastSeenAt: now,
    }));

    // A player is online on at most one server at a time. Upserting by UUID
    // automatically migrates the row to the new server when they switch.
    await db!
        .insert(playerPosition)
        .values(rows)
        .onConflictDoUpdate({
            target: playerPosition.minecraftUUID,
            set: {
                username: sql`excluded.username`,
                serverKey: sql`excluded.server_key`,
                x: sql`excluded.x`,
                y: sql`excluded.y`,
                z: sql`excluded.z`,
                yaw: sql`excluded.yaw`,
                world: sql`excluded.world`,
                lat: sql`excluded.lat`,
                lng: sql`excluded.lng`,
                lastSeenAt: sql`excluded.last_seen_at`,
            },
        });

    // Stale cleanup, scoped to this server only — we must not touch rows
    // currently owned by another server.
    const staleCutoff = new Date(now.getTime() - 5 * 60_000);
    await db!
        .delete(playerPosition)
        .where(
            and(
                lt(playerPosition.lastSeenAt, staleCutoff),
                eq(playerPosition.serverKey, auth.serverKey),
            ),
        );

    return NextResponse.json({ ok: true, written: rows.length });
}

/**
 * Plugin notifies that a player disconnected from this specific server. We
 * only delete the row if it's still tagged with the calling server — this
 * prevents server A's late "disconnect" event from removing a player that
 * has since reconnected on server B.
 *
 *   DELETE /api/mc/positions?uuid=...
 */
export async function DELETE(req: NextRequest) {
    const auth = await authOrThrow(req);
    if (auth instanceof NextResponse) return auth;

    const uuid = req.nextUrl.searchParams.get("uuid");
    if (!uuid || !z.string().uuid().safeParse(uuid).success) {
        return NextResponse.json({ error: "valid uuid required" }, { status: 400 });
    }

    await db!
        .delete(playerPosition)
        .where(
            and(
                eq(playerPosition.minecraftUUID, uuid),
                eq(playerPosition.serverKey, auth.serverKey),
            ),
        );
    return NextResponse.json({ ok: true });
}
