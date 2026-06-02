import { create } from "zustand";

import type { MapStyleId } from "@/lib/mapStyles";

type MapStyleState = {
    styleId: MapStyleId;
    setStyleId: (styleId: MapStyleId) => void;
    hydrateStyleId: () => void;
};

const STORAGE_KEY = "map-style-id";

const parseStyleId = (value: string | null): MapStyleId | null => {
    if (value === "default" || value === "hybrid" || value === "satellite") {
        return value;
    }

    return null;
};

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
