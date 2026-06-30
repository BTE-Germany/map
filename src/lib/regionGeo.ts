import type { FeatureCollection, Polygon } from "geojson";

export type RegionGeoJSON = FeatureCollection<Polygon, { id: string; finished: boolean }>;

/** Region rows are stored as `[[lat, lng], ...]`; GeoJSON wants `[lng, lat]`. */
export function regionsToCreatorGeoJSON(
    regions: { id: string; finished: boolean; polygon: [number, number][] }[],
): RegionGeoJSON {
    return {
        type: "FeatureCollection",
        features: regions.map((r) => ({
            type: "Feature",
            properties: { id: r.id, finished: r.finished },
            geometry: {
                type: "Polygon",
                coordinates: [r.polygon.map((e) => [e[1], e[0]]) as [number, number][]],
            },
        })),
    };
}
