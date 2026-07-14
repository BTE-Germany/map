import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface SearchStore {
    open: boolean
    setOpen: (open: boolean) => void
    toggle: () => void
    mapTarget: SearchMapTarget | null
    setMapTarget: (target: SearchMapTarget) => void
    clearMapTarget: () => void
}

export interface SearchMapTarget {
    longitude: number
    latitude: number
    zoom: number
}

const useSearchStore = create<SearchStore>()(devtools((set) => ({
    open: false,
    setOpen: (open) => set({ open }),
    toggle: () => set((state) => ({ open: !state.open })),
    mapTarget: null,
    setMapTarget: (mapTarget) => set({ mapTarget }),
    clearMapTarget: () => set({ mapTarget: null }),
})))

export default useSearchStore
