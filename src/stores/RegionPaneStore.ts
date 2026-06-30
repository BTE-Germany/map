import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type BoundsTuple = [number, number, number, number];

interface RegionPaneStore {
    open: boolean,
    /** The id of the region whose pane is open (null when closed). */
    region: string | null,
    openRegion: (regionId: string) => void,
    setOpen: (open: boolean) => void,
    setRegion: (regionId: string) => void,
    restoreBox: BoundsTuple | null
    setRestoreBox: (restoreBox: BoundsTuple) => void
}

const useRegionPane = create<RegionPaneStore>()(devtools((set) => ({
    open: false,
    region: null,
    openRegion: (regionId: string) => {
        set({ region: regionId, open: true })
    },
    setOpen: (open: boolean) => set({ open }),
    setRegion: (regionId: string) => set({ region: regionId }),
    restoreBox: null,
    setRestoreBox: (restoreBox: BoundsTuple) => set({ restoreBox })
})))

export default useRegionPane
