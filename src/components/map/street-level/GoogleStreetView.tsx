"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { loadGoogleMaps } from "@/lib/googleMapsBrowser";
import useStreetLevelStore, { type StreetLevelLocation } from "@/stores/StreetLevelStore";

type GoogleStreetViewProps = {
    active: boolean;
    location: StreetLevelLocation;
    onLocationChange: (location: StreetLevelLocation) => void;
};

export default function GoogleStreetView({ active, location, onLocationChange }: GoogleStreetViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
    const initialLocationRef = useRef(location);
    const locationRef = useRef(location);
    const locationChangeRef = useRef(onLocationChange);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [error, setError] = useState("");

    useEffect(() => {
        locationChangeRef.current = onLocationChange;
    }, [onLocationChange]);

    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    useEffect(() => {
        if (!active) {
            return;
        }

        panoramaRef.current?.setPosition(locationRef.current);
    }, [active]);

    useEffect(() => {
        let cancelled = false;
        let positionListener: google.maps.MapsEventListener | null = null;

        const initialize = async () => {
            if (!containerRef.current) {
                return;
            }

            setStatus("loading");
            setError("");

            try {
                const maps = await loadGoogleMaps();
                const { StreetViewPanorama, StreetViewService, StreetViewPreference, StreetViewSource } =
                    await maps.importLibrary("streetView") as google.maps.StreetViewLibrary;

                const response = await new StreetViewService().getPanorama({
                    location: initialLocationRef.current,
                    radius: 250,
                    preference: StreetViewPreference.NEAREST,
                    source: StreetViewSource.OUTDOOR,
                });

                if (cancelled || !containerRef.current) {
                    return;
                }

                const panorama = panoramaRef.current ?? new StreetViewPanorama(containerRef.current, {
                    addressControl: true,
                    clickToGo: true,
                    disableDefaultUI: false,
                    fullscreenControl: false,
                    linksControl: true,
                    motionTracking: false,
                    motionTrackingControl: false,
                    panControl: true,
                    scrollwheel: true,
                    showRoadLabels: true,
                    zoomControl: true,
                });

                panoramaRef.current = panorama;
                panorama.setPano(response.data.location?.pano ?? undefined);
                panorama.setVisible(true);

                const panoramaLocation = response.data.location?.latLng;
                if (panoramaLocation && useStreetLevelStore.getState().provider === "google") {
                    locationChangeRef.current({
                        lat: panoramaLocation.lat(),
                        lng: panoramaLocation.lng(),
                    });
                }

                positionListener?.remove();
                positionListener = panorama.addListener("position_changed", () => {
                    if (!useStreetLevelStore.getState().isOpen || useStreetLevelStore.getState().provider !== "google") {
                        return;
                    }

                    const position = panorama.getPosition();
                    if (!position) {
                        return;
                    }

                    locationChangeRef.current({
                        lat: position.lat(),
                        lng: position.lng(),
                    });
                });

                setStatus("ready");
            } catch (reason) {
                if (cancelled) {
                    return;
                }

                setStatus("error");
                setError(reason instanceof Error ? reason.message : "An diesem Ort ist kein Google Street View verfügbar.");
            }
        };

        void initialize();

        return () => {
            cancelled = true;
            positionListener?.remove();
        };
    }, []);

    return (
        <div className="relative h-full w-full bg-neutral-950">
            <div ref={containerRef} className="h-full w-full" />
            {status !== "ready" ? (
                <div className="absolute inset-0 grid place-items-center bg-neutral-950 text-white">
                    <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
                        {status === "loading" ? (
                            <>
                                <Loader2 className="size-7 animate-spin text-blue-400" />
                                <p className="text-sm text-neutral-300">Google Street View wird geladen</p>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="size-7 text-amber-400" />
                                <p className="text-sm font-medium">Street View nicht verfügbar</p>
                                <p className="text-xs text-neutral-400">{error}</p>
                            </>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
