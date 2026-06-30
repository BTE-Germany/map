import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function readRuntimeEnv(name: string): string | undefined {
    return process.env[name];
}

export async function GET() {
    return NextResponse.json(
        {
            mapboxAccessToken:
                readRuntimeEnv("MAPBOX_ACCESS_TOKEN") ??
                readRuntimeEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN") ??
                "",
            googleMapsApiKey:
                readRuntimeEnv("GOOGLE_MAPS_BROWSER_API_KEY") ??
                readRuntimeEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY") ??
                "",
        },
        {
            headers: {
                "Cache-Control": "no-store",
            },
        },
    );
}
