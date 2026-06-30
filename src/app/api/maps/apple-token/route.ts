import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
    // The MapKit JS token is delivered to the browser by design, but the
    // Look Around feature is gated behind a permission, so gate the token too.
    const session = await getSession();
    if (!session?.user || !hasPermission(session.user.realm_access?.roles ?? [], PERMISSIONS.MAP_STREET_LEVEL_VIEW)) {
        return new Response("Forbidden", {
            status: 403,
            headers: { "Cache-Control": "no-store" },
        });
    }

    const token = process.env.APPLE_MAPS_TOKEN;

    if (!token) {
        return new Response("APPLE_MAPS_TOKEN ist nicht konfiguriert.", {
            status: 503,
            headers: { "Cache-Control": "no-store" },
        });
    }

    return new Response(token, {
        headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
        },
    });
}
