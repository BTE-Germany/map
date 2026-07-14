"use client";

import { Layer, Map as MaplibreMap, Source } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import type { FeatureCollection, Polygon } from "geojson";
import { getMapStyleById } from "@/lib/mapStyles";

const MAP_STYLE = getMapStyleById("default");

export type UserRegionsGeoJSON = FeatureCollection<Polygon, { id: string; finished: boolean }>;

type MapLoadEvent = {
    target: {
        fitBounds: (
            bounds: [[number, number], [number, number]],
            options: { padding: number; maxZoom: number; duration: number }
        ) => void;
    };
};

export default function ProfileMiniMap({ geoJSON }: { geoJSON: UserRegionsGeoJSON }) {
    function onMapLoad(e: MapLoadEvent) {
        const map = e.target;
        if (geoJSON.features.length === 0) return;

        const coords = geoJSON.features.flatMap(
            (f) => f.geometry.coordinates[0] as [number, number][]
        );

        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const [lng, lat] of coords) {
            if (lng < minLng) minLng = lng;
            if (lat < minLat) minLat = lat;
            if (lng > maxLng) maxLng = lng;
            if (lat > maxLat) maxLat = lat;
        }

        map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 60, maxZoom: 13, duration: 0 }
        );
    }

    return (
        <MaplibreMap
            initialViewState={{ longitude: 10.45, latitude: 51.16, zoom: 5 }}
            mapLib={maplibregl}
            mapStyle={MAP_STYLE}
            attributionControl={false}
            onLoad={onMapLoad}
            style={{ width: "100%", height: "100%" }}
            interactive={false}
        >
            <Source id="user-regions" type="geojson" data={geoJSON}>
                <Layer
                    id="user-region-fill"
                    type="fill"
                    paint={{
                        "fill-color": [
                            "case",
                            ["==", ["get", "finished"], true],
                            "rgba(16,185,129,0.35)",
                            "rgba(59,130,246,0.35)",
                        ],
                    }}
                />
                <Layer
                    id="user-region-line"
                    type="line"
                    paint={{
                        "line-color": [
                            "case",
                            ["==", ["get", "finished"], true],
                            "rgba(16,185,129,1)",
                            "rgba(59,130,246,1)",
                        ],
                        "line-width": 1.5,
                    }}
                />
            </Source>
        </MaplibreMap>
    );
}
