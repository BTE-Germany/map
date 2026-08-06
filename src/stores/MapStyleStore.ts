import { create } from "zustand";

import { isMapStyleId, type MapStyleId } from "@/lib/mapStyles";

type MapStyleState = {
    styleId: MapStyleId;
    setStyleId: (styleId: MapStyleId) => void;
    hydrateStyleId: () => void;
};

const STORAGE_KEY = "map-style-id";

// Validated against the style list itself so adding a style can't leave a
// stale allow-list behind that silently drops it on reload.
const parseStyleId = (value: string | null): MapStyleId | null =>
    isMapStyleId(value) ? value : null;

const useMapStyleStore = create<MapStyleState>((set) => ({
    styleId: "default",
    setStyleId: (styleId) => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, styleId);
        }

        set({ styleId });
    },
    hydrateStyleId: () => {
        if (typeof window === "undefined") {
            return;
        }

        const parsedStyleId = parseStyleId(window.localStorage.getItem(STORAGE_KEY));
        if (!parsedStyleId) {
            return;
        }

        set({ styleId: parsedStyleId });
    }
}));

export default useMapStyleStore;
