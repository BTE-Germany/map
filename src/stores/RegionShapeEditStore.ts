import { create } from "zustand";

// Internal format: [lng, lat] (MapLibre native)
type Vertex = [number, number];

interface RegionShapeEditStore {
    isEditing: boolean;
    regionId: string | null;
    vertices: Vertex[];
    startEditing: (regionId: string, dbPolygon: [number, number][]) => void;
    stopEditing: () => void;
    setVertices: (v: Vertex[]) => void;
}

const useRegionShapeEdit = create<RegionShapeEditStore>((set) => ({
    isEditing: false,
    regionId: null,
    vertices: [],
    startEditing: (regionId, dbPolygon) => set({
        isEditing: true,
        regionId,
        // DB stores [lat, lng] → convert to MapLibre [lng, lat]
        vertices: dbPolygon.map(([lat, lng]) => [lng, lat]),
    }),
    stopEditing: () => set({ isEditing: false, regionId: null, vertices: [] }),
    setVertices: (vertices) => set({ vertices }),
}));

export default useRegionShapeEdit;
