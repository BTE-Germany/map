import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type BoundsTuple = [number, number, number, number];

interface RegionPaneStore {
    open: boolean,
    region: any,
    openRegion: (region: string) => void,
    setOpen: (open: boolean) => void,
    setRegion: (region: any) => void,
    restoreBox: BoundsTuple | null
    setRestoreBox: (restoreBox: BoundsTuple) => void
}

const useRegionPane = create<RegionPaneStore>()(devtools((set) => ({
    open: false,
    region: null,
    openRegion: (region: string) => {
        set({ region, open: true })
    },
    setOpen: (open: boolean) => set({ open }),
    setRegion: (region: any) => set({ region }),
    restoreBox: null,
    setRestoreBox: (restoreBox: BoundsTuple) => set({ restoreBox })
})))

export default useRegionPane