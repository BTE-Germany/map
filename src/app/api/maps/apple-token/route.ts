export const dynamic = "force-dynamic";

export async function GET() {
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
