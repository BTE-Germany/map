import axios from "axios";

/**
 * Zählt die Anzahl Gebäude innerhalb eines Polygons via Overpass.
 * Polygon kommt im DB-Format [[lat, lon], ...].
 * Gibt 0 zurück, wenn Overpass nicht erreichbar ist.
 */
export async function fetchBuildingCount(polygon: [number, number][]): Promise<number> {
    const poly = polygon.map((coord) => coord.join(" ")).join(" ");

    const query = `[out:json][timeout:25];
(
  node["building"]["building"!~"grandstand"]["building"!~"roof"](poly:"${poly}");
  way["building"]["building"!~"grandstand"]["building"!~"roof"](poly:"${poly}");
  relation["building"]["building"!~"grandstand"]["building"!~"roof"](poly:"${poly}");
);
out count;`;

    console.log("[buildings] fetching count with query:", query);


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
            }
        );
        return parseInt(res.data?.elements?.[0]?.tags?.total) || 0;
    } catch (err: any) {
        console.error("[buildings] count failed:", err?.message ?? err);
        return 0;
    }
}
