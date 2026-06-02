import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type AreaUnitMode = "simple" | "full";
// simple: m² only + km² above 100 000 m²
// full:   m² → ha (≥10 000) → km² (≥1 000 000)

export interface UserSettings {
    areaUnit: AreaUnitMode;
    show3DMap: boolean;
}

interface UserSettingsStore extends UserSettings {
    setAreaUnit: (mode: AreaUnitMode) => void;
    setShow3DMap: (v: boolean) => void;
}

const useUserSettings = create<UserSettingsStore>()(
    devtools(
        persist(
            (set) => ({
                areaUnit: "simple",
                show3DMap: false,
                setAreaUnit: (areaUnit) => set({ areaUnit }),
                setShow3DMap: (show3DMap) => set({ show3DMap }),
            }),
            { name: "user-settings" }
        ),
        { name: "UserSettings" }
    )
);

export default useUserSettings;

/** Shared helper – format an area value according to the user's unit preference. */
export function formatAreaWithMode(
    n: number,
    mode: AreaUnitMode
): { value: string; unit: string } {
    if (mode === "full") {
        if (n >= 1_000_000) return { value: (n / 1_000_000).toFixed(2), unit: "km²" };
        if (n >= 10_000) return { value: (n / 10_000).toFixed(1), unit: "ha" };
        return { value: n.toLocaleString("de-DE"), unit: "m²" };
    }
    // simple
    if (n >= 100_000) return { value: (n / 1_000_000).toFixed(2), unit: "km²" };
    return { value: n.toLocaleString("de-DE"), unit: "m²" };
}
