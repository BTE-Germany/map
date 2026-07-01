import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import statesData from "@/data/germanStates.json";

// Local dataset of the 16 German Bundesländer (simplified boundaries, ISO
// 3166-2 ids like "DE-BW"). Bundled so state lookups are instant and need no
// external geocoding. Source: isellsoap/deutschlandGeoJSON (BKG / GeoBasis-DE),
// medium resolution, coordinates rounded to ~11 m.
type StateGeom = Polygon | MultiPolygon;
const STATES = statesData as unknown as FeatureCollection<StateGeom, { id: string }>;

function codeOf(f: Feature<StateGeom, { id: string }>): string {
    return f.properties.id.replace(/^DE-/, "");
}

// Precompute each state's centroid once for the (rare) nearest-state fallback.
const STATE_CENTROIDS: { code: string; centroid: Feature<Point> }[] = STATES.features.map((f) => ({
    code: codeOf(f),
    centroid: turf.centroid(f),
}));

/**
 * Determine the 2-letter Bundesland code for a region from the local boundary
 * dataset (no external geocoding). Region polygon is `[[lat, lng], ...]`.
 *
 * Tests the region's centre point against each state polygon; if it lands in no
 * state (e.g. just off the simplified coastline) it falls back to the nearest
 * state. At this resolution very small exclaves (e.g. Bremerhaven) may resolve
 * to the surrounding state.
 */
export function findStateCode(polygon: [number, number][]): string | null {
    if (!Array.isArray(polygon) || polygon.length < 3) return null;

    let lat = 0;
    let lng = 0;
    for (const [a, b] of polygon) {
        lat += a;
        lng += b;
    }
    const centre = turf.point([lng / polygon.length, lat / polygon.length]);

    for (const f of STATES.features) {
        if (turf.booleanPointInPolygon(centre, f)) return codeOf(f);
    }

    let best: string | null = null;
    let bestDist = Infinity;
    for (const s of STATE_CENTROIDS) {
        const d = turf.distance(centre, s.centroid);
        if (d < bestDist) {
            bestDist = d;
            best = s.code;
        }
    }
    return best;
}
