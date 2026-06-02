"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import type maplibregl from "maplibre-gl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderIcon, CheckIcon, XIcon, MousePointerIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import useRegionShapeEdit from "@/stores/RegionShapeEditStore";
import { updateRegionPolygon } from "@/actions/region/UpdateRegionPolygon";

type Vertex = [number, number]; // [lng, lat]

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

/* ── Raw map helper ───────────────────────────────────────────── */

// vis.gl MapRef proxies most methods, but for imperative GL calls
// (addSource / addLayer / getSource etc.) we need the raw instance.
function getRaw(mapRef: any): maplibregl.Map {
    return typeof mapRef.getMap === "function" ? mapRef.getMap() : mapRef;
}

/* ── Layer / source helpers ───────────────────────────────────── */

const SOURCES = ["shape-poly", "shape-verts", "shape-mids"] as const;
const LAYERS = ["shape-fill", "shape-line", "shape-mids-layer", "shape-verts-layer"] as const;

function updateSources(raw: maplibregl.Map, verts: Vertex[]) {
    (raw.getSource("shape-poly") as any)?.setData(polyGeoJSON(verts));
    (raw.getSource("shape-verts") as any)?.setData(verticesGeoJSON(verts));
    (raw.getSource("shape-mids") as any)?.setData(midpointsGeoJSON(verts));
}

function addLayersToMap(raw: maplibregl.Map, verts: Vertex[]) {
    raw.addSource("shape-poly", { type: "geojson", data: polyGeoJSON(verts) as any });
    raw.addSource("shape-verts", { type: "geojson", data: verticesGeoJSON(verts) as any });
    raw.addSource("shape-mids", { type: "geojson", data: midpointsGeoJSON(verts) as any });

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
}

function removeLayersFromMap(raw: maplibregl.Map) {
    LAYERS.forEach((l) => { if (raw.getLayer(l)) raw.removeLayer(l); });
    SOURCES.forEach((s) => { if (raw.getSource(s)) raw.removeSource(s); });
}

/* ── Main component ───────────────────────────────────────────── */

export default function RegionShapeEditor() {
    const { mainMap: map } = useMap();
    const { isEditing, regionId, vertices, stopEditing, setVertices } = useRegionShapeEdit();
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);

    // Refs for use inside event handlers (avoid stale closures)
    const vertsRef = useRef<Vertex[]>(vertices);
    const draggingIdxRef = useRef<number | null>(null);

    useEffect(() => { vertsRef.current = vertices; }, [vertices]);

    /* ── Setup / teardown map layers ── */
    useEffect(() => {
        if (!map || !isEditing || vertices.length === 0) return;

        const raw = getRaw(map);

        function setup() {
            addLayersToMap(raw, vertsRef.current);

            /* Vertex drag */
            const onVertexDown = (e: any) => {
                e.preventDefault();
                const idx = e.features?.[0]?.properties?.idx;
                if (idx == null) return;
                draggingIdxRef.current = Number(idx);
                raw.dragPan.disable();
                raw.getCanvas().style.cursor = "grabbing";
            };

            const onMouseMove = (e: any) => {
                if (draggingIdxRef.current === null) return;
                const newVerts = [...vertsRef.current] as Vertex[];
                newVerts[draggingIdxRef.current] = [e.lngLat.lng, e.lngLat.lat];
                vertsRef.current = newVerts;
                updateSources(raw, newVerts);
            };

            const onMouseUp = () => {
                if (draggingIdxRef.current === null) return;
                setVertices([...vertsRef.current]);
                draggingIdxRef.current = null;
                raw.dragPan.enable();
                raw.getCanvas().style.cursor = "";
            };

            /* Midpoint click → insert vertex */
            const onMidClick = (e: any) => {
                if (draggingIdxRef.current !== null) return;
                const afterIdx = e.features?.[0]?.properties?.afterIdx;
                if (afterIdx == null) return;
                const insertAt = Number(afterIdx) + 1;
                const lngLat: Vertex = [e.lngLat.lng, e.lngLat.lat];
                const newVerts = [...vertsRef.current];
                newVerts.splice(insertAt, 0, lngLat);
                vertsRef.current = newVerts;
                setVertices(newVerts);
            };

            /* Vertex double-click → delete */
            const onVertexDblClick = (e: any) => {
                if (vertsRef.current.length <= 3) return;
                const idx = e.features?.[0]?.properties?.idx;
                if (idx == null) return;
                const newVerts = vertsRef.current.filter((_, i) => i !== Number(idx));
                vertsRef.current = newVerts;
                setVertices(newVerts);
            };

            /* Cursors */
            const grabCursor = () => { if (draggingIdxRef.current === null) raw.getCanvas().style.cursor = "grab"; };
            const crossCursor = () => { if (draggingIdxRef.current === null) raw.getCanvas().style.cursor = "copy"; };
            const resetCursor = () => { if (draggingIdxRef.current === null) raw.getCanvas().style.cursor = ""; };

            raw.on("mousedown", "shape-verts-layer", onVertexDown);
            raw.on("mousemove", onMouseMove);
            raw.on("mouseup", onMouseUp);
            raw.on("click", "shape-mids-layer", onMidClick);
            raw.on("dblclick", "shape-verts-layer", onVertexDblClick);
            raw.on("mouseenter", "shape-verts-layer", grabCursor);
            raw.on("mouseleave", "shape-verts-layer", resetCursor);
            raw.on("mouseenter", "shape-mids-layer", crossCursor);
            raw.on("mouseleave", "shape-mids-layer", resetCursor);

            return () => {
                raw.off("mousedown", "shape-verts-layer", onVertexDown);
                raw.off("mousemove", onMouseMove);
                raw.off("mouseup", onMouseUp);
                raw.off("click", "shape-mids-layer", onMidClick);
                raw.off("dblclick", "shape-verts-layer", onVertexDblClick);
                raw.off("mouseenter", "shape-verts-layer", grabCursor);
                raw.off("mouseleave", "shape-verts-layer", resetCursor);
                raw.off("mouseenter", "shape-mids-layer", crossCursor);
                raw.off("mouseleave", "shape-mids-layer", resetCursor);
                removeLayersFromMap(raw);
                raw.getCanvas().style.cursor = "";
                raw.dragPan.enable();
            };
        }

        // Wait for style to be ready before adding sources/layers
        if (raw.isStyleLoaded()) {
            const cleanup = setup();
            return cleanup;
        } else {
            let cleanup: (() => void) | undefined;
            const onStyleLoad = () => { cleanup = setup(); };
            raw.once("style.load", onStyleLoad);
            return () => {
                raw.off("style.load", onStyleLoad);
                cleanup?.();
            };
        }
    }, [map, isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Keep sources in sync after React state updates ── */
    useEffect(() => {
        if (!map || !isEditing) return;
        const raw = getRaw(map);
        if (!raw.getSource("shape-poly")) return;
        updateSources(raw, vertices);
    }, [vertices]); // eslint-disable-line react-hooks/exhaustive-deps

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

    return (
        /* Floating toolbar — centered at the top of the map */
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center gap-2">
                {/* Main toolbar */}
                <div className="flex items-center gap-3 bg-neutral-950/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-2xl">
                    <div className="size-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <MousePointerIcon size={13} className="text-violet-400" />
                    </div>
                    <div className="mr-1">
                        <p className="text-sm font-semibold text-white leading-none mb-0.5">Form bearbeiten</p>
                        <p className="text-[11px] text-neutral-500 leading-none">{vertices.length} Punkte</p>
                    </div>
                    <div className="w-px h-8 bg-white/10 mx-1" />
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
                        <span className="text-neutral-400">Doppelklick</span> zum Entfernen
                    </p>
                </div>

            </div>
        </div>
    );
}
