import { create } from "zustand";

export type StreetLevelProvider = "google" | "apple";

export type StreetLevelLocation = {
    lat: number;
    lng: number;
};

type StreetLevelState = {
    isOpen: boolean;
    isSelecting: boolean;
    location: StreetLevelLocation | null;
    provider: StreetLevelProvider;
    startSelecting: () => void;
    cancelSelecting: () => void;
    openAt: (location: StreetLevelLocation, provider?: StreetLevelProvider) => void;
    close: () => void;
    setProvider: (provider: StreetLevelProvider) => void;
    setLocation: (location: StreetLevelLocation) => void;
};

const STORAGE_KEY = "street-level-provider";

function getStoredProvider(): StreetLevelProvider {
    if (typeof window === "undefined") {
        return "google";
    }

    return window.localStorage.getItem(STORAGE_KEY) === "apple" ? "apple" : "google";
}

const useStreetLevelStore = create<StreetLevelState>((set) => ({
    isOpen: false,
    isSelecting: false,
    location: null,
    provider: "google",
    startSelecting: () => set({
        isSelecting: true,
        isOpen: false,
        provider: getStoredProvider(),
    }),
    cancelSelecting: () => set({ isSelecting: false }),
    openAt: (location, provider) => set({
        isOpen: true,
        isSelecting: false,
        location,
        provider: provider ?? getStoredProvider(),
    }),
    close: () => set({ isOpen: false }),
    setProvider: (provider) => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, provider);
        }

        set({ provider });
    },
    setLocation: (location) => set({ location }),
}));

export default useStreetLevelStore;
