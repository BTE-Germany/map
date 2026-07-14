"use client";

import { useEffect } from "react";
import { useMap } from "@vis.gl/react-maplibre";

import useSearchStore from "@/stores/SearchStore";

export default function MapSearchNavigation() {
    const { mainMap: map } = useMap();
    const mapTarget = useSearchStore((state) => state.mapTarget);
    const clearMapTarget = useSearchStore((state) => state.clearMapTarget);

    useEffect(() => {
        if (!map || !mapTarget) return;

        map.flyTo({
            center: [mapTarget.longitude, mapTarget.latitude],
            zoom: mapTarget.zoom,
            duration: 1200,
            essential: true,
        });
        clearMapTarget();
    }, [clearMapTarget, map, mapTarget]);

    return null;
}
