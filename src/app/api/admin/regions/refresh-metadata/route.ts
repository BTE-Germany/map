import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { fetchLandUseStats } from "@/lib/landuse";
import { getErrorMessage } from "@/lib/errors";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";

const bodySchema = z.object({ mode: z.enum(["all", "missing"]) });

// Process a few regions at once. Overpass instances have limited query slots,
// so too much concurrency makes the gateway return 504s — keep this modest and
// let it be tuned per-instance. Each landuse fetch already retries transient
// 504/502/503/429 errors with backoff (see lib/overpass.ts).
const REFRESH_CONCURRENCY = Math.max(
    1,
    Number(process.env.METADATA_REFRESH_CONCURRENCY) || 2,
);

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

    let mode: "all" | "missing";
    try {
        ({ mode } = bodySchema.parse(await request.json()));
    } catch {
        return new Response("Invalid body", { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const rows = mode === "missing"
                    ? await db?.select({ id: region.id, city: region.city, polygon: region.polygon }).from(region).where(isNull(region.landuse)) ?? []
                    : await db?.select({ id: region.id, city: region.city, polygon: region.polygon }).from(region) ?? [];

                const total = rows.length;
                controller.enqueue(encoder.encode(sse({ type: "start", total })));

                let done = 0;
                let errors = 0;
                let next = 0;

                // Bounded worker pool: each worker pulls the next region until the
                // queue is drained. Landuse is computed independently per region,
                // so concurrency does not change any result; the in-flight Overpass
                // requests are capped at REFRESH_CONCURRENCY instead of a per-item
                // sleep. `done`/`errors` mutations are safe (single-threaded JS).
                const worker = async () => {
                    while (true) {
                        const i = next++;
                        if (i >= rows.length) return;
                        const r = rows[i];
                        try {
                            const landuse = await fetchLandUseStats(r.polygon as [number, number][]);
                            await db?.update(region).set({ landuse }).where(eq(region.id, r.id));
                            done++;
                            controller.enqueue(encoder.encode(sse({ type: "progress", done, total, city: r.city, success: true })));
                        } catch (err) {
                            done++;
                            errors++;
                            // Log the real cause server-side; send only a generic message to the client.
                            console.error(`[refresh-metadata] failed for region ${r.id} (${r.city}):`, getErrorMessage(err));
                            controller.enqueue(encoder.encode(sse({ type: "progress", done, total, city: r.city, success: false, error: "Verarbeitung fehlgeschlagen" })));
                        }
                    }
                };

                await Promise.all(
                    Array.from({ length: Math.min(REFRESH_CONCURRENCY, rows.length) }, () => worker()),
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
