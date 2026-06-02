import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { fetchLandUseStats } from "@/lib/landuse";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";

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

    const { mode } = await request.json() as { mode: "all" | "missing" };

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const rows = mode === "missing"
                    ? await db?.select({ id: region.id, city: region.city, polygon: region.polygon }).from(region).where(isNull(region.landuse)) ?? []
                    : await db?.select({ id: region.id, city: region.city, polygon: region.polygon }).from(region) ?? [];

                controller.enqueue(encoder.encode(sse({ type: "start", total: rows.length })));

                let done = 0;
                let errors = 0;

                for (const r of rows) {
                    try {
                        const landuse = await fetchLandUseStats(r.polygon as [number, number][]);
                        await db?.update(region).set({ landuse }).where(eq(region.id, r.id));
                        done++;
                        controller.enqueue(encoder.encode(sse({ type: "progress", done, total: rows.length, city: r.city, success: true })));
                    } catch (err) {
                        done++;
                        errors++;
                        const msg = err instanceof Error ? err.message : String(err);
                        console.error(`[refresh-metadata] failed for region ${r.id} (${r.city}):`, err);
                        controller.enqueue(encoder.encode(sse({ type: "progress", done, total: rows.length, city: r.city, success: false, error: msg })));
                    }
                    // Small delay to avoid hammering Overpass API
                    await new Promise(res => setTimeout(res, 500));
                }

                controller.enqueue(encoder.encode(sse({ type: "done", done, total: rows.length, errors })));
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
