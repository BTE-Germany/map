import {create} from 'zustand'
import {devtools} from 'zustand/middleware'
import {LngLatBounds} from "maplibre-gl";


interface RegionPaneStore {
    open: boolean,
    region: any,
    openRegion: (region: string) => void,
    setOpen: (open: boolean) => void,
    setRegion: (region: any) => void,
    restoreBox: LngLatBounds | null
    setRestoreBox: (restoreBox: LngLatBounds) => void
}

const useRegionPane = create<RegionPaneStore>()(devtools((set) => ({
    open: false,
    region: null,
    openRegion: (region: string) => {
        set({region, open: true})
    },
    setOpen: (open: boolean) => set({open}),
    setRegion: (region: any) => set({region}),
    restoreBox: null,
    setRestoreBox: (restoreBox: LngLatBounds) => set({restoreBox})
})))

export default useRegionPane