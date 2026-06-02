import { NextRequest } from "next/server";
import { and, gte, eq, notInArray } from "drizzle-orm";
import db from "@/db/drizzle";
import { playerPosition, playerPrivacy } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events feed of currently online players. Clients connect once
 * and the server pushes a fresh snapshot every ~2 s.
 *
 * Wire format:
 *   event: snapshot
 *   data: {"players":[ ... same shape as /api/players/live ... ]}
 *
 *   : ping       (keep-alive comment, every ~20s)
 *
 * The endpoint stays open until the client disconnects.
 */
const TICK_MS = 2_000;
const KEEPALIVE_MS = 20_000;
const STALE_MS = 90_000;

async function snapshot(): Promise<unknown> {
    const cutoff = new Date(Date.now() - STALE_MS);
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

    return {
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
    };
}

export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();

    let tickTimer: ReturnType<typeof setInterval> | null = null;
    let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream({
        async start(controller) {
            let closed = false;
            const safeEnqueue = (chunk: string) => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(chunk));
                } catch {
                    closed = true;
                    cleanup();
                }
            };

            const cleanup = () => {
                if (tickTimer) clearInterval(tickTimer);
                if (keepaliveTimer) clearInterval(keepaliveTimer);
                tickTimer = null;
                keepaliveTimer = null;
            };

            // Suggest reconnect delay to the browser's EventSource.
            safeEnqueue("retry: 5000\n\n");

            // First snapshot immediately so the client sees something.
            try {
                const first = await snapshot();
                safeEnqueue(`event: snapshot\ndata: ${JSON.stringify(first)}\n\n`);
            } catch {
                // ignore — we'll retry on the next tick
            }

            tickTimer = setInterval(async () => {
                try {
                    const snap = await snapshot();
                    safeEnqueue(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`);
                } catch (e) {
                    // Send a comment so the connection stays alive even on transient errors.
                    safeEnqueue(`: error ${(e as Error)?.message ?? "unknown"}\n\n`);
                }
            }, TICK_MS);

            keepaliveTimer = setInterval(() => {
                safeEnqueue(`: ping\n\n`);
            }, KEEPALIVE_MS);

            req.signal.addEventListener("abort", () => {
                closed = true;
                cleanup();
                try {
                    controller.close();
                } catch {
                    // already closed
                }
            });
        },
        cancel() {
            if (tickTimer) clearInterval(tickTimer);
            if (keepaliveTimer) clearInterval(keepaliveTimer);
        },
    });

    return new Response(stream, {
        headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            "connection": "keep-alive",
            // Avoid nginx buffering swallowing the stream.
            "x-accel-buffering": "no",
        },
    });
}
