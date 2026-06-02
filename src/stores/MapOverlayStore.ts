import { create } from "zustand";

type MapOverlayState = {
    hidePlayers: boolean;
    togglePlayers: () => void;
    setHidePlayers: (hide: boolean) => void;
};

const useMapOverlayStore = create<MapOverlayState>((set) => ({
    hidePlayers: false,
    togglePlayers: () => set((s) => ({ hidePlayers: !s.hidePlayers })),
    setHidePlayers: (hidePlayers) => set({ hidePlayers }),
}));

export default useMapOverlayStore;
