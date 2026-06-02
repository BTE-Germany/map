import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as turf from "@turf/turf";
import axios from "axios";
import { Language, PlaceType2 } from "@googlemaps/google-maps-services-js";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { requireMcAuth, type McAuthContext } from "@/lib/mcAuth";
import { fetchLandUseStats } from "@/lib/landuse";
import gMapsClient from "@/lib/googleMaps";

export const runtime = "nodejs";

const bodySchema = z.object({
    polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
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

function closePolygon(coords: [number, number][]): [number, number][] {
    if (coords.length < 2) return coords;
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return coords;
    return [...coords, first];
}

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
    } catch (err: any) {
        console.error("[region] reverse geocode failed:", err?.message);
        return { address: "", city: "Unbekannt", state: "" };
    }
}

async function countBuildings(polygonLatLng: [number, number][]): Promise<number> {
    const poly = polygonLatLng.map((coord) => coord.join(" ")).join(" ");
    const query = `[out:json][timeout:25];
(
  node["building"]["building"!~"grandstand"]["building"!~"roof"](poly:"${poly}");
  way["building"]["building"!~"grandstand"]["building"!~"roof"](poly:"${poly}");
  relation["building"]["building"!~"grandstand"]["building"!~"roof"](poly:"${poly}");
);
out count;`;

    try {
        const res = await axios.post(
            process.env.OVERPASS_API_URL!,
            `data=${encodeURIComponent(query)}`,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    apikey: process.env.OVERPASS_API_KEY,
                },
                timeout: 30_000,
            },
        );
        return parseInt(res.data?.elements?.[0]?.tags?.total) || 0;
    } catch (err: any) {
        console.error("[region] building count failed:", err?.message);
        return 0;
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
    } catch (e: any) {
        return NextResponse.json(
            { error: "Invalid body", details: e?.issues ?? e?.message },
            { status: 400 },
        );
    }

    const polygon = closePolygon(parsed.polygon as [number, number][]);
    const turfPolygon = turf.polygon([polygon.map(([lat, lng]) => [lng, lat])]);
    const area = turf.area(turfPolygon);

    const [meta, buildings] = await Promise.all([
        geocodeCenter(polygon),
        countBuildings(polygon),
    ]);

    try {
        const inserted = await db!
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
                buildings,
            })
            .returning({ id: region.id });

        const regionId = inserted[0].id;

        // Fire-and-forget; never blocks the plugin's response.
        fetchLandUseStats(polygon)
            .then((landuse) => db!.update(region).set({ landuse }).where(eq(region.id, regionId)))
            .catch((err) => console.error(`[region] landuse fetch failed for ${regionId}:`, err.message));

        return NextResponse.json({ id: regionId }, { status: 201 });
    } catch (err) {
        console.error("[region] insert failed:", err);
        return NextResponse.json({ error: "insert failed" }, { status: 500 });
    }
}
