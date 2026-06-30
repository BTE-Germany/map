import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as turf from "@turf/turf";
import { Language, PlaceType2 } from "@googlemaps/google-maps-services-js";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { requireMcAuth, type McAuthContext } from "@/lib/mcAuth";
import { fetchLandUseStats } from "@/lib/landuse";
import { fetchBuildingCount } from "@/lib/buildings";
import { closePolygon } from "@/lib/geo";
import { getErrorMessage } from "@/lib/errors";
import gMapsClient from "@/lib/googleMaps";

export const runtime = "nodejs";

const latLng = z.tuple([
    z.number().min(-90).max(90),
    z.number().min(-180).max(180),
]);

const bodySchema = z.object({
    polygon: z.array(latLng).min(3).max(1000),
    creatorUUID: z.uuid(),
});

const STATE_NAME_TO_CODE: Record<string, string> = {
    "Baden-Württemberg": "BW",
    "Bayern": "BY",
    "Berlin": "BE",
    "Brandenburg": "BB",
    "Bremen": "HB",
    "Hamburg": "HH",
    "Hessen": "HE",
    "Mecklenburg-Vorpommern": "MV",
    "Niedersachsen": "NI",
    "Nordrhein-Westfalen": "NW",
    "Rheinland-Pfalz": "RP",
    "Saarland": "SL",
    "Sachsen": "SN",
    "Sachsen-Anhalt": "ST",
    "Schleswig-Holstein": "SH",
    "Thüringen": "TH",
};

async function authOrThrow(req: NextRequest): Promise<McAuthContext | NextResponse> {
    try {
        return await requireMcAuth(req);
    } catch (res) {
        if (res instanceof Response) return res as NextResponse;
        throw res;
    }
}

interface GeocodedMeta {
    address: string;
    city: string;
    state: string;
}

async function geocodeCenter(polygonLatLng: [number, number][]): Promise<GeocodedMeta> {
    const turfPolygon = turf.polygon([polygonLatLng.map(([lat, lng]) => [lng, lat])]);
    const center = turf.center(turfPolygon);
    const [lng, lat] = center.geometry.coordinates as [number, number];

    try {
        const { data } = await gMapsClient.reverseGeocode({
            params: {
                key: process.env.GOOGLE_MAPS_API_KEY!,
                latlng: [lat, lng],
                language: Language.de,
            },
        });
        const components = data.results.flatMap((r) => r.address_components);
        const city = components.find((c) => c.types.includes(PlaceType2.locality))?.long_name ?? "Unbekannt";
        const stateName = components.find((c) => c.types.includes(PlaceType2.administrative_area_level_1))?.long_name ?? "";
        const state = STATE_NAME_TO_CODE[stateName] ?? "";

        const streetAddress =
            data.results.find((r) => r.types.includes(PlaceType2.street_address)) ??
            data.results.find((r) => r.types.includes(PlaceType2.plus_code));

        return {
            address: streetAddress?.formatted_address ?? "",
            city,
            state,
        };
    } catch (err: unknown) {
        console.error("[region] reverse geocode failed:", getErrorMessage(err));
        return { address: "", city: "Unbekannt", state: "" };
    }
}

/**
 * Create a region from a polygon supplied by an authenticated Minecraft
 * plugin. The plugin sends only the geometry and the player's UUID — every
 * other field (city, state, address, area, buildings, landuse) is filled in
 * server-side via reverse geocoding and Overpass, so command UX stays a
 * single `/maparea create` with no arguments.
 */
export async function POST(req: NextRequest) {
    const auth = await authOrThrow(req);
    if (auth instanceof NextResponse) return auth;

    let parsed: z.infer<typeof bodySchema>;
    try {
        parsed = bodySchema.parse(await req.json());
    } catch (e: unknown) {
        console.error("[region] invalid body:", getErrorMessage(e));
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const polygon = closePolygon(parsed.polygon as [number, number][]);
    const turfPolygon = turf.polygon([polygon.map(([lat, lng]) => [lng, lat])]);
    const area = turf.area(turfPolygon);

    // Only the geocode (fast, ~100-300ms) blocks the plugin's response. Building
    // count and landuse are slow Overpass calls, so they run fire-and-forget and
    // backfill the row afterwards (buildings defaults to 0 in the schema).
    const meta = await geocodeCenter(polygon);

    try {
        const inserted = await db
            .insert(region)
            .values({
                polygon,
                creatorUUID: parsed.creatorUUID,
                finished: false,
                type: "default",
                address: meta.address,
                city: meta.city,
                state: meta.state,
                area: area.toFixed(2),
            })
            .returning({ id: region.id });

        const regionId = inserted[0].id;

        // Fire-and-forget; never block the plugin's response on Overpass.
        fetchBuildingCount(polygon)
            .then((buildings) => db.update(region).set({ buildings }).where(eq(region.id, regionId)))
            .catch((err) => console.error(`[region] building count failed for ${regionId}:`, getErrorMessage(err)));

        fetchLandUseStats(polygon)
            .then((landuse) => db.update(region).set({ landuse, landuseUpdatedAt: new Date() }).where(eq(region.id, regionId)))
            .catch((err) => console.error(`[region] landuse fetch failed for ${regionId}:`, getErrorMessage(err)));

        return NextResponse.json({ id: regionId }, { status: 201 });
    } catch (err) {
        console.error("[region] insert failed:", err);
        return NextResponse.json({ error: "insert failed" }, { status: 500 });
    }
}
