import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface SearchStore {
    open: boolean
    setOpen: (open: boolean) => void
    toggle: () => void
}

const useSearchStore = create<SearchStore>()(devtools((set) => ({
    open: false,
    setOpen: (open) => set({ open }),
    toggle: () => set((state) => ({ open: !state.open })),
})))

export default useSearchStore
