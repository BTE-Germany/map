"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CuboidIcon, AlertTriangleIcon } from "lucide-react";
import { loadGoogleMaps } from "@/lib/googleMapsBrowser";

type LatLng = [number, number]; // [lat, lng]

export default function Region3DMap({
    polygon,
    className,
}: {
    polygon: LatLng[];
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
        "idle",
    );
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    useEffect(() => {
        if (!apiKey) {
            setStatus("error");
            setErrorMsg("Google Maps API-Key fehlt");
            return;
        }
        if (!polygon?.length || !containerRef.current) return;

        let cancelled = false;
        setStatus("loading");
        setErrorMsg(null);

        loadGoogleMaps()
            .then(async (maps) => {
                if (cancelled || !containerRef.current) return;
                try {
                    const maps3d = await maps.importLibrary("maps3d") as any;
                    const { Map3DElement, Polygon3DElement, AltitudeMode } = maps3d;

                    // Compute centroid + range based on polygon bounding box.
                    const lats = polygon.map((p) => p[0]);
                    const lngs = polygon.map((p) => p[1]);
                    const minLat = Math.min(...lats);
                    const maxLat = Math.max(...lats);
                    const minLng = Math.min(...lngs);
                    const maxLng = Math.max(...lngs);

                    const center = {
                        lat: (minLat + maxLat) / 2,
                        lng: (minLng + maxLng) / 2,
                        altitude: 0,
                    };

                    // Meters per degree (rough) → diagonal in meters, camera
                    // distance roughly 2.2× that so the region fits nicely.
                    const latMeters = (maxLat - minLat) * 111_000;
                    const lngMeters =
                        (maxLng - minLng) *
                        111_000 *
                        Math.cos((center.lat * Math.PI) / 180);
                    const diag = Math.hypot(latMeters, lngMeters);
                    const range = Math.max(diag * 2.2, 400);

                    const map3d = new Map3DElement({
                        center,
                        mode: "HYBRID",
                        range,
                        tilt: 62,
                        heading: 20,
                    });
                    map3d.style.width = "100%";
                    map3d.style.height = "100%";
                    map3d.style.display = "block";

                    const poly = new Polygon3DElement({
                        strokeColor: "#22d3ee",
                        strokeWidth: 3,
                        fillColor: "rgba(34, 211, 238, 0.25)",
                        altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
                        extruded: false,
                    });
                    const coords = polygon.map(([lat, lng]) => ({
                        lat,
                        lng,
                        altitude: 0,
                    }));
                    // Close the ring if needed.
                    if (
                        coords.length > 0 &&
                        (coords[0].lat !== coords[coords.length - 1].lat ||
                            coords[0].lng !== coords[coords.length - 1].lng)
                    ) {
                        coords.push(coords[0]);
                    }
                    poly.outerCoordinates = coords;
                    map3d.append(poly);

                    containerRef.current.innerHTML = "";
                    containerRef.current.appendChild(map3d);

                    setStatus("ready");
                } catch (err: any) {
                    if (cancelled) return;
                    setStatus("error");
                    setErrorMsg(err?.message ?? "3D-Karte konnte nicht geladen werden");
                }
            })
            .catch((err) => {
                if (cancelled) return;
                setStatus("error");
                setErrorMsg(err?.message ?? "Google Maps konnte nicht geladen werden");
            });

        return () => {
            cancelled = true;
        };
    }, [apiKey, polygon]);

    return (
        <div className={className}>
            <div className="flex items-center gap-2 mb-3">
                <CuboidIcon size={12} className="text-amber-400" />
                <p className="uppercase text-neutral-500 text-[10px] font-semibold tracking-widest">
                    3D-Ansicht
                </p>
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded">
                    Plus
                </span>
            </div>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-900 border border-white/[0.06]">
                <div ref={containerRef} className="absolute inset-0" />
                {status === "loading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/60 text-neutral-400 text-xs gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        3D-Ansicht wird geladen…
                    </div>
                )}
                {status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 text-red-400 text-xs px-4 text-center">
                        <AlertTriangleIcon size={14} />
                        <span>{errorMsg ?? "3D-Ansicht nicht verfügbar"}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
