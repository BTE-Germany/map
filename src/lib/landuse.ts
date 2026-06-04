import axios from "axios";
import * as turf from "@turf/turf";
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

/**
 * Stitches multiple way-segments (outer members of a relation) into a single
 * closed ring by connecting them end-to-end.
 */
function stitchOuterRing(segments: Coord[][]): Coord[] | null {
    if (segments.length === 0) return null;

    const result: Coord[] = [...segments[0]];
    const remaining = segments.slice(1);
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

function tryIntersectArea(regionPoly: Feature<Polygon>, coords: Coord[]): number {
    try {
        const poly = turf.polygon([coords]);
        const intersection = turf.intersect(turf.featureCollection([regionPoly, poly]));
        return intersection ? turf.area(intersection) : 0;
    } catch {
        return 0;
    }
}

const LANDUSE_FILTER = `["landuse"~"^(forest|farmland|meadow|grass|orchard|vineyard|allotments|residential|industrial|commercial|retail|recreation_ground|cemetery|reservoir|basin)$"]`;
const NATURAL_FILTER = `["natural"~"^(wood|water|grassland|scrub|heath|wetland)$"]`;
const LEISURE_FILTER = `["leisure"~"^(park|garden)$"]`;

export async function fetchLandUseStats(polygon: [number, number][]): Promise<LandUseStats> {
    const lats = polygon.map(c => c[0]);
    const lons = polygon.map(c => c[1]);

    // Expand bbox by ~1 km so that large landuse areas whose nodes lie outside
    // the region (e.g. a residential block that fully contains the region) are
    // still returned by Overpass and then clipped to the region by turf.
    const PAD = 0.01; // ~1 km
    const bbox = `${Math.min(...lats) - PAD},${Math.min(...lons) - PAD},${Math.max(...lats) + PAD},${Math.max(...lons) + PAD}`;

    const query = `[out:json][timeout:30];
(
  way${LANDUSE_FILTER}(${bbox});
  way${NATURAL_FILTER}(${bbox});
  way${LEISURE_FILTER}(${bbox});
  relation${LANDUSE_FILTER}(${bbox});
  relation${NATURAL_FILTER}(${bbox});
  relation${LEISURE_FILTER}(${bbox});
);
out geom;`;

    console.log("[landuse] fetching stats with query:", query);

    const { data } = await axios.post(
        process.env.OVERPASS_API_URL!,
        `data=${encodeURIComponent(query)}`,
        { headers: { "Content-Type": "application/x-www-form-urlencoded", "apikey": process.env.OVERPASS_API_KEY }, timeout: 35_000 }
    );

    const regionPoly = turf.polygon([polygon.map(coord => [coord[1], coord[0]])]);
    const stats: LandUseStats = { forest: 0, water: 0, farmland: 0, residential: 0, industrial: 0, park: 0 };

    for (const element of data?.elements ?? []) {

        const category = getLandUseCategory(element.tags ?? {});
        if (!category) continue;

        if (element.type === "way") {
            if (!Array.isArray(element.geometry) || element.geometry.length < 3) continue;

            const coords: Coord[] = element.geometry.map(
                (p: { lat: number; lon: number }) => [p.lon, p.lat]
            );
            if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                coords.push(coords[0]);
            }
            if (coords.length < 4) continue;

            stats[category] += tryIntersectArea(regionPoly, coords);

        } else if (element.type === "relation") {
            if (!Array.isArray(element.members)) continue;

            const outerSegments: Coord[][] = (element.members as OverpassMember[])
                .filter((m) => m.role === "outer" && Array.isArray(m.geometry) && m.geometry.length >= 2)
                .map((m) => m.geometry!.map((p) => [p.lon, p.lat] as Coord));

            if (outerSegments.length === 0) continue;

            const ring = stitchOuterRing(outerSegments);
            if (!ring) continue;

            stats[category] += tryIntersectArea(regionPoly, ring);
        }
    }

    return stats;
}
