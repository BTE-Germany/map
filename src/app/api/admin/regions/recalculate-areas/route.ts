import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { polygonAreaSqm } from "@/lib/geo";
import { getErrorMessage } from "@/lib/errors";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { eq } from "drizzle-orm";

const bodySchema = z.object({ mode: z.enum(["all"]) });

/** Below this the recomputed value is treated as identical (numeric(…, 2) resolution). */
const AREA_EPSILON = 0.01;

type ProgressEvent =
    | { type: "start"; total: number }
    | { type: "progress"; done: number; total: number; city: string; success: boolean; error?: string }
    | { type: "done"; done: number; total: number; errors: number; changed?: number };

function sse(data: ProgressEvent): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

const fmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/**
 * Recomputes every region's `area` from its stored polygon with turf — the same
 * calculation the create and edit paths use (lib/geo), so it's purely local and
 * needs no external API.
 *
 * Exists to repair rows written before the polygon editor recalculated the area:
 * those kept the size of whatever shape the region had when it was created.
 *
 * Rows whose value already matches are skipped, and `modifiedAt` is written back
 * unchanged on the ones that don't — a data repair is not a user edit, and
 * "Geändert am" also drives the sort order of the builder and city listings.
 *
 * The numeric area is not part of the BTE claim payload (upstream `area` is the
 * polygon ring, see lib/bte/mapping), so no re-sync is scheduled.
 */
export async function POST(request: Request) {
    const session = await getSession();
    if (!session || !hasPermission(session.user.realm_access?.roles ?? [], PERMISSIONS.REGIONS_REFRESH_METADATA)) {
        return new Response("Forbidden", { status: 403 });
    }

    try {
        bodySchema.parse(await request.json());
    } catch {
        return new Response("Invalid body", { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const rows = await db
                    .select({
                        id: region.id,
                        city: region.city,
                        area: region.area,
                        polygon: region.polygon,
                        modifiedAt: region.modifiedAt,
                    })
                    .from(region);

                const total = rows.length;
                controller.enqueue(encoder.encode(sse({ type: "start", total })));

                let done = 0;
                let errors = 0;
                let changed = 0;

                for (const r of rows) {
                    done++;
                    try {
                        const before = Number(r.area);
                        const after = polygonAreaSqm(r.polygon);

                        if (!Number.isFinite(after)) {
                            throw new Error("Fläche nicht berechenbar");
                        }

                        if (Number.isFinite(before) && Math.abs(after - before) < AREA_EPSILON) {
                            controller.enqueue(encoder.encode(sse({ type: "progress", done, total, city: `${r.city} — unverändert`, success: true })));
                            continue;
                        }

                        await db
                            .update(region)
                            .set({ area: after.toFixed(2), modifiedAt: r.modifiedAt })
                            .where(eq(region.id, r.id));

                        changed++;
                        const from = Number.isFinite(before) ? `${fmt.format(before)} m²` : "—";
                        controller.enqueue(encoder.encode(sse({ type: "progress", done, total, city: `${r.city}: ${from} → ${fmt.format(after)} m²`, success: true })));
                    } catch (err) {
                        errors++;
                        console.error(`[recalculate-areas] failed for region ${r.id} (${r.city}):`, getErrorMessage(err));
                        controller.enqueue(encoder.encode(sse({ type: "progress", done, total, city: r.city, success: false, error: "Berechnung fehlgeschlagen" })));
                    }
                }

                controller.enqueue(encoder.encode(sse({ type: "done", done, total, errors, changed })));
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
