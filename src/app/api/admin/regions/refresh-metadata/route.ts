import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { fetchLandUseElements, computeLandUseStats, unionPaddedBbox } from "@/lib/landuse";
import { getErrorMessage } from "@/lib/errors";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { eq, isNull, lt, or } from "drizzle-orm";

const bodySchema = z.object({ mode: z.enum(["all", "missing", "stale"]) });


const REFRESH_CONCURRENCY = Math.max(
    1,
    Number(process.env.METADATA_REFRESH_CONCURRENCY) || 4,
);

// Regions are grouped into grid cells (~degrees) so ONE Overpass query serves a
// whole cluster instead of one query per region; each region is then clipped
// locally from the shared element set (identical result, far fewer round-trips).
const CLUSTER_GRID_DEG = Math.max(0.005, Number(process.env.METADATA_REFRESH_GRID_DEG) || 0.05);

// "stale" mode recomputes regions whose landuse is older than this (or never set).
const STALE_AFTER_MS = Math.max(1, Number(process.env.METADATA_STALE_DAYS) || 30) * 24 * 60 * 60_000;

function clusterKey(polygon: [number, number][]): string {
    let lat = 0, lng = 0;
    for (const [a, b] of polygon) { lat += a; lng += b; }
    lat /= polygon.length;
    lng /= polygon.length;
    return `${Math.floor(lat / CLUSTER_GRID_DEG)}:${Math.floor(lng / CLUSTER_GRID_DEG)}`;
}

type ProgressEvent =
    | { type: "start"; total: number }
    | { type: "progress"; done: number; total: number; city: string; success: boolean; error?: string }
    | { type: "done"; done: number; total: number; errors: number };

function sse(data: ProgressEvent): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session || !hasPermission(session.user.realm_access?.roles ?? [], PERMISSIONS.REGIONS_REFRESH_METADATA)) {
        return new Response("Forbidden", { status: 403 });
    }

    let mode: "all" | "missing" | "stale";
    try {
        ({ mode } = bodySchema.parse(await request.json()));
    } catch {
        return new Response("Invalid body", { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const base = () =>
                    db.select({ id: region.id, city: region.city, polygon: region.polygon }).from(region);
                const staleCutoff = new Date(Date.now() - STALE_AFTER_MS);
                const rows =
                    mode === "missing"
                        ? await base().where(isNull(region.landuse))
                        : mode === "stale"
                            ? await base().where(or(isNull(region.landuseUpdatedAt), lt(region.landuseUpdatedAt, staleCutoff)))
                            : await base();

                const total = rows.length;
                controller.enqueue(encoder.encode(sse({ type: "start", total })));

                // Group nearby regions so one Overpass query serves the whole cluster.
                const clusters = new Map<string, typeof rows>();
                for (const r of rows) {
                    const key = clusterKey(r.polygon);
                    const bucket = clusters.get(key);
                    if (bucket) bucket.push(r);
                    else clusters.set(key, [r]);
                }
                const clusterList = [...clusters.values()];

                let done = 0;
                let errors = 0;
                let nextCluster = 0;

                // Bounded worker pool over CLUSTERS — caps concurrent Overpass
                // fetches at REFRESH_CONCURRENCY. Per-region clipping is local CPU,
                // so concurrency never changes a result. `done`/`errors` mutations
                // are safe (single-threaded JS).
                const worker = async () => {
                    while (true) {
                        const ci = nextCluster++;
                        if (ci >= clusterList.length) return;
                        const members = clusterList[ci];

                        let elements;
                        try {
                            elements = await fetchLandUseElements(unionPaddedBbox(members.map((m) => m.polygon)));
                        } catch (err) {
                            console.error(`[refresh-metadata] cluster fetch failed (${members.length} regions):`, getErrorMessage(err));
                            for (const r of members) {
                                done++;
                                errors++;
                                controller.enqueue(encoder.encode(sse({ type: "progress", done, total, city: r.city, success: false, error: "Verarbeitung fehlgeschlagen" })));
                            }
                            continue;
                        }

                        for (const r of members) {
                            try {
                                const landuse = computeLandUseStats(r.polygon, elements);
                                await db.update(region).set({ landuse, landuseUpdatedAt: new Date() }).where(eq(region.id, r.id));
                                done++;
                                controller.enqueue(encoder.encode(sse({ type: "progress", done, total, city: r.city, success: true })));
                            } catch (err) {
                                done++;
                                errors++;
                                console.error(`[refresh-metadata] failed for region ${r.id} (${r.city}):`, getErrorMessage(err));
                                controller.enqueue(encoder.encode(sse({ type: "progress", done, total, city: r.city, success: false, error: "Verarbeitung fehlgeschlagen" })));
                            }
                        }
                    }
                };

                await Promise.all(
                    Array.from({ length: Math.min(REFRESH_CONCURRENCY, clusterList.length) }, () => worker()),
                );

                controller.enqueue(encoder.encode(sse({ type: "done", done, total, errors })));
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
