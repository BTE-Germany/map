"use client";

import { Layer, Map as Maplibre, Source, useMap } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAllRegionsAsGeoJSON } from "@/dataHooks/regions/useAllRegions";
import { useEffect, useState } from "react";
import useRegionPane from "@/stores/RegionPaneStore";
import useMapStyleStore from "@/stores/MapStyleStore";
import useRegionShapeEdit from "@/stores/RegionShapeEditStore";
import RegionShapeEditor from "./RegionShapeEditor";
import LivePlayersLayer from "./LivePlayersLayer";
import { getMapStyleById } from "@/lib/mapStyles";
import maplibregl from "maplibre-gl";
import useStreetLevelStore from "@/stores/StreetLevelStore";

const mapboxAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function Map() {

    const { data: regionGeoJSON, isLoading } = useAllRegionsAsGeoJSON();
    const { mainMap: map } = useMap();
    const regionPane = useRegionPane();
    const styleId = useMapStyleStore((state) => state.styleId);
    const hydrateStyleId = useMapStyleStore((state) => state.hydrateStyleId);
    const mapStyle = getMapStyleById(styleId);
    const isMapboxStyle = typeof mapStyle === "string" && mapStyle.startsWith("mapbox://");
    const [mapLib, setMapLib] = useState<any>(maplibregl);
    const [activeEngine, setActiveEngine] = useState<"maplibre" | "mapbox">("maplibre");
    const [isStyleReady, setIsStyleReady] = useState<boolean>(false);
    const [viewState, setViewState] = useState({
        longitude: 10.447683,
        latitude: 51.163361,
        zoom: 6,
        bearing: 0,
        pitch: 0
    });
    const isSelectingStreetLevel = useStreetLevelStore((state) => state.isSelecting);

    useEffect(() => {
        hydrateStyleId();
    }, [hydrateStyleId]);

    useEffect(() => {
        let isMounted = true;

        const resolveMapLib = async () => {
            if (!isMapboxStyle) {
                setMapLib(maplibregl);
                setActiveEngine("maplibre");
                return;
            }

            const mapboxModule = await import("mapbox-gl");
            const mapboxgl = mapboxModule.default;
            if (mapboxAccessToken) {
                mapboxgl.accessToken = mapboxAccessToken;
            }

            if (isMounted) {
                setMapLib(mapboxgl);
                setActiveEngine("mapbox");
            }
        };

        resolveMapLib();

        return () => {
            isMounted = false;
        };
    }, [isMapboxStyle, mapboxAccessToken]);

    const isEngineReady = isMapboxStyle ? activeEngine === "mapbox" : activeEngine === "maplibre";

    useEffect(() => {
        setIsStyleReady(false);
    }, [mapStyle, activeEngine]);

    useEffect(() => {
        if (!map) return;

        const handleStyleReady = () => {
            setIsStyleReady(true);
        };

        if (typeof map.isStyleLoaded === "function" && map.isStyleLoaded()) {
            setIsStyleReady(true);
        }

        map.on('style.load', handleStyleReady);
        map.on('load', handleStyleReady);

        return () => {
            map.off('style.load', handleStyleReady);
            map.off('load', handleStyleReady);
        };
    }, [map]);

    useEffect(() => {
        if (!isEngineReady || !map) return;

        const handleMapClick = (e: any) => {
            if (isSelectingStreetLevel) {
                return;
            }

            const features = map.queryRenderedFeatures(e.point, {
                layers: ['region-layer']
            });
            if (!features.length) {
                return;
            }

            regionPane.openRegion(features[0].properties.id);
        };

        map.on('click', handleMapClick);

        // Change the cursor to a pointer when the mouse is over the states layer.
        const handleMouseEnter = () => {
            map.getCanvas().style.cursor = 'pointer';
        };
        map.on('mouseenter', 'region-layer', handleMouseEnter);

        // Change it back to a pointer when it leaves.
        const handleMouseLeave = () => {
            map.getCanvas().style.cursor = '';
        };
        map.on('mouseleave', 'region-layer', handleMouseLeave);

        return () => {
            map.off('click', handleMapClick);
            map.off('mouseenter', 'region-layer', handleMouseEnter);
            map.off('mouseleave', 'region-layer', handleMouseLeave);
        };
    }, [isEngineReady, isSelectingStreetLevel, map, regionPane]);

    // Colors matching the WelcomeScreen legend:
    // red   = event
    // blue  = plot
    // green = finished (default type)
    // orange = in progress (default type)
    const regionColor = [
        'case',
        ['==', ['get', 'type'], 'event'],  '#ef4444',
        ['==', ['get', 'type'], 'plot'],   '#3b82f6',
        ['==', ['get', 'finished'], true], '#22c55e',
        '#f97316',
    ] as any;

    const layerStyle = {
        id: 'polygon',
        type: 'fill' as const,
        paint: {
            'fill-color': regionColor,
            'fill-opacity': 0.35,
        }
    };

    const layerStyleLine = {
        id: 'polygonline',
        type: 'line' as const,
        paint: {
            'line-color': regionColor,
            'line-opacity': 0.9,
        }
    };

    return (
        <div className="h-full w-full overflow-hidden relative">
            {isEngineReady ? <Maplibre initialViewState={{
                longitude: 10.447683,
                latitude: 51.163361,
                zoom: 6
            }} id={"mainMap"}
                key={activeEngine}
                mapLib={mapLib}
                attributionControl={false}
                style={{ width: "100%", height: "100%", zIndex: 0 }}
                mapStyle={mapStyle}
                longitude={viewState.longitude}
                latitude={viewState.latitude}
                zoom={viewState.zoom}
                bearing={viewState.bearing}
                pitch={viewState.pitch}
                onMove={(evt) => {
                    setViewState({
                        longitude: evt.viewState.longitude,
                        latitude: evt.viewState.latitude,
                        zoom: evt.viewState.zoom,
                        bearing: evt.viewState.bearing,
                        pitch: evt.viewState.pitch
                    });
                }}
                {...(isMapboxStyle && mapboxAccessToken ? { mapboxAccessToken } : {})}
            >
                {
                    !isLoading && isStyleReady && <Source id="regions" type="geojson" data={regionGeoJSON as any}>
                        <Layer {...layerStyle} id={"region-layer"} />
                        <Layer {...layerStyleLine} />
                    </Source>
                }
                {isStyleReady && <LivePlayersLayer />}
            </Maplibre>
                : <div id="mainMap" style={{ width: "100%", height: "100%", zIndex: 0 }} />}
            <RegionShapeEditor />
        </div>
    )
}
