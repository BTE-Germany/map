import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { findStateCode } from "@/lib/germanStates";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { eq } from "drizzle-orm";

const bodySchema = z.object({ mode: z.enum(["all", "missing"]) });

type ProgressEvent =
    | { type: "start"; total: number }
    | { type: "progress"; done: number; total: number; city: string; success: boolean; error?: string }
    | { type: "done"; done: number; total: number; errors: number };

function sse(data: ProgressEvent): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Recomputes each region's Bundesland (`state`) from a LOCAL boundary dataset
 * (see lib/germanStates) via point-in-polygon — no Overpass/Google, so it's
 * instant. Same SSE progress protocol as the metadata refresh.
 *   - "missing": only regions with no state yet (state = "")
 *   - "all":     recompute every region
 */
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
                const cols = {
                    id: region.id,
                    city: region.city,
                    state: region.state,
                    polygon: region.polygon,
                };
                const rows =
                    mode === "missing"
                        ? await db.select(cols).from(region).where(eq(region.state, ""))
                        : await db.select(cols).from(region);

                const total = rows.length;
                controller.enqueue(encoder.encode(sse({ type: "start", total })));

                let done = 0;
                let errors = 0;

                for (const r of rows) {
                    const code = findStateCode(r.polygon as [number, number][]);
                    done++;

                    if (!code) {
                        errors++;
                        controller.enqueue(encoder.encode(sse({ type: "progress", done, total, city: r.city, success: false, error: "Bundesland nicht bestimmbar" })));
                        continue;
                    }

                    if (code !== r.state) {
                        await db.update(region).set({ state: code }).where(eq(region.id, r.id));
                    }
                    controller.enqueue(encoder.encode(sse({ type: "progress", done, total, city: `${r.city} → ${code}`, success: true })));
                }

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
