"use client";

import { useEffect } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { MapPin, X } from "lucide-react";
import useStreetLevelStore from "@/stores/StreetLevelStore";

export default function StreetLevelPicker() {
    const { mainMap: map } = useMap();
    const isSelecting = useStreetLevelStore((state) => state.isSelecting);
    const openAt = useStreetLevelStore((state) => state.openAt);
    const cancelSelecting = useStreetLevelStore((state) => state.cancelSelecting);

    useEffect(() => {
        if (!map || !isSelecting) {
            return;
        }

        const canvas = map.getCanvas();
        const previousCursor = canvas.style.cursor;
        canvas.style.cursor = "crosshair";

        const handleClick = (event: { lngLat: { lat: number; lng: number } }) => {
            openAt({ lat: event.lngLat.lat, lng: event.lngLat.lng });
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                cancelSelecting();
            }
        };

        map.once("click", handleClick);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            canvas.style.cursor = previousCursor;
            map.off("click", handleClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [cancelSelecting, isSelecting, map, openAt]);

    if (!isSelecting) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-[55] flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-950/85 px-4 py-3 text-white shadow-2xl backdrop-blur-xl">
                <div className="grid size-8 place-items-center rounded-xl bg-blue-500/15 text-blue-300">
                    <MapPin className="size-4" />
                </div>
                <div>
                    <p className="text-sm font-semibold">Straßenansicht öffnen</p>
                    <p className="text-xs text-neutral-400">Wähle einen Ort auf der Karte aus.</p>
                </div>
                <button
                    type="button"
                    onClick={cancelSelecting}
                    className="ml-2 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Standortauswahl abbrechen"
                >
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
}
