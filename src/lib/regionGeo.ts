import type { FeatureCollection, Point, Polygon } from "geojson";

export type RegionGeoJSON = FeatureCollection<Polygon, { id: string; finished: boolean }>;

export type RegionPointGeoJSON = FeatureCollection<Point, { id: string; finished: boolean }>;

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

/** One marker per region, placed at the bounding-box center of its outer ring. */
export function regionGeoJSONToPoints(regions: RegionGeoJSON): RegionPointGeoJSON {
    return {
        type: "FeatureCollection",
        features: regions.features.flatMap((feature) => {
            const ring = feature.geometry.coordinates[0] as [number, number][] | undefined;
            if (!ring?.length) return [];

            let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
            for (const [lng, lat] of ring) {
                if (lng < minLng) minLng = lng;
                if (lat < minLat) minLat = lat;
                if (lng > maxLng) maxLng = lng;
                if (lat > maxLat) maxLat = lat;
            }

            return [{
                type: "Feature" as const,
                properties: feature.properties,
                geometry: {
                    type: "Point" as const,
                    coordinates: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
                },
            }];
        }),
    };
}
