/**
 * Shared geometry helpers used by region/teleport actions and routes.
 * Polygons are stored in the DB as `[[lat, lng], ...]`.
 */

/** Ensures a polygon ring is closed (first point === last point). */
export function closePolygon(coords: [number, number][]): [number, number][] {
    if (coords.length < 2) return coords;
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return coords;
    return [...coords, first];
}

/** Simple centroid (average of vertices) of a `[lat, lng]` polygon. */
export function polygonCenterLatLng(polygon: [number, number][]): [number, number] {
    let lat = 0;
    let lng = 0;
    for (const [a, b] of polygon) {
        lat += a;
        lng += b;
    }
    return [lat / polygon.length, lng / polygon.length];
}
