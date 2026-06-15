"use client";

import { useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import useStreetLevelStore, {
    type StreetLevelLocation,
    type StreetLevelProvider,
} from "@/stores/StreetLevelStore";
import GoogleStreetView from "./GoogleStreetView";
import AppleLookAround from "./AppleLookAround";

const PROVIDERS: Array<{ id: StreetLevelProvider; label: string; accent: string }> = [
    { id: "google", label: "Google Street View", accent: "bg-blue-500" },
    { id: "apple", label: "Apple Look Around", accent: "bg-white" },
];

function formatCoordinate(value: number) {
    return value.toFixed(6);
}

export default function StreetLevelExplorer() {
    const isOpen = useStreetLevelStore((state) => state.isOpen);
    const location = useStreetLevelStore((state) => state.location);
    const provider = useStreetLevelStore((state) => state.provider);
    const close = useStreetLevelStore((state) => state.close);
    const setProvider = useStreetLevelStore((state) => state.setProvider);
    const setLocation = useStreetLevelStore((state) => state.setLocation);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                close();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [close, isOpen]);

    const handleLocationChange = useCallback((nextLocation: StreetLevelLocation) => {
        const currentLocation = useStreetLevelStore.getState().location;
        if (
            currentLocation &&
            Math.abs(currentLocation.lat - nextLocation.lat) < 0.000001 &&
            Math.abs(currentLocation.lng - nextLocation.lng) < 0.000001
        ) {
            return;
        }

        setLocation(nextLocation);
    }, [setLocation]);

    const openExternal = () => {
        if (!location) {
            return;
        }

        const url = provider === "google"
            ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${location.lat},${location.lng}`
            : `https://maps.apple.com/?ll=${location.lat},${location.lng}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    return (
        <AnimatePresence>
            {isOpen && location ? (
                <motion.section
                    key="street-level-explorer"
                    className="fixed inset-0 z-[90] overflow-hidden bg-neutral-950 text-white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    aria-label="Straßenansicht"
                >
                    <div
                        className={cn(
                            "absolute inset-0 transition-opacity duration-200",
                            provider === "google" ? "z-10 opacity-100" : "pointer-events-none opacity-0",
                        )}
                        aria-hidden={provider !== "google"}
                    >
                        <GoogleStreetView
                            active={provider === "google"}
                            location={location}
                            onLocationChange={handleLocationChange}
                        />
                    </div>

                    <div
                        className={cn(
                            "absolute inset-0 transition-opacity duration-200",
                            provider === "apple" ? "z-10 opacity-100" : "pointer-events-none opacity-0",
                        )}
                        aria-hidden={provider !== "apple"}
                    >
                        <AppleLookAround
                            active={provider === "apple"}
                            location={location}
                            onLocationChange={handleLocationChange}
                        />
                    </div>

                    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
                        <div className="pointer-events-auto hidden items-center gap-2 rounded-2xl border border-white/10 bg-neutral-950/70 px-3 py-2 shadow-xl backdrop-blur-xl sm:flex">
                            <MapPin className="size-4 text-neutral-400" />
                            <span className="font-mono text-[11px] text-neutral-300">
                                {formatCoordinate(location.lat)}, {formatCoordinate(location.lng)}
                            </span>
                        </div>

                        <div className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 rounded-2xl border border-white/10 bg-neutral-950/75 p-1 shadow-2xl backdrop-blur-xl">
                            {PROVIDERS.map((item) => (
                                <button
                                    type="button"
                                    key={item.id}
                                    onClick={() => setProvider(item.id)}
                                    className={cn(
                                        "relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-400 transition-colors sm:px-4 sm:text-sm",
                                        provider === item.id && "bg-white/10 text-white",
                                    )}
                                    aria-pressed={provider === item.id}
                                >
                                    <span className={cn("size-2 rounded-full", item.accent)} />
                                    <span className="hidden sm:inline">{item.label}</span>
                                    <span className="sm:hidden">{item.id === "google" ? "Google" : "Apple"}</span>
                                </button>
                            ))}
                        </div>

                        <div className="pointer-events-auto ml-auto flex gap-2">
                            <button
                                type="button"
                                onClick={openExternal}
                                className="grid size-10 place-items-center rounded-xl border border-white/10 bg-neutral-950/70 text-neutral-300 shadow-xl backdrop-blur-xl transition-colors hover:bg-neutral-900 hover:text-white"
                                aria-label={`In ${provider === "google" ? "Google Maps" : "Apple Maps"} öffnen`}
                            >
                                <ExternalLink className="size-4" />
                            </button>
                            <button
                                type="button"
                                onClick={close}
                                className="grid size-10 place-items-center rounded-xl border border-white/10 bg-neutral-950/70 text-neutral-300 shadow-xl backdrop-blur-xl transition-colors hover:bg-neutral-900 hover:text-white"
                                aria-label="Straßenansicht schließen"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                    </div>
                </motion.section>
            ) : null}
        </AnimatePresence>
    );
}
