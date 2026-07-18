import * as turf from "@turf/turf";
import { Language, PlaceType2 } from "@googlemaps/google-maps-services-js";
import { getErrorMessage } from "@/lib/errors";
import gMapsClient from "@/lib/googleMaps";

/**
 * German federal state long names (as returned by Google's geocoder) → the
 * two-letter codes stored in the `regions.state` column.
 */
export const STATE_NAME_TO_CODE: Record<string, string> = {
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

export interface GeocodedMeta {
    address: string;
    city: string;
    state: string;
}

/**
 * Reverse-geocode the centroid of a `[lat, lng]` polygon into city, state and
 * street address. Never throws — falls back to `{ address: "", city:
 * "Unbekannt", state: "" }` so callers can always insert a region even if the
 * geocoder is unavailable.
 */
export async function geocodeRegionCenter(polygonLatLng: [number, number][]): Promise<GeocodedMeta> {
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
        console.error("[regionGeocode] reverse geocode failed:", getErrorMessage(err));
        return { address: "", city: "Unbekannt", state: "" };
    }
}
