"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { loadAppleMapKit } from "@/lib/appleMapKit";
import type { StreetLevelLocation } from "@/stores/StreetLevelStore";

type AppleLookAroundProps = {
    active: boolean;
    location: StreetLevelLocation;
    onLocationChange: (location: StreetLevelLocation) => void;
};

function distanceInMeters(a: StreetLevelLocation, b: StreetLevelLocation) {
    const latitudeMeters = (a.lat - b.lat) * 111_320;
    const longitudeMeters =
        (a.lng - b.lng) *
        111_320 *
        Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);

    return Math.hypot(latitudeMeters, longitudeMeters);
}

export default function AppleLookAround({
    active,
    location,
    onLocationChange,
}: AppleLookAroundProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef(active);
    const locationRef = useRef(location);
    const locationChangeRef = useRef(onLocationChange);
    const viewerLocationRef = useRef<StreetLevelLocation>(location);
    const lastReportedLocationRef = useRef<StreetLevelLocation | null>(null);
    const suppressReportingRef = useRef(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [error, setError] = useState("");

    useEffect(() => {
        activeRef.current = active;
    }, [active]);

    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    useEffect(() => {
        locationChangeRef.current = onLocationChange;
    }, [onLocationChange]);

    useEffect(() => {
        if (
            active &&
            distanceInMeters(viewerLocationRef.current, locationRef.current) >= 2
        ) {
            suppressReportingRef.current = true;
            lastReportedLocationRef.current = null;
            setReloadKey((current) => current + 1);
        }
    }, [active]);

    useEffect(() => {
        let cancelled = false;
        let lookAround: MapKitLookAround | null = null;
        let locationTimer: number | null = null;

        const reportCurrentLocation = () => {
            if (!activeRef.current || suppressReportingRef.current || !lookAround) {
                return;
            }

            const coordinate = lookAround.scene?.coordinate ?? lookAround.centerCoordinate;
            if (!coordinate) {
                return;
            }

            const nextLocation = {
                lat: coordinate.latitude,
                lng: coordinate.longitude,
            };
            const previousLocation = lastReportedLocationRef.current;
            if (previousLocation && distanceInMeters(previousLocation, nextLocation) < 0.75) {
                return;
            }

            lastReportedLocationRef.current = nextLocation;
            viewerLocationRef.current = nextLocation;
            locationChangeRef.current(nextLocation);
        };

        const initialize = async () => {
            if (!containerRef.current) {
                return;
            }

            setStatus("loading");
            setError("");
            containerRef.current.replaceChildren();

            try {
                const mapkit = await loadAppleMapKit();
                if (cancelled || !containerRef.current) {
                    return;
                }

                const requestedLocation = locationRef.current;
                viewerLocationRef.current = requestedLocation;
                const coordinate = new mapkit.Coordinate(
                    requestedLocation.lat,
                    requestedLocation.lng,
                );
                lookAround = new mapkit.LookAround(containerRef.current, coordinate, {
                    isNavigationEnabled: true,
                    isScrollEnabled: true,
                    isZoomEnabled: true,
                    showsCloseControl: false,
                    showsDialogControl: false,
                    showsPointsOfInterest: true,
                    showsRoadLabels: true,
                });

                lookAround.addEventListener("load", () => {
                    if (!cancelled) {
                        suppressReportingRef.current = false;
                        setStatus("ready");
                        reportCurrentLocation();
                        locationTimer = window.setInterval(reportCurrentLocation, 200);
                    }
                }, { once: true });

                lookAround.addEventListener("error", (event) => {
                    if (cancelled) {
                        return;
                    }

                    const message = "message" in event && typeof event.message === "string"
                        ? event.message
                        : "An diesem Ort ist kein Apple Look Around verfügbar.";
                    setError(message);
                    setStatus("error");
                }, { once: true });
            } catch (reason) {
                if (cancelled) {
                    return;
                }

                setError(reason instanceof Error ? reason.message : "Apple Look Around konnte nicht geladen werden.");
                setStatus("error");
            }
        };

        void initialize();

        return () => {
            cancelled = true;
            if (locationTimer !== null) {
                window.clearInterval(locationTimer);
            }
            lookAround?.destroy();
        };
    }, [reloadKey]);

    return (
        <div className="relative h-full w-full bg-neutral-950">
            <div ref={containerRef} className="h-full w-full" />
            {status !== "ready" ? (
                <div className="absolute inset-0 grid place-items-center bg-neutral-950 text-white">
                    <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
                        {status === "loading" ? (
                            <>
                                <Loader2 className="size-7 animate-spin text-neutral-200" />
                                <p className="text-sm text-neutral-300">Apple Look Around wird geladen</p>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="size-7 text-amber-400" />
                                <p className="text-sm font-medium">Look Around nicht verfügbar</p>
                                <p className="text-xs text-neutral-400">{error}</p>
                            </>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
