"use client";

import { Layer, Map as Maplibre, Source, useMap } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAllRegionsAsGeoJSON } from "@/dataHooks/regions/useAllRegions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useRegionPane from "@/stores/RegionPaneStore";
import useMapStyleStore from "@/stores/MapStyleStore";
import RegionShapeEditor from "./RegionShapeEditor";
import LivePlayersLayer from "./LivePlayersLayer";
import { DEFAULT_MAP_STYLE_URL, getMapStyleSource } from "@/lib/mapStyles";
import { resolveGoogleMapStyle } from "@/lib/googleMapTiles";
import { getErrorMessage } from "@/lib/errors";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import useStreetLevelStore from "@/stores/StreetLevelStore";
import useRegionShapeEdit from "@/stores/RegionShapeEditStore";
import useUserSettings from "@/stores/UserSettingsStore";

export default function Map() {

    const { data: regionGeoJSON } = useAllRegionsAsGeoJSON();
    const { mainMap: map } = useMap();
    // Select only the (stable) action so this component doesn't re-render — and
    // the click handler doesn't re-bind — whenever unrelated store fields change.
    const openRegion = useRegionPane((s) => s.openRegion);
    const styleId = useMapStyleStore((state) => state.styleId);
    const setStyleId = useMapStyleStore((state) => state.setStyleId);
    const hydrateStyleId = useMapStyleStore((state) => state.hydrateStyleId);
    // Held in state, not derived per render: Google's styles are assembled after
    // a session-token round-trip, and handing `<Maplibre>` a fresh object every
    // render would re-run `setStyle` and drop everything drawn on top.
    const [mapStyle, setMapStyle] = useState<string | StyleSpecification>(DEFAULT_MAP_STYLE_URL);
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
    const regionColors = useUserSettings((state) => state.regionColors);

    useEffect(() => {
        hydrateStyleId();
    }, [hydrateStyleId]);

    /* ── Resolve the picked style ──
     *
     * A style.json URL is handed to maplibre as-is. Google's imagery has to be
     * assembled around a session token first, so the previously rendered style
     * stays up while that request is in flight — the alternative is a blank map
     * for a round-trip.
     *
     * A failure (no key, Map Tiles API not enabled for it, offline) drops the
     * selection back to the standard basemap rather than leaving a map that
     * silently didn't change — and reverting the *selection*, not just the
     * style, keeps the picker and the attribution line from claiming Google for
     * tiles that aren't Google's, and stops the next page load from retrying a
     * style that is known to be unavailable. */
    useEffect(() => {
        const source = getMapStyleSource(styleId);

        if (source.kind === "url") {
            setMapStyle(source.url);
            return;
        }

        let isCurrent = true;

        resolveGoogleMapStyle(source.mapType)
            .then((style) => {
                if (isCurrent) setMapStyle(style);
            })
            .catch((error) => {
                console.error("Google-Karte konnte nicht geladen werden:", error);
                if (!isCurrent) return;
                setMapStyle(DEFAULT_MAP_STYLE_URL);
                setStyleId("default");
                toast.error(
                    `Google-Karte nicht verfügbar — es wird die Standardkarte angezeigt. ${getErrorMessage(error)}`,
                );
            });

        return () => {
            isCurrent = false;
        };
    }, [styleId, setStyleId]);

    useEffect(() => {
        if (!map) return;

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
    }, [isSelectingStreetLevel, isEditingShape, map, openRegion]);

    // Defaults match the WelcomeScreen legend:
    // red   = event
    // blue  = plot
    // green = finished (default type)
    // orange = in progress (default type)
    // Each is overridable per user under /profile/settings — `<Layer>` pushes the
    // new paint property to maplibre, so a change lands without a reload.
    const regionColor = [
        'case',
        ['==', ['get', 'type'], 'event'],  regionColors.event,
        ['==', ['get', 'type'], 'plot'],   regionColors.plot,
        ['==', ['get', 'finished'], true], regionColors.finished,
        regionColors.inProgress,
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
            <Maplibre initialViewState={{
                longitude: 10.447683,
                latitude: 51.163361,
                zoom: 6
            }} id={"mainMap"}
                mapLib={maplibregl}
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
            <RegionShapeEditor />
        </div>
    )
}
