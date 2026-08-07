"use client";

import { Layer, Map as Maplibre, Source, useMap } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAllRegionsAsGeoJSON } from "@/dataHooks/regions/useAllRegions";
import { useEffect, useState } from "react";
import useRegionPane from "@/stores/RegionPaneStore";
import useMapStyleStore from "@/stores/MapStyleStore";
import RegionShapeEditor from "./RegionShapeEditor";
import LivePlayersLayer from "./LivePlayersLayer";
import { getMapStyleById } from "@/lib/mapStyles";
import { getPublicRuntimeConfig } from "@/lib/publicRuntimeConfig";
import maplibregl from "maplibre-gl";
import useStreetLevelStore from "@/stores/StreetLevelStore";
import useRegionShapeEdit from "@/stores/RegionShapeEditStore";

export default function Map() {

    const { data: regionGeoJSON } = useAllRegionsAsGeoJSON();
    const { mainMap: map } = useMap();
    // Select only the (stable) action so this component doesn't re-render — and
    // the click handler doesn't re-bind — whenever unrelated store fields change.
    const openRegion = useRegionPane((s) => s.openRegion);
    const styleId = useMapStyleStore((state) => state.styleId);
    const hydrateStyleId = useMapStyleStore((state) => state.hydrateStyleId);
    const mapStyle = getMapStyleById(styleId);
    const isMapboxStyle = typeof mapStyle === "string" && mapStyle.startsWith("mapbox://");
    const [mapLib, setMapLib] = useState<any>(maplibregl);
    const [activeEngine, setActiveEngine] = useState<"maplibre" | "mapbox">("maplibre");
    const [mapboxAccessToken, setMapboxAccessToken] = useState("");
    const [viewState, setViewState] = useState({
        longitude: 10.447683,
        latitude: 51.163361,
        zoom: 6,
        bearing: 0,
        pitch: 0
    });
    const isSelectingStreetLevel = useStreetLevelStore((state) => state.isSelecting);
    // While the shape editor is active the map clicks belong to it: dragging a
    // vertex or clicking an edge must not also open the region detail pane
    // (which would close the editor's context and fly the map somewhere else).
    const isEditingShape = useRegionShapeEdit((state) => state.isEditing);

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

            const [mapboxModule, runtimeConfig] = await Promise.all([
                import("mapbox-gl"),
                getPublicRuntimeConfig(),
            ]);
            if (!isMounted) return;

            const mapboxgl = mapboxModule.default;
            if (runtimeConfig.mapboxAccessToken) {
                mapboxgl.accessToken = runtimeConfig.mapboxAccessToken;
            }

            setMapboxAccessToken(runtimeConfig.mapboxAccessToken);
            setMapLib(mapboxgl);
            setActiveEngine("mapbox");
        };

        resolveMapLib().catch((error) => {
            console.error("Mapbox konnte nicht initialisiert werden:", error);
        });

        return () => {
            isMounted = false;
        };
    }, [isMapboxStyle]);

    const isEngineReady = isMapboxStyle ? activeEngine === "mapbox" : activeEngine === "maplibre";

    useEffect(() => {
        if (!isEngineReady || !map) return;

        const handleMapClick = (e: any) => {
            if (isSelectingStreetLevel || isEditingShape) {
                return;
            }

            const features = map.queryRenderedFeatures(e.point, {
                layers: ['region-layer']
            });
            if (!features.length) {
                return;
            }

            openRegion(features[0].properties.id);
        };

        map.on('click', handleMapClick);

        // Change the cursor to a pointer when the mouse is over the states layer.
        // Not while editing — there the editor owns the cursor.
        const handleMouseEnter = () => {
            if (isEditingShape) return;
            map.getCanvas().style.cursor = 'pointer';
        };
        map.on('mouseenter', 'region-layer', handleMouseEnter);

        // Change it back to a pointer when it leaves.
        const handleMouseLeave = () => {
            if (isEditingShape) return;
            map.getCanvas().style.cursor = '';
        };
        map.on('mouseleave', 'region-layer', handleMouseLeave);

        return () => {
            map.off('click', handleMapClick);
            map.off('mouseenter', 'region-layer', handleMouseEnter);
            map.off('mouseleave', 'region-layer', handleMouseLeave);
        };
    }, [isEngineReady, isSelectingStreetLevel, isEditingShape, map, openRegion]);

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
                    // Deliberately not gated on a style-loaded flag. <Source>
                    // listens for `styledata` itself and re-creates the source
                    // whenever a style swap has dropped it — but only while it
                    // stays mounted. Unmounting it on style change meant it
                    // waited for a `style.load` that maplibre only fires for
                    // the very first style, so the regions never came back.
                    // Gated on the data itself, not on `isLoading`: a *failed*
                    // query also reports `isLoading === false`, and mounting
                    // the source with `data: undefined` makes maplibre reject
                    // it outright ("missing required property data").
                    regionGeoJSON && <Source id="regions" type="geojson" data={regionGeoJSON as any}>
                        <Layer {...layerStyle} id={"region-layer"} />
                        <Layer {...layerStyleLine} />
                    </Source>
                }
                {/* Markers are DOM overlays and survive a style swap untouched. */}
                <LivePlayersLayer />
            </Maplibre>
                : <div id="mainMap" style={{ width: "100%", height: "100%", zIndex: 0 }} />}
            <RegionShapeEditor />
        </div>
    )
}
