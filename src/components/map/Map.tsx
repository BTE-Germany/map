"use client";

import { Layer, Map as Maplibre, Source, useMap } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAllRegionsAsGeoJSON } from "@/dataHooks/regions/useAllRegions";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import useRegionPane from "@/stores/RegionPaneStore";
import useMapStyleStore from "@/stores/MapStyleStore";
import RegionShapeEditor from "./RegionShapeEditor";
import LivePlayersLayer from "./LivePlayersLayer";
import GoogleBasemap from "./GoogleBasemap";
import { getMapStyleSource } from "@/lib/mapStyles";
import { useEffectiveGoogleRendering } from "@/hooks/use-google-basemap-rendering";
import { getErrorMessage } from "@/lib/errors";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import useStreetLevelStore from "@/stores/StreetLevelStore";
import useRegionShapeEdit from "@/stores/RegionShapeEditStore";
import useUserSettings from "@/stores/UserSettingsStore";

/**
 * What maplibre renders while Google draws the basemap: nothing of its own, so
 * the imagery behind it shows through and only the overlays are maplibre's. A
 * module constant, because a fresh object per render would make `<Maplibre>`
 * re-run `setStyle` and drop everything added on top of it.
 */
const TRANSPARENT_STYLE: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [],
};

function getRaw(mapRef: unknown): maplibregl.Map {
    const candidate = mapRef as { getMap?: () => maplibregl.Map };
    return typeof candidate?.getMap === "function" ? candidate.getMap() : (mapRef as maplibregl.Map);
}

export default function Map() {

    const { data: regionGeoJSON } = useAllRegionsAsGeoJSON();
    const { mainMap: map } = useMap();
    // Select only the (stable) action so this component doesn't re-render — and
    // the click handler doesn't re-bind — whenever unrelated store fields change.
    const openRegion = useRegionPane((s) => s.openRegion);
    const styleId = useMapStyleStore((state) => state.styleId);
    const setStyleId = useMapStyleStore((state) => state.setStyleId);
    const hydrateStyleId = useMapStyleStore((state) => state.hydrateStyleId);
    const styleSource = getMapStyleSource(styleId);
    // Google's imagery is drawn by Google's own map underneath; maplibre then
    // only has to stay out of the way.
    const googleSource = styleSource.kind === "google" ? styleSource : null;
    const mapStyle = styleSource.kind === "google" ? TRANSPARENT_STYLE : styleSource.url;
    // What Google will really do, which is not always what the style asked for.
    const googleRendering = useEffectiveGoogleRendering(styleId);
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

    /* ── Google's SDK failing leaves a transparent map over nothing ──
     *
     * So drop the *selection* back to the standard basemap, not just the style:
     * the picker and the attribution line then agree with what is on screen, and
     * the next page load doesn't retry a style that is known to be unavailable. */
    const handleGoogleError = useCallback((error: unknown) => {
        console.error("Google-Karte konnte nicht geladen werden:", error);
        setStyleId("default");
        toast.error(
            `Google-Karte nicht verfügbar — es wird die Standardkarte angezeigt. ${getErrorMessage(error)}`,
        );
    }, [setStyleId]);

    /* ── Rotation while Google draws the basemap ──
     *
     * Google's *raster* map types have no heading, so a rotated maplibre would
     * float its regions over imagery that stayed put — rotation is turned off
     * for those. A vector basemap follows the bearing the camera sync sends it,
     * so there rotation stays available. */
    useEffect(() => {
        if (!map) return;
        const raw = getRaw(map);

        if (googleRendering !== "raster") {
            raw.dragRotate.enable();
            raw.touchZoomRotate.enableRotation();
            return;
        }

        raw.dragRotate.disable();
        raw.touchZoomRotate.disableRotation();
        if (raw.getBearing() !== 0 || raw.getPitch() !== 0) {
            raw.easeTo({ bearing: 0, pitch: 0, duration: 300 });
        }
    }, [map, googleRendering]);

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
            {/* Behind maplibre: Google's own map, when a Google style is picked.
                Mounted inside the same box so it shares the exact viewport. */}
            {googleSource && (
                <GoogleBasemap
                    mapType={googleSource.mapType}
                    rendering={googleSource.rendering}
                    onError={handleGoogleError}
                />
            )}
            <Maplibre initialViewState={{
                longitude: 10.447683,
                latitude: 51.163361,
                zoom: 6
            }} id={"mainMap"}
                mapLib={maplibregl}
                attributionControl={false}
                style={{ width: "100%", height: "100%", position: "relative", zIndex: 10 }}
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
