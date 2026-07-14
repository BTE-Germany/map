"use client";

import { Layer, Map as MaplibreMap, Source } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { getMapStyleById } from "@/lib/mapStyles";

const MAP_STYLE = getMapStyleById("default");

interface Props {
    /** Polygon stored as [lat, lon][] */
    polygon: [number, number][];
    finished: boolean;
}

export default function RegionMiniMap({ polygon, finished }: Props) {
    // Convert [lat, lon] → [lon, lat] for GeoJSON
    const coordinates = polygon.map(([lat, lon]) => [lon, lat] as [number, number]);

    const geoJSON = {
        type: "FeatureCollection" as const,
        features: [
            {
                type: "Feature",
                properties: { finished },
                geometry: { type: "Polygon", coordinates: [coordinates] },
            },
        ],
    };

    function onMapLoad(e: any) {
        const map = e.target;
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const [lng, lat] of coordinates) {
            if (lng < minLng) minLng = lng;
            if (lat < minLat) minLat = lat;
            if (lng > maxLng) maxLng = lng;
            if (lat > maxLat) maxLat = lat;
        }
        map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 60, maxZoom: 16, duration: 0 }
        );
    }

    const fillColor = finished ? "rgba(16,185,129,0.3)" : "rgba(59,130,246,0.3)";
    const lineColor = finished ? "rgba(16,185,129,1)" : "rgba(59,130,246,1)";

    return (
        <MaplibreMap
            initialViewState={{ longitude: 10.45, latitude: 51.16, zoom: 5 }}
            mapLib={maplibregl as any}
            mapStyle={MAP_STYLE}
            attributionControl={false}
            onLoad={onMapLoad}
            style={{ width: "100%", height: "100%" }}
            interactive={false}
        >
            <Source id="region" type="geojson" data={geoJSON as any}>
                <Layer
                    id="region-fill"
                    type="fill"
                    paint={{ "fill-color": fillColor }}
                />
                <Layer
                    id="region-line"
                    type="line"
                    paint={{ "line-color": lineColor, "line-width": 2 }}
                />
            </Source>
        </MaplibreMap>
    );
}
