"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Layer, Map as MaplibreMap, Source } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { toast } from "sonner";
import {
    CheckCircle2Icon, CheckIcon, ClockIcon, LoaderIcon,
    MousePointerClickIcon, RotateCcwIcon, Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PlayerSearch from "@/components/admin/PlayerSearch";
import { createRegionByAdmin } from "@/actions/region/CreateRegion";
import { type Player } from "@/actions/minecraft/user";
import { getMapStyleById } from "@/lib/mapStyles";

const MAP_STYLE = getMapStyleById("default");
const VERTEX_HIT_RADIUS_PX = 10;

const TYPE_OPTIONS = [
    { value: "default", label: "Standard" },
    { value: "plot", label: "Plot" },
    { value: "event", label: "Event" },
] as const;

type RegionType = (typeof TYPE_OPTIONS)[number]["value"];
type Vertex = [number, number]; // [lng, lat]

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] };

export default function CreateRegionForm() {
    const router = useRouter();
    const [points, setPoints] = useState<Vertex[]>([]);
    const [creator, setCreator] = useState<Player | null>(null);
    const [type, setType] = useState<RegionType>("default");
    const [finished, setFinished] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Kept in a ref so the (stable) map click handler always sees the latest
    // points without re-binding the listener on every render.
    const pointsRef = useRef<Vertex[]>(points);
    useEffect(() => { pointsRef.current = points; }, [points]);

    const handleMapClick = useCallback((e: any) => {
        const map = e.target;
        const clickPx = e.point;

        // Clicking (near) an existing vertex removes it; otherwise add a point.
        let removeIdx = -1;
        for (let i = 0; i < pointsRef.current.length; i++) {
            const projected = map.project(pointsRef.current[i]);
            const distance = Math.hypot(projected.x - clickPx.x, projected.y - clickPx.y);
            if (distance <= VERTEX_HIT_RADIUS_PX) { removeIdx = i; break; }
        }

        if (removeIdx >= 0) {
            setPoints((prev) => prev.filter((_, i) => i !== removeIdx));
        } else {
            setPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
        }
    }, []);

    const onMapLoad = useCallback((e: any) => {
        e.target.getCanvas().style.cursor = "crosshair";
    }, []);

    const { verticesData, lineData, fillData } = useMemo(() => {
        const vertices = {
            type: "FeatureCollection" as const,
            features: points.map((p, i) => ({
                type: "Feature" as const,
                geometry: { type: "Point" as const, coordinates: p },
                properties: { idx: i },
            })),
        };
        const line = points.length >= 2
            ? {
                type: "FeatureCollection" as const,
                features: [{
                    type: "Feature" as const,
                    geometry: {
                        type: "LineString" as const,
                        coordinates: points.length >= 3 ? [...points, points[0]] : points,
                    },
                    properties: {},
                }],
            }
            : EMPTY_FC;
        const fill = points.length >= 3
            ? {
                type: "FeatureCollection" as const,
                features: [{
                    type: "Feature" as const,
                    geometry: { type: "Polygon" as const, coordinates: [[...points, points[0]]] },
                    properties: {},
                }],
            }
            : EMPTY_FC;
        return { verticesData: vertices, lineData: line, fillData: fill };
    }, [points]);

    const canSubmit = !!creator && points.length >= 3 && !isSubmitting;

    async function handleSubmit() {
        if (!creator || points.length < 3 || isSubmitting) return;
        setIsSubmitting(true);
        try {
            // Convert map coords [lng, lat] → DB format [lat, lng].
            const polygon = points.map(([lng, lat]) => [lat, lng] as [number, number]);
            const { id } = await createRegionByAdmin({
                polygon,
                creatorUUID: creator.raw_id,
                type,
                finished,
            });
            toast.success("Region erstellt. Gebäude- und Flächennutzungsdaten werden im Hintergrund berechnet.");
            router.push(`/region/${id}`);
        } catch (e: any) {
            toast.error(e?.message ?? "Fehler beim Erstellen");
            setIsSubmitting(false);
        }
    }

    return (
        <div className="max-w-3xl space-y-6">
            {/* Map / polygon editor */}
            <section className="space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Polygon</h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {points.length} {points.length === 1 ? "Punkt" : "Punkte"}
                    </span>
                </div>
                <div className="relative h-[460px] rounded-xl border border-border overflow-hidden">
                    <MaplibreMap
                        initialViewState={{ longitude: 10.447683, latitude: 51.163361, zoom: 6 }}
                        mapLib={maplibregl as any}
                        mapStyle={MAP_STYLE}
                        attributionControl={false}
                        onLoad={onMapLoad}
                        onClick={handleMapClick}
                        style={{ width: "100%", height: "100%" }}
                    >
                        <Source id="draw-fill" type="geojson" data={fillData as any}>
                            <Layer id="draw-fill-layer" type="fill" paint={{ "fill-color": "#a78bfa", "fill-opacity": 0.25 }} />
                        </Source>
                        <Source id="draw-line" type="geojson" data={lineData as any}>
                            <Layer id="draw-line-layer" type="line"
                                paint={{ "line-color": "#a78bfa", "line-width": 2, "line-dasharray": [4, 2] }} />
                        </Source>
                        <Source id="draw-vertices" type="geojson" data={verticesData as any}>
                            <Layer id="draw-vertices-layer" type="circle"
                                paint={{
                                    "circle-radius": 6,
                                    "circle-color": "#fff",
                                    "circle-stroke-width": 2.5,
                                    "circle-stroke-color": "#7c3aed",
                                }} />
                        </Source>
                    </MaplibreMap>

                    {/* Controls overlay */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-neutral-950/85 backdrop-blur border border-white/10 px-3 py-2 text-[11px] text-neutral-400">
                            <MousePointerClickIcon size={13} className="text-violet-400" />
                            Klicken zum Setzen · Punkt anklicken zum Entfernen
                        </div>
                        <div className="pointer-events-auto flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setPoints((prev) => prev.slice(0, -1))}
                                disabled={points.length === 0}
                                className="flex items-center gap-1.5 rounded-lg bg-neutral-950/85 backdrop-blur border border-white/10 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <RotateCcwIcon size={13} />
                                <span className="hidden sm:inline">Rückgängig</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPoints([])}
                                disabled={points.length === 0}
                                className="flex items-center gap-1.5 rounded-lg bg-neutral-950/85 backdrop-blur border border-white/10 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <Trash2Icon size={13} />
                                <span className="hidden sm:inline">Zurücksetzen</span>
                            </button>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    Stadt, Bundesland, Adresse und Fläche werden nach dem Speichern automatisch anhand des Polygons ermittelt.
                </p>
            </section>

            {/* Creator */}
            <section className="rounded-xl border border-border bg-card p-5 space-y-3">
                <PlayerSearch label="Ersteller" value={creator} onSelect={setCreator} />
            </section>

            {/* Type & status */}
            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typ</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {TYPE_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setType(opt.value)}
                                className={cn(
                                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all text-center",
                                    type === opt.value
                                        ? "border-primary/40 bg-primary/10 text-primary"
                                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setFinished((f) => !f)}
                    className={cn(
                        "w-full flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all",
                        finished
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-border bg-muted/20 hover:bg-muted/30"
                    )}
                >
                    <div className={cn(
                        "flex items-center justify-center size-8 rounded-full shrink-0 transition-colors",
                        finished ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
                    )}>
                        {finished ? <CheckCircle2Icon size={16} /> : <ClockIcon size={16} />}
                    </div>
                    <div className="flex-1">
                        <p className={cn("text-sm font-semibold", finished ? "text-emerald-400" : "text-foreground")}>
                            {finished ? "Fertiggestellt" : "In Arbeit"}
                        </p>
                    </div>
                    <div className={cn(
                        "relative h-5 w-9 rounded-full transition-colors shrink-0",
                        finished ? "bg-emerald-500" : "bg-muted-foreground/30"
                    )}>
                        <span className={cn(
                            "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
                            finished ? "left-[calc(100%-1.125rem)]" : "left-0.5"
                        )} />
                    </div>
                </button>
            </section>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3">
                {!creator && (
                    <p className="text-xs text-muted-foreground mr-auto">Bitte einen Ersteller auswählen.</p>
                )}
                {creator && points.length < 3 && (
                    <p className="text-xs text-muted-foreground mr-auto">Bitte mindestens 3 Punkte setzen.</p>
                )}
                <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="gap-1.5 min-w-[140px]"
                >
                    {isSubmitting ? (
                        <><LoaderIcon size={13} className="animate-spin" />Erstelle…</>
                    ) : (
                        <><CheckIcon size={13} />Region erstellen</>
                    )}
                </Button>
            </div>
        </div>
    );
}
