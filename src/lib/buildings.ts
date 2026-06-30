import { postOverpassQuery } from "@/lib/overpass";
import { getErrorMessage } from "@/lib/errors";

/**
 * Zählt die Anzahl Gebäude innerhalb eines Polygons via Overpass.
 * Polygon kommt im DB-Format [[lat, lon], ...].
 * Gibt 0 zurück, wenn Overpass nicht erreichbar ist.
 */
export async function fetchBuildingCount(polygon: [number, number][]): Promise<number> {
    const poly = polygon.map((coord) => coord.join(" ")).join(" ");

    // Server-side timeout kept just under the 30s client timeout so an
    // over-long query stops server-side rather than holding an Overpass slot
    // after the client has already aborted.
    const query = `[out:json][timeout:25];
(
  node["building"]["building"!~"grandstand"]["building"!~"roof"](poly:"${poly}");
  way["building"]["building"!~"grandstand"]["building"!~"roof"](poly:"${poly}");
  relation["building"]["building"!~"grandstand"]["building"!~"roof"](poly:"${poly}");
);
out count;`;

    if (process.env.DEBUG_OVERPASS) {
        console.log("[buildings] fetching count with query:", query);
    }

    try {
        const data = await postOverpassQuery(query, { timeoutMs: 30_000 });
        return parseInt(data?.elements?.[0]?.tags?.total) || 0;
    } catch (err: unknown) {
        console.error("[buildings] count failed:", getErrorMessage(err));
        return 0;
    }
}
