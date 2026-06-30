import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, lt } from "drizzle-orm";
import db from "@/db/drizzle";
import { teleportRequest } from "@/db/schema";
import { requireMcAuth, type McAuthContext } from "@/lib/mcAuth";

export const runtime = "nodejs";

async function authOrThrow(req: NextRequest): Promise<McAuthContext | NextResponse> {
    try {
        return await requireMcAuth(req);
    } catch (res) {
        if (res instanceof Response) return res as NextResponse;
        throw res;
    }
}

/**
 * GET — return ALL pending teleport requests. Every plugin polls this; the
 * one with the player online (locally or reachable via plugin-channel to the
 * proxy) executes and acks. The atomic update on ack ensures only one
 * server can mark a given teleport as delivered.
 */
export async function GET(req: NextRequest) {
    const auth = await authOrThrow(req);
    if (auth instanceof NextResponse) return auth;

    // Auto-expire requests older than 60s.
    const expiryCutoff = new Date(Date.now() - 60_000);
    await db!
        .update(teleportRequest)
        .set({ status: "expired" })
        .where(
            and(
                eq(teleportRequest.status, "pending"),
                lt(teleportRequest.createdAt, expiryCutoff),
            ),
        );

    const rows = await db!
        .select()
        .from(teleportRequest)
        .where(eq(teleportRequest.status, "pending"))
        .limit(200);

    return NextResponse.json({
        teleports: rows.map((r) => ({
            id: r.id,
            uuid: r.minecraftUUID,
            regionId: r.regionId,
            x: Number(r.x),
            y: r.y === null ? null : Number(r.y),
            z: Number(r.z),
            world: r.world,
            createdAt: r.createdAt.toISOString(),
        })),
    });
}

const AckBody = z.object({
    ack: z
        .array(
            z.object({
                id: z.string().uuid(),
                status: z.enum(["delivered", "failed"]),
                error: z.string().max(512).optional(),
            }),
        )
        .min(1)
        .max(200),
});

/**
 * POST — plugin acks one or more teleport requests. The status update is
 * conditional on `status = 'pending'` so the first plugin to respond wins
 * and any duplicate acks from other servers become no-ops.
 *
 * Response includes `claimed: [...ids]` so a plugin knows which teleports
 * IT actually delivered (vs which were already claimed by another server).
 */
export async function POST(req: NextRequest) {
    const auth = await authOrThrow(req);
    if (auth instanceof NextResponse) return auth;

    let parsed: z.infer<typeof AckBody>;
    try {
        parsed = AckBody.parse(await req.json());
    } catch {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const now = new Date();
    const claimed: string[] = [];

    for (const a of parsed.ack) {
        const updated = await db!
            .update(teleportRequest)
            .set({
                status: a.status,
                deliveredAt: now,
                deliveredByServerKey: auth.serverKey,
                error: a.status === "failed" ? a.error ?? null : null,
            })
            .where(
                and(
                    eq(teleportRequest.id, a.id),
                    eq(teleportRequest.status, "pending"),
                ),
            )
            .returning({ id: teleportRequest.id });

        if (updated.length > 0) claimed.push(updated[0].id);
    }

    return NextResponse.json({ ok: true, claimed });
}
