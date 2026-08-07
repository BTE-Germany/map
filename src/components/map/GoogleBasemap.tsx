"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { loadGoogleMaps } from "@/lib/googleMapsBrowser";
import { getPublicRuntimeConfig } from "@/lib/publicRuntimeConfig";
import type { GoogleMapType, GoogleRendering } from "@/lib/mapStyles";

/**
 * Google's satellite/hybrid imagery as the basemap underneath maplibre.
 *
 * Google's 2D tiles cannot be consumed as raster tiles here — the Map Tiles API
 * does not serve them in the EEA — so the imagery is rendered by Google's own
 * map, and maplibre runs on top of it with an empty (transparent) style. Every
 * overlay the app draws stays exactly where it was: regions, live players, the
 * shape editor.
 *
 * maplibre owns all interaction. This map never receives a gesture; it only
 * follows maplibre's camera, so the two must agree on what a zoom level means:
 * maplibre counts a 512 px world tile, Google a 256 px one, which is the whole
 * story behind the offset below.
 *
 * A `vector` style is rendered from a Cloud map ID, which is what lets Google
 * accept a fractional zoom and a heading — without it the basemap snaps to whole
 * zoom levels and cannot rotate.
 */
const GOOGLE_ZOOM_OFFSET = 1;

function getRaw(mapRef: unknown): maplibregl.Map {
    const candidate = mapRef as { getMap?: () => maplibregl.Map };
    return typeof candidate?.getMap === "function" ? candidate.getMap() : (mapRef as maplibregl.Map);
}

export default function GoogleBasemap({
    mapType,
    rendering,
    onError,
}: {
    mapType: GoogleMapType;
    rendering: GoogleRendering;
    onError: (error: unknown) => void;
}) {
    const { mainMap: map } = useMap();
    const containerRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<google.maps.Map | null>(null);

    const handleError = useCallback(onError, [onError]);

    /* ── Create the Google map and keep its camera on maplibre's ──
     *
     * Re-runs when the rendering mode changes: `mapId` is fixed at construction,
     * so switching between a vector and a raster style means a new map. Changing
     * only the map *type* does not — that is the effect below. */
    useEffect(() => {
        const container = containerRef.current;
        if (!map || !container) return;

        const raw = getRaw(map);
        let cancelled = false;

        const sync = () => {
            const googleMap = googleMapRef.current;
            if (!googleMap) return;

            const center = raw.getCenter();
            const camera = {
                center: { lat: center.lat, lng: center.lng },
                zoom: raw.getZoom() + GOOGLE_ZOOM_OFFSET,
                // Raster map types ignore both; a vector map ID follows them.
                heading: raw.getBearing(),
                tilt: raw.getPitch(),
            };

            if (typeof googleMap.moveCamera === "function") {
                googleMap.moveCamera(camera);
                return;
            }
            googleMap.setCenter(camera.center);
            googleMap.setZoom(camera.zoom);
        };

        Promise.all([loadGoogleMaps(), getPublicRuntimeConfig()])
            .then(([maps, { googleMapsVectorMapId }]) => {
                if (cancelled) return;

                const vectorMapId = rendering === "vector" ? googleMapsVectorMapId.trim() : "";
                if (rendering === "vector" && !vectorMapId) {
                    console.warn(
                        "[google-basemap] GOOGLE_MAPS_VECTOR_MAP_ID ist nicht gesetzt — " +
                        `"${mapType}" wird als Raster gezeichnet (kein Drehen, ganzzahlige Zoomstufen).`,
                    );
                }

                const center = raw.getCenter();
                googleMapRef.current = new maps.Map(container, {
                    center: { lat: center.lat, lng: center.lng },
                    zoom: raw.getZoom() + GOOGLE_ZOOM_OFFSET,
                    mapTypeId: mapType,
                    ...(vectorMapId ? { mapId: vectorMapId } : {}),
                    // Drops the controls but keeps the Google logo and the terms
                    // link, which have to stay visible.
                    disableDefaultUI: true,
                    // maplibre sits on top and handles every gesture; without
                    // this Google would fight it for the ones that got through.
                    gestureHandling: "none",
                    keyboardShortcuts: false,
                    tilt: 0,
                });

                sync();
                raw.on("move", sync);
            })
            .catch((error) => {
                if (!cancelled) handleError(error);
            });

        return () => {
            cancelled = true;
            raw.off("move", sync);
            googleMapRef.current = null;
            // Google's Map has no teardown; dropping its DOM is the way out.
            container.replaceChildren();
        };
    }, [map, rendering, handleError]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── A map type change within the same rendering mode reuses the map ── */
    useEffect(() => {
        googleMapRef.current?.setMapTypeId(mapType);
    }, [mapType]);

    return <div ref={containerRef} aria-hidden className="absolute inset-0 z-0 pointer-events-none" />;
}
