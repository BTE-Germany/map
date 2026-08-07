import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type AreaUnitMode = "simple" | "full";
// simple: m² only + km² above 100 000 m²
// full:   m² → ha (≥10 000) → km² (≥1 000 000)

/** The four categories the map paints region polygons by. */
export type RegionColorKey = "finished" | "inProgress" | "plot" | "event";

export type RegionColors = Record<RegionColorKey, string>;

/** The palette the map has always used — and the reset target. */
export const DEFAULT_REGION_COLORS: RegionColors = {
    finished: "#22c55e",
    inProgress: "#f97316",
    plot: "#3b82f6",
    event: "#ef4444",
};

export const REGION_COLOR_KEYS = Object.keys(DEFAULT_REGION_COLORS) as RegionColorKey[];

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: string): boolean {
    return HEX_COLOR_RE.test(value.trim());
}

/** `#abc` → `#aabbcc`, so the store only ever holds what `<input type="color">` accepts. */
function expandHex(hex: string): string {
    if (hex.length !== 4) return hex;
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

/**
 * Fills in missing keys and drops anything that isn't a hex colour.
 *
 * Persisted state is only as trustworthy as localStorage: a hand-edited or
 * half-migrated entry must not reach the map, where an unparsable colour makes
 * maplibre reject the whole paint expression and every region disappears.
 */
export function normalizeRegionColors(colors: unknown): RegionColors {
    const source = (colors ?? {}) as Partial<Record<RegionColorKey, unknown>>;
    const normalized = { ...DEFAULT_REGION_COLORS };

    for (const key of REGION_COLOR_KEYS) {
        const value = source[key];
        if (typeof value === "string" && HEX_COLOR_RE.test(value.trim())) {
            normalized[key] = expandHex(value.trim().toLowerCase());
        }
    }

    return normalized;
}

export function isDefaultRegionColors(colors: RegionColors): boolean {
    return REGION_COLOR_KEYS.every((key) => colors[key] === DEFAULT_REGION_COLORS[key]);
}

export interface UserSettings {
    areaUnit: AreaUnitMode;
    show3DMap: boolean;
    regionColors: RegionColors;
}

interface UserSettingsStore extends UserSettings {
    setAreaUnit: (mode: AreaUnitMode) => void;
    setShow3DMap: (v: boolean) => void;
    setRegionColor: (key: RegionColorKey, color: string) => void;
    resetRegionColors: () => void;
}

const useUserSettings = create<UserSettingsStore>()(
    devtools(
        persist(
            (set) => ({
                areaUnit: "simple",
                show3DMap: false,
                regionColors: DEFAULT_REGION_COLORS,
                setAreaUnit: (areaUnit) => set({ areaUnit }),
                setShow3DMap: (show3DMap) => set({ show3DMap }),
                // Anything that isn't a hex colour leaves the palette alone —
                // reverting the key to its default would be a surprising answer
                // to a bad argument.
                setRegionColor: (key, color) => set((state) => isHexColor(color)
                    ? { regionColors: normalizeRegionColors({ ...state.regionColors, [key]: color }) }
                    : state),
                resetRegionColors: () => set({ regionColors: DEFAULT_REGION_COLORS }),
            }),
            {
                name: "user-settings",
                // The stored entry predates `regionColors` for every existing
                // visitor, and a stored palette would otherwise replace the
                // defaults wholesale — including any key added later.
                merge: (persisted, current) => {
                    const merged = { ...current, ...(persisted as Partial<UserSettingsStore> | undefined) };
                    return { ...merged, regionColors: normalizeRegionColors(merged.regionColors) };
                },
            }
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
