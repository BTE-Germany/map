"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import type maplibregl from "maplibre-gl";
import type { FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderIcon, CheckIcon, XIcon, MousePointerIcon, MagnetIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import useRegionShapeEdit from "@/stores/RegionShapeEditStore";
import { updateRegionPolygon } from "@/actions/region/UpdateRegionPolygon";
import { useAllRegionsAsGeoJSON } from "@/dataHooks/regions/useAllRegions";

type Vertex = [number, number]; // [lng, lat]
type RegionFeatureCollection = FeatureCollection<Polygon | MultiPolygon, { id?: string }>;

interface VertexMenuState {
    idx: number;
    screenX: number;
    screenY: number;
}

const SNAP_DISTANCE_PX = 14;
const VERTEX_LAYER = "shape-verts-layer";
const MIN_VERTICES = 3;
const EMPTY_SNAP_POINTS: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: [],
};

/* ── GeoJSON builders ─────────────────────────────────────────── */

function polyGeoJSON(verts: Vertex[]) {
    return {
        type: "FeatureCollection" as const,
        features: [{
            type: "Feature" as const,
            geometry: { type: "Polygon" as const, coordinates: [[...verts, verts[0]]] },
            properties: {},
        }],
    };
}

function verticesGeoJSON(verts: Vertex[]) {
    return {
        type: "FeatureCollection" as const,
        features: verts.map((v, i) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: v },
            properties: { idx: i },
        })),
    };
}

function midpointsGeoJSON(verts: Vertex[]) {
    return {
        type: "FeatureCollection" as const,
        features: verts.map((v, i) => {
            const next = verts[(i + 1) % verts.length];
            return {
                type: "Feature" as const,
                geometry: {
                    type: "Point" as const,
                    coordinates: [(v[0] + next[0]) / 2, (v[1] + next[1]) / 2] as Vertex,
                },
                properties: { afterIdx: i },
            };
        }),
    };
}

function snapPointsGeoJSON(
    collection: RegionFeatureCollection | undefined,
    currentRegionId: string | null,
): FeatureCollection<Point> {
    if (!collection || !currentRegionId) return EMPTY_SNAP_POINTS;

    const features: FeatureCollection<Point>["features"] = [];
    const seen = new Set<string>();

    const addRing = (ring: number[][]) => {
        for (const coordinate of ring) {
            const [lng, lat] = coordinate;
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

            // Adjacent polygons often share the same vertex. Keep one target so
            // rendered-feature queries stay small while dragging.
            const key = `${lng.toFixed(7)}:${lat.toFixed(7)}`;
            if (seen.has(key)) continue;
            seen.add(key);

            features.push({
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: [lng, lat] },
            });
        }
    };

    for (const feature of collection.features) {
        if (feature.properties?.id === currentRegionId) continue;

        if (feature.geometry.type === "Polygon") {
            feature.geometry.coordinates.forEach(addRing);
        } else {
            feature.geometry.coordinates.forEach((polygon) => polygon.forEach(addRing));
        }
    }

    return { type: "FeatureCollection", features };
}

function activeSnapGeoJSON(vertex: Vertex | null): FeatureCollection<Point> {
    return {
        type: "FeatureCollection",
        features: vertex
            ? [{
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: vertex },
            }]
            : [],
    };
}

/* ── Raw map helper ───────────────────────────────────────────── */

// vis.gl MapRef proxies most methods, but for imperative GL calls
// (addSource / addLayer / getSource etc.) we need the raw instance.
function getRaw(mapRef: any): maplibregl.Map {
    return typeof mapRef.getMap === "function" ? mapRef.getMap() : mapRef;
}

// The style spec is parsed — sources and layers can be added. Deliberately
// independent of whether the tiles behind them have arrived.
function isStyleReady(raw: maplibregl.Map): boolean {
    try {
        return !!raw.getStyle()?.layers;
    } catch {
        return false;
    }
}

/* ── Shared hit test ──────────────────────────────────────────── */

// Right-clicking a vertex opens the editor's own menu, so the generic map
// context menu has to stand down. Same query maplibre uses for its
// layer-scoped events, so both agree on what counts as a hit.
export function hasShapeVertexAt(mapRef: any, point: { x: number; y: number }): boolean {
    if (!mapRef) return false;
    const raw = getRaw(mapRef);
    if (!raw.getLayer?.(VERTEX_LAYER)) return false;
    return raw.queryRenderedFeatures([point.x, point.y], { layers: [VERTEX_LAYER] }).length > 0;
}

/* ── Layer / source helpers ───────────────────────────────────── */

const SOURCES = [
    "shape-poly",
    "shape-verts",
    "shape-mids",
    "shape-snap-points",
    "shape-snap-active",
] as const;
const LAYERS = [
    "shape-fill",
    "shape-line",
    "shape-mids-layer",
    "shape-verts-layer",
    "shape-snap-points-layer",
    "shape-snap-active-layer",
] as const;

function updateSources(raw: maplibregl.Map, verts: Vertex[]) {
    (raw.getSource("shape-poly") as any)?.setData(polyGeoJSON(verts));
    (raw.getSource("shape-verts") as any)?.setData(verticesGeoJSON(verts));
    (raw.getSource("shape-mids") as any)?.setData(midpointsGeoJSON(verts));
}

function updateSnapTarget(raw: maplibregl.Map, vertex: Vertex | null) {
    (raw.getSource("shape-snap-active") as any)?.setData(activeSnapGeoJSON(vertex));
}

function findNearestSnapVertex(
    raw: maplibregl.Map,
    point: { x: number; y: number },
): Vertex | null {
    if (!raw.getLayer("shape-snap-points-layer")) return null;

    const distance = SNAP_DISTANCE_PX;
    const candidates = raw.queryRenderedFeatures(
        [
            [point.x - distance, point.y - distance],
            [point.x + distance, point.y + distance],
        ],
        { layers: ["shape-snap-points-layer"] },
    );

    let nearest: Vertex | null = null;
    let nearestDistance = distance;

    for (const candidate of candidates) {
        if (candidate.geometry.type !== "Point") continue;
        const [lng, lat] = candidate.geometry.coordinates;
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

        const projected = raw.project([lng, lat]);
        const candidateDistance = Math.hypot(projected.x - point.x, projected.y - point.y);
        if (candidateDistance <= nearestDistance) {
            nearestDistance = candidateDistance;
            nearest = [lng, lat];
        }
    }

    return nearest;
}

function addLayersToMap(
    raw: maplibregl.Map,
    verts: Vertex[],
    snapPoints: FeatureCollection<Point>,
    snapEnabled: boolean,
) {
    raw.addSource("shape-poly", { type: "geojson", data: polyGeoJSON(verts) as any });
    raw.addSource("shape-verts", { type: "geojson", data: verticesGeoJSON(verts) as any });
    raw.addSource("shape-mids", { type: "geojson", data: midpointsGeoJSON(verts) as any });
    raw.addSource("shape-snap-points", { type: "geojson", data: snapPoints as any });
    raw.addSource("shape-snap-active", { type: "geojson", data: activeSnapGeoJSON(null) as any });

    raw.addLayer({
        id: "shape-snap-points-layer",
        type: "circle",
        source: "shape-snap-points",
        paint: {
            "circle-radius": 3.5,
            "circle-color": "#22d3ee",
            "circle-opacity": snapEnabled ? 0.55 : 0,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#083344",
        },
    });

    raw.addLayer({ id: "shape-fill", type: "fill", source: "shape-poly",
        paint: { "fill-color": "#a78bfa", "fill-opacity": 0.25 } });
    raw.addLayer({ id: "shape-line", type: "line", source: "shape-poly",
        paint: { "line-color": "#a78bfa", "line-width": 2, "line-dasharray": [4, 2] } });
    raw.addLayer({ id: "shape-mids-layer", type: "circle", source: "shape-mids",
        paint: {
            "circle-radius": 5,
            "circle-color": "#fff",
            "circle-opacity": 0.6,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#a78bfa",
        },
    });
    raw.addLayer({ id: "shape-verts-layer", type: "circle", source: "shape-verts",
        paint: {
            "circle-radius": 7,
            "circle-color": "#fff",
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#7c3aed",
        },
    });
    raw.addLayer({
        id: "shape-snap-active-layer",
        type: "circle",
        source: "shape-snap-active",
        paint: {
            "circle-radius": 10,
            "circle-color": "#22d3ee",
            "circle-opacity": 0.2,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#67e8f9",
        },
    });
}

function removeLayersFromMap(raw: maplibregl.Map) {
    LAYERS.forEach((l) => { if (raw.getLayer(l)) raw.removeLayer(l); });
    SOURCES.forEach((s) => { if (raw.getSource(s)) raw.removeSource(s); });
}

/* ── Main component ───────────────────────────────────────────── */

export default function RegionShapeEditor() {
    const { mainMap: map } = useMap();
    const { isEditing, regionId, vertices, stopEditing, setVertices } = useRegionShapeEdit();
    const { data: regionGeoJSON } = useAllRegionsAsGeoJSON();
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [vertexMenu, setVertexMenu] = useState<VertexMenuState | null>(null);

    const snapPoints = useMemo(
        () => isEditing
            ? snapPointsGeoJSON(
                regionGeoJSON as unknown as RegionFeatureCollection | undefined,
                regionId,
            )
            : EMPTY_SNAP_POINTS,
        [isEditing, regionGeoJSON, regionId],
    );

    // Refs for use inside event handlers (avoid stale closures)
    const vertsRef = useRef<Vertex[]>(vertices);
    const draggingIdxRef = useRef<number | null>(null);
    const vertexMenuRef = useRef<HTMLDivElement>(null);
    const snapEnabledRef = useRef(snapEnabled);
    const snapPointsRef = useRef(snapPoints);

    useEffect(() => { vertsRef.current = vertices; }, [vertices]);
    useEffect(() => { snapEnabledRef.current = snapEnabled; }, [snapEnabled]);
    useEffect(() => { snapPointsRef.current = snapPoints; }, [snapPoints]);

    /* ── Setup / teardown map layers ── */
    useEffect(() => {
        if (!map || !isEditing || vertices.length === 0) return;

        const raw = getRaw(map);

        function setup() {
            addLayersToMap(raw, vertsRef.current, snapPointsRef.current, snapEnabledRef.current);

            const canvas = raw.getCanvas();

            /* Vertex drag
             *
             * The move/up half of the drag lives on `window`, not on the map.
             * Map mouse events only fire for the canvas container, so releasing
             * the button over the toolbar, over the region pane or outside the
             * window never ended the drag — dragPan stayed disabled and the map
             * could not be panned for the rest of the editing session. */
            const pointFromEvent = (event: MouseEvent) => {
                const rect = canvas.getBoundingClientRect();
                return { x: event.clientX - rect.left, y: event.clientY - rect.top };
            };

            function moveDraggedVertex(event: MouseEvent) {
                const idx = draggingIdxRef.current;
                if (idx === null) return;
                const point = pointFromEvent(event);
                const snapTarget = snapEnabledRef.current
                    ? findNearestSnapVertex(raw, point)
                    : null;
                const lngLat = raw.unproject([point.x, point.y]);
                const newVerts = [...vertsRef.current] as Vertex[];
                newVerts[idx] = snapTarget ?? [lngLat.lng, lngLat.lat];
                vertsRef.current = newVerts;
                updateSources(raw, newVerts);
                updateSnapTarget(raw, snapTarget);
            }

            function endDrag() {
                if (draggingIdxRef.current === null) return;
                draggingIdxRef.current = null;
                detachDragListeners();
                setVertices([...vertsRef.current]);
                updateSnapTarget(raw, null);
                raw.dragPan.enable();
                canvas.style.cursor = "";
            }

            function onWindowMouseMove(event: MouseEvent) {
                if (draggingIdxRef.current === null) return;
                // A button released outside the window fires no mouseup at all,
                // so a move with no button held is the end of the drag.
                if (event.buttons === 0) {
                    endDrag();
                    return;
                }
                moveDraggedVertex(event);
            }

            function onWindowMouseUp(event: MouseEvent) {
                if (draggingIdxRef.current === null) return;
                moveDraggedVertex(event);
                endDrag();
            }

            function detachDragListeners() {
                window.removeEventListener("mousemove", onWindowMouseMove);
                window.removeEventListener("mouseup", onWindowMouseUp);
                window.removeEventListener("blur", endDrag);
            }

            const onVertexDown = (e: any) => {
                // Right/middle button: no drag, the context menu handles it.
                if (e.originalEvent?.button !== 0) return;
                e.preventDefault();
                const idx = e.features?.[0]?.properties?.idx;
                if (idx == null) return;
                setVertexMenu(null);
                draggingIdxRef.current = Number(idx);
                raw.dragPan.disable();
                canvas.style.cursor = "grabbing";
                window.addEventListener("mousemove", onWindowMouseMove);
                window.addEventListener("mouseup", onWindowMouseUp);
                window.addEventListener("blur", endDrag);
            };

            /* Vertex right-click → context menu (delete) */
            const onVertexContextMenu = (e: any) => {
                e.preventDefault();
                const idx = e.features?.[0]?.properties?.idx;
                if (idx == null) return;
                setVertexMenu({ idx: Number(idx), screenX: e.point.x, screenY: e.point.y });
            };

            const closeVertexMenu = () => setVertexMenu(null);

            /* Midpoint click → insert vertex */
            const onMidClick = (e: any) => {
                if (draggingIdxRef.current !== null) return;
                const afterIdx = e.features?.[0]?.properties?.afterIdx;
                if (afterIdx == null) return;
                const insertAt = Number(afterIdx) + 1;
                const lngLat: Vertex = snapEnabledRef.current
                    ? findNearestSnapVertex(raw, e.point) ?? [e.lngLat.lng, e.lngLat.lat]
                    : [e.lngLat.lng, e.lngLat.lat];
                const newVerts = [...vertsRef.current];
                newVerts.splice(insertAt, 0, lngLat);
                vertsRef.current = newVerts;
                setVertices(newVerts);
            };

            /* Vertex double-click → swallow, so it doesn't zoom the map */
            const onVertexDblClick = (e: any) => {
                e.preventDefault();
            };

            /* Cursors */
            const grabCursor = () => { if (draggingIdxRef.current === null) raw.getCanvas().style.cursor = "grab"; };
            const crossCursor = () => { if (draggingIdxRef.current === null) raw.getCanvas().style.cursor = "copy"; };
            const resetCursor = () => { if (draggingIdxRef.current === null) raw.getCanvas().style.cursor = ""; };

            raw.on("mousedown", VERTEX_LAYER, onVertexDown);
            raw.on("contextmenu", VERTEX_LAYER, onVertexContextMenu);
            raw.on("click", "shape-mids-layer", onMidClick);
            raw.on("dblclick", VERTEX_LAYER, onVertexDblClick);
            raw.on("mouseenter", VERTEX_LAYER, grabCursor);
            raw.on("mouseleave", VERTEX_LAYER, resetCursor);
            raw.on("mouseenter", "shape-mids-layer", crossCursor);
            raw.on("mouseleave", "shape-mids-layer", resetCursor);
            raw.on("movestart", closeVertexMenu);
            raw.on("zoomstart", closeVertexMenu);

            return () => {
                raw.off("mousedown", VERTEX_LAYER, onVertexDown);
                raw.off("contextmenu", VERTEX_LAYER, onVertexContextMenu);
                raw.off("click", "shape-mids-layer", onMidClick);
                raw.off("dblclick", VERTEX_LAYER, onVertexDblClick);
                raw.off("mouseenter", VERTEX_LAYER, grabCursor);
                raw.off("mouseleave", VERTEX_LAYER, resetCursor);
                raw.off("mouseenter", "shape-mids-layer", crossCursor);
                raw.off("mouseleave", "shape-mids-layer", resetCursor);
                raw.off("movestart", closeVertexMenu);
                raw.off("zoomstart", closeVertexMenu);
                draggingIdxRef.current = null;
                detachDragListeners();
                removeLayersFromMap(raw);
                canvas.style.cursor = "";
                raw.dragPan.enable();
            };
        }

        // Wait for the style spec before adding sources/layers.
        //
        // Not `isStyleLoaded()`: that also waits for every source cache, so it
        // is false whenever tiles are in flight — which is exactly the case
        // right after the region pane has flown the map to the region. The
        // `style.load` fallback then never fires again (it only fires per
        // style) and the editor silently added no layers at all. `styledata`
        // repeats, so retrying on it always converges.
        let cleanup: (() => void) | undefined;

        const trySetup = () => {
            if (cleanup || !isStyleReady(raw)) return;
            cleanup = setup();
            raw.off("styledata", trySetup);
        };

        trySetup();
        if (!cleanup) raw.on("styledata", trySetup);

        return () => {
            raw.off("styledata", trySetup);
            cleanup?.();
        };
    }, [map, isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Keep sources in sync after React state updates ── */
    useEffect(() => {
        if (!map || !isEditing) return;
        const raw = getRaw(map);
        if (!raw.getSource("shape-poly")) return;
        updateSources(raw, vertices);
    }, [vertices]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Keep snapping data and visibility in sync ── */
    useEffect(() => {
        if (!map || !isEditing) return;
        const raw = getRaw(map);
        (raw.getSource("shape-snap-points") as any)?.setData(snapPoints);
    }, [isEditing, map, snapPoints]);

    useEffect(() => {
        if (!map || !isEditing) return;
        const raw = getRaw(map);
        if (raw.getLayer("shape-snap-points-layer")) {
            raw.setPaintProperty("shape-snap-points-layer", "circle-opacity", snapEnabled ? 0.55 : 0);
        }
        if (!snapEnabled) updateSnapTarget(raw, null);
    }, [isEditing, map, snapEnabled]);

    /* ── Vertex menu dismissal ── */
    useEffect(() => {
        if (!isEditing) setVertexMenu(null);
    }, [isEditing]);

    useEffect(() => {
        if (!vertexMenu) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (vertexMenuRef.current?.contains(event.target as Node)) return;
            setVertexMenu(null);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setVertexMenu(null);
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKey);
        };
    }, [vertexMenu]);

    function handleDeleteVertex(idx: number) {
        if (vertices.length <= MIN_VERTICES) return;
        const newVerts = vertices.filter((_, i) => i !== idx);
        vertsRef.current = newVerts;
        setVertices(newVerts);
        setVertexMenu(null);
    }

    function handleCancel() {
        stopEditing();
    }

    async function handleSave() {
        if (!regionId || isSaving) return;
        setIsSaving(true);
        try {
            // Convert back to DB format: [lng, lat] → [lat, lng]
            const dbPolygon = vertices.map(([lng, lat]) => [lat, lng] as [number, number]);
            await updateRegionPolygon(regionId, dbPolygon);
            toast.success("Form gespeichert. Gebäude- und Flächennutzungsdaten werden neu berechnet.");
            await queryClient.invalidateQueries({ queryKey: ["region", regionId] });
            await queryClient.invalidateQueries({ queryKey: ["regions_geojson"] });
            stopEditing();

            // Buildings + landuse werden serverseitig im Hintergrund per Overpass
            // neu berechnet. Nach ~8s noch einmal invalidieren, damit die UI die
            // fertigen Werte automatisch übernimmt.
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["region", regionId] });
            }, 8000);
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["region", regionId] });
            }, 30000);
        } catch (e: any) {
            toast.error(e?.message ?? "Fehler beim Speichern");
        } finally {
            setIsSaving(false);
        }
    }

    if (!isEditing) return null;

    const canDeleteVertex = vertices.length > MIN_VERTICES;

    return (
        <>
        {/* Floating toolbar — centered at the top of the map */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center gap-2">
                {/* Main toolbar */}
                <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 sm:gap-3 bg-neutral-950/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 sm:px-4 py-3 shadow-2xl">
                    <div className="size-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <MousePointerIcon size={13} className="text-violet-400" />
                    </div>
                    <div className="mr-1">
                        <p className="text-sm font-semibold text-white leading-none mb-0.5">Form bearbeiten</p>
                        <p className="text-[11px] text-neutral-500 leading-none">{vertices.length} Punkte</p>
                    </div>
                    <div className="w-px h-8 bg-white/10 mx-1" />
                    <button
                        type="button"
                        role="switch"
                        aria-checked={snapEnabled}
                        onClick={() => setSnapEnabled((enabled) => !enabled)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                            snapEnabled
                                ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-inset ring-cyan-400/25 hover:bg-cyan-500/20"
                                : "text-neutral-500 hover:text-white hover:bg-white/10",
                        )}
                        title="An Punkten anderer Regionen einrasten"
                    >
                        <MagnetIcon size={13} />
                        <span className="hidden sm:inline">Einrasten</span>
                        <span className={cn(
                            "size-1.5 rounded-full",
                            snapEnabled ? "bg-cyan-300" : "bg-neutral-600",
                        )} />
                    </button>
                    <button
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <XIcon size={13} />
                        Abbrechen
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                            isSaving
                                ? "bg-violet-500/40 text-violet-300 cursor-not-allowed"
                                : "bg-violet-600 hover:bg-violet-500 text-white"
                        )}
                    >
                        {isSaving
                            ? <LoaderIcon size={13} className="animate-spin" />
                            : <CheckIcon size={13} />
                        }
                        {isSaving ? "Speichern…" : "Speichern"}
                    </button>
                </div>

                {/* Interaction hint */}
                <div className="bg-neutral-950/75 backdrop-blur-md border border-white/[0.06] rounded-xl px-3.5 py-2">
                    <p className="text-[11px] text-neutral-500 text-center">
                        <span className="text-neutral-400">Ziehen</span> zum Verschieben
                        {" · "}
                        <span className="text-neutral-400">Klick auf Kante</span> zum Hinzufügen
                        {" · "}
                        <span className="text-neutral-400">Rechtsklick</span> zum Entfernen
                        {snapEnabled && (
                            <>
                                {" · "}
                                <span className="text-cyan-300/80">Magnet aktiv</span>
                            </>
                        )}
                    </p>
                </div>

            </div>
        </div>

        {/* Vertex context menu — right-click on a point */}
        {vertexMenu && (
            <div
                ref={vertexMenuRef}
                onContextMenu={(e) => e.preventDefault()}
                className="absolute z-50 min-w-[200px] rounded-xl bg-neutral-950/90 backdrop-blur-xl border border-white/[0.07] shadow-2xl overflow-hidden text-sm"
                style={{ left: vertexMenu.screenX, top: vertexMenu.screenY }}
            >
                <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2 text-neutral-400">
                    <MousePointerIcon size={13} className="text-violet-400" />
                    <span className="text-[11px]">Punkt {vertexMenu.idx + 1}</span>
                </div>
                <button
                    onClick={() => handleDeleteVertex(vertexMenu.idx)}
                    disabled={!canDeleteVertex}
                    title={canDeleteVertex ? undefined : `Mindestens ${MIN_VERTICES} Punkte erforderlich`}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-500/10 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                    <Trash2Icon size={14} className="text-red-400" />
                    <span className="text-neutral-200">Punkt löschen</span>
                </button>
            </div>
        )}
        </>
    );
}
