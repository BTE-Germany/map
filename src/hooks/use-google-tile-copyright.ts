import { useEffect, useState } from "react";
import type { MapRef } from "@vis.gl/react-maplibre";
import { fetchGoogleTileCopyright } from "@/lib/googleMapTiles";
import type { GoogleMapType } from "@/lib/mapStyles";

/** Wait this long after the map stops moving before asking again. */
const SETTLE_MS = 600;

/**
 * The credit Google wants shown for the imagery currently on screen — it names
 * the imagery owners, which change with area and zoom, so it is re-read as the
 * map moves.
 *
 * Returns null while nothing is known (including for non-Google styles), which
 * is the caller's signal to show the static "© Google" attribution instead.
 */
export function useGoogleTileCopyright(
    map: MapRef | undefined,
    mapType: GoogleMapType | null,
): string | null {
    const [copyright, setCopyright] = useState<string | null>(null);

    useEffect(() => {
        if (!map || !mapType) {
            setCopyright(null);
            return;
        }

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        // Panning within the same rounded viewport would return the same string.
        let lastKey = "";

        const read = () => {
            const bounds = map.getBounds();
            const zoom = Math.round(map.getZoom());
            const north = bounds.getNorth();
            const south = bounds.getSouth();
            const east = bounds.getEast();
            const west = bounds.getWest();

            const key = [zoom, north, south, east, west]
                .map((value) => value.toFixed(1))
                .join(":");
            if (key === lastKey) return;
            lastKey = key;

            fetchGoogleTileCopyright(mapType, { north, south, east, west }, zoom).then((next) => {
                if (!cancelled) setCopyright(next);
            });
        };

        const schedule = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(read, SETTLE_MS);
        };

        read();
        map.on("moveend", schedule);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            map.off("moveend", schedule);
        };
    }, [map, mapType]);

    return copyright;
}
