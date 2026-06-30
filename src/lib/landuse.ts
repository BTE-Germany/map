import * as turf from "@turf/turf";
import { postOverpassQuery } from "@/lib/overpass";
import type { LandUseStats } from "@/db/schema";
import type { Feature, Polygon } from "geojson";

type LandUseCategory = keyof LandUseStats;
type OverpassGeometryPoint = { lat: number; lon: number };
type OverpassMember = {
    role?: string;
    geometry?: OverpassGeometryPoint[];
};

function getLandUseCategory(tags: Record<string, string>): LandUseCategory | null {
    const landuse = tags["landuse"] ?? "";
    const natural = tags["natural"] ?? "";
    const leisure = tags["leisure"] ?? "";

    if (landuse === "forest" || natural === "wood") return "forest";
    if (natural === "water" || natural === "wetland" || landuse === "reservoir" || landuse === "basin") return "water";
    if (["farmland", "meadow", "grass", "orchard", "vineyard", "allotments"].includes(landuse) ||
        ["grassland", "scrub", "heath"].includes(natural)) return "farmland";
    if (landuse === "residential") return "residential";
    if (["industrial", "commercial", "retail", "port"].includes(landuse)) return "industrial";
    if (leisure === "park" || leisure === "garden" || landuse === "recreation_ground" || landuse === "cemetery") return "park";
    return null;
}

type Coord = [number, number];
type BBox = [number, number, number, number]; // [minX, minY, maxX, maxY] in [lng, lat]

/** A parsed, categorised landuse ring ready to be clipped against a region. */
export interface LandUseElement {
    category: LandUseCategory;
    coords: Coord[];
    bbox: BBox;
}

/**
 * Convert an Overpass `geometry` array to `[lng, lat]` coords, dropping any
 * null or non-numeric points. Overpass `out geom` can include `null` entries
 * for unresolved nodes (common in large relations / dense areas like big
 * cities), which would otherwise crash on `p.lon`.
 */
function geometryToCoords(geometry: unknown): Coord[] {
    if (!Array.isArray(geometry)) return [];
    const coords: Coord[] = [];
    for (const p of geometry) {
        if (p && typeof p.lon === "number" && typeof p.lat === "number") {
            coords.push([p.lon, p.lat]);
        }
    }
    return coords;
}

/**
 * Stitches multiple way-segments (outer members of a relation) into a single
 * closed ring by connecting them end-to-end.
 */
function stitchOuterRing(segments: Coord[][]): Coord[] | null {
    const nonEmpty = segments.filter((s) => s.length > 0);
    if (nonEmpty.length === 0) return null;

    const result: Coord[] = [...nonEmpty[0]];
    const remaining = nonEmpty.slice(1);
    const EPS = 1e-7;

    while (remaining.length > 0) {
        const [lx, ly] = result[result.length - 1];
        let matched = false;

        for (let i = 0; i < remaining.length; i++) {
            const seg = remaining[i];
            const [fx, fy] = seg[0];
            const [ex, ey] = seg[seg.length - 1];

            if (Math.abs(fx - lx) < EPS && Math.abs(fy - ly) < EPS) {
                result.push(...seg.slice(1));
                remaining.splice(i, 1);
                matched = true;
                break;
            }
            if (Math.abs(ex - lx) < EPS && Math.abs(ey - ly) < EPS) {
                result.push(...[...seg].reverse().slice(1));
                remaining.splice(i, 1);
                matched = true;
                break;
            }
        }

        if (!matched) break;
    }

    const [sx, sy] = result[0];
    const [ex, ey] = result[result.length - 1];
    if (Math.abs(sx - ex) > EPS || Math.abs(sy - ey) > EPS) {
        result.push(result[0]);
    }

    return result.length >= 4 ? result : null;
}

function bboxOfCoords(coords: Coord[]): BBox {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of coords) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    return [minX, minY, maxX, maxY];
}

function bboxesOverlap(a: BBox, b: BBox): boolean {
    return !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
}

/**
 * Area (m²) of an element's overlap with the region. Cheap geometric shortcuts
 * avoid the expensive `turf.intersect` clip for the common cases (~99% of the
 * per-element cost is the clip):
 *  - bbox rejection (already very cheap),
 *  - element fully CONTAINS the region  → overlap = region area,
 *  - element fully INSIDE the region    → overlap = element area,
 *  - geometries disjoint                → 0.
 * Only true boundary-crossers fall through to the exact clip. Any error in the
 * shortcut predicates falls through to the exact clip, so results are preserved.
 */
function intersectArea(
    regionPoly: Feature<Polygon>,
    regionBbox: BBox,
    regionArea: number,
    el: LandUseElement,
): number {
    if (!bboxesOverlap(el.bbox, regionBbox)) return 0;

    let poly: Feature<Polygon>;
    try {
        poly = turf.polygon([el.coords]);
    } catch {
        return 0;
    }

    try {
        if (turf.booleanContains(poly, regionPoly)) return regionArea;
        if (turf.booleanWithin(poly, regionPoly)) return turf.area(poly);
        if (!turf.booleanIntersects(poly, regionPoly)) return 0;
    } catch {
        // Fall through to the exact clip on any predicate error.
    }

    try {
        const intersection = turf.intersect(turf.featureCollection([regionPoly, poly]));
        return intersection ? turf.area(intersection) : 0;
    } catch {
        return 0;
    }
}

const LANDUSE_FILTER = `["landuse"~"^(forest|farmland|meadow|grass|orchard|vineyard|allotments|residential|industrial|commercial|retail|recreation_ground|cemetery|reservoir|basin)$"]`;
const NATURAL_FILTER = `["natural"~"^(wood|water|grassland|scrub|heath|wetland)$"]`;
const LEISURE_FILTER = `["leisure"~"^(park|garden)$"]`;

// Pad sizing: scale with the region's own span so tiny regions don't query a
// hugely inflated bbox, while keeping a floor large enough to still pick up
// enclosing landuse polygons whose nearest node sits just outside the region.
const MIN_PAD = 0.006; // ~660 m
const MAX_PAD = 0.01;  // ~1.1 km

function padForSpan(span: number): number {
    return Math.min(MAX_PAD, Math.max(MIN_PAD, span));
}

/** Right-sized Overpass bbox string ("minLat,minLng,maxLat,maxLng") for one region. */
export function regionPaddedBbox(polygon: [number, number][]): string {
    const lats = polygon.map((c) => c[0]);
    const lons = polygon.map((c) => c[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const pad = padForSpan(Math.max(maxLat - minLat, maxLon - minLon));
    return `${minLat - pad},${minLon - pad},${maxLat + pad},${maxLon + pad}`;
}

/**
 * Bbox covering several regions at once (for cluster fetching). The result is
 * guaranteed to cover each member's own `regionPaddedBbox`, so clipping any
 * member against this shared element set yields the same area as fetching it
 * alone.
 */
export function unionPaddedBbox(polygons: [number, number][][]): string {
    let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
    for (const polygon of polygons) {
        for (const [lat, lon] of polygon) {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
        }
    }
    const pad = padForSpan(Math.max(maxLat - minLat, maxLon - minLon));
    return `${minLat - pad},${minLon - pad},${maxLat + pad},${maxLon + pad}`;
}

function buildQuery(bbox: string): string {
    // Server-side timeout kept just under the client timeout so an over-long
    // query stops server-side instead of running on (and holding a slot) after
    // the client has already aborted.
    return `[out:json][timeout:30];
(
  way${LANDUSE_FILTER}(${bbox});
  way${NATURAL_FILTER}(${bbox});
  way${LEISURE_FILTER}(${bbox});
  relation${LANDUSE_FILTER}(${bbox});
  relation${NATURAL_FILTER}(${bbox});
  relation${LEISURE_FILTER}(${bbox});
);
out geom;`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseElements(data: any): LandUseElement[] {
    const elements: LandUseElement[] = [];
    for (const element of data?.elements ?? []) {
        const category = getLandUseCategory(element.tags ?? {});
        if (!category) continue;

        if (element.type === "way") {
            const coords = geometryToCoords(element.geometry);
            if (coords.length < 3) continue;
            if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                coords.push(coords[0]);
            }
            if (coords.length < 4) continue;
            elements.push({ category, coords, bbox: bboxOfCoords(coords) });
        } else if (element.type === "relation") {
            if (!Array.isArray(element.members)) continue;
            const outerSegments: Coord[][] = (element.members as OverpassMember[])
                .filter((m) => m.role === "outer")
                .map((m) => geometryToCoords(m.geometry))
                .filter((seg) => seg.length >= 2);
            if (outerSegments.length === 0) continue;
            const ring = stitchOuterRing(outerSegments);
            if (!ring) continue;
            elements.push({ category, coords: ring, bbox: bboxOfCoords(ring) });
        }
    }
    return elements;
}

// Small TTL+LRU cache of parsed landuse elements keyed by the exact bbox query.
// Lets the live create/update paths and repeated bulk runs reuse a recent
// fetch instead of hitting Overpass again.
interface CacheEntry {
    at: number;
    elements: LandUseElement[];
}
const elementCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 24;

/** Fetch (or reuse) the parsed landuse elements within an Overpass bbox. */
export async function fetchLandUseElements(bbox: string): Promise<LandUseElement[]> {
    const cached = elementCache.get(bbox);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        // Refresh LRU recency.
        elementCache.delete(bbox);
        elementCache.set(bbox, cached);
        return cached.elements;
    }

    const query = buildQuery(bbox);
    if (process.env.DEBUG_OVERPASS) {
        console.log("[landuse] fetching elements with query:", query);
    }

    const data = await postOverpassQuery(query, { timeoutMs: 35_000 });
    const elements = parseElements(data);

    elementCache.set(bbox, { at: Date.now(), elements });
    while (elementCache.size > CACHE_MAX_ENTRIES) {
        const oldest = elementCache.keys().next().value;
        if (oldest === undefined) break;
        elementCache.delete(oldest);
    }

    return elements;
}

/** Compute per-category landuse area (m²) for a region from a fetched element set. */
export function computeLandUseStats(polygon: [number, number][], elements: LandUseElement[]): LandUseStats {
    const regionRing: Coord[] = polygon.map((coord) => [coord[1], coord[0]] as Coord);
    const regionPoly = turf.polygon([regionRing]);
    const regionBbox = bboxOfCoords(regionRing);
    const regionArea = turf.area(regionPoly);
    const stats: LandUseStats = { forest: 0, water: 0, farmland: 0, residential: 0, industrial: 0, park: 0 };

    for (const el of elements) {
        stats[el.category] += intersectArea(regionPoly, regionBbox, regionArea, el);
    }

    return stats;
}

export async function fetchLandUseStats(polygon: [number, number][]): Promise<LandUseStats> {
    const elements = await fetchLandUseElements(regionPaddedBbox(polygon));
    return computeLandUseStats(polygon, elements);
}
