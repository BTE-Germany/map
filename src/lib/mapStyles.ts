/** Styles that get their own tile in the style picker. */
export type PrimaryMapStyleId = "default" | "hybrid" | "satellite";

export type MapStyleId = PrimaryMapStyleId | "monochrome";

/** `mapType` + layers of a Google Map Tiles session. */
export type GoogleMapType = "satellite" | "hybrid";

/**
 * Where a style's tiles come from.
 *
 * `url` styles are a plain style.json maplibre can load on its own. Google's
 * imagery has no style.json: it needs a session token before the first tile can
 * be requested, so those styles are assembled at runtime instead (see
 * `resolveGoogleMapStyle`).
 */
export type MapStyleSource =
    | { kind: "url"; url: string }
    | { kind: "google"; mapType: GoogleMapType };

export type MapStyleDefinition = {
    id: MapStyleId;
    label: string;
    source: MapStyleSource;
    attributions: MapAttributionLink[];
    /**
     * Marks this style as a different look at the same map as `variantOf`
     * rather than a map of its own. Variants share their parent's tile in the
     * picker and are chosen with a second, smaller control below it.
     */
    variantOf?: PrimaryMapStyleId;
    /** Short label for that control — only meaningful on a style family. */
    variantLabel?: string;
};

export type MapAttributionLink = {
    label: string;
    href: string;
};

/** The basemap the small non-interactive maps use — they never follow the picker. */
export const DEFAULT_MAP_STYLE_URL = "https://tiles.dachstein.cloud/styles/btedarklight/style.json";
const MONOCHROME_STYLE_URL = "https://tiles.dachstein.cloud/styles/btemonodark/style.json";

// Same tiles, same server, same licences — so the monochrome variant carries
// the default style's attributions verbatim.
const openMapTilesAttributions: MapAttributionLink[] = [
    {
        label: "© OpenMapTiles",
        href: "https://www.maptiler.com/copyright/"
    },
    {
        label: "© OpenStreetMap contributors",
        href: "https://www.openstreetmap.org/copyright"
    }
];

/**
 * Empty on purpose. Google's map renders its own logo, imagery credits and
 * terms link inside its container, which is what its terms require — repeating
 * them in our attribution line would only state them twice, and ours could go
 * stale as the imagery owners change with the viewport.
 */
const googleAttributions: MapAttributionLink[] = [];

export const MAP_STYLES: MapStyleDefinition[] = [
    {
        id: "default",
        label: "Standard",
        variantLabel: "Farbig",
        source: { kind: "url", url: DEFAULT_MAP_STYLE_URL },
        attributions: openMapTilesAttributions
    },
    {
        id: "monochrome",
        label: "Monochrom",
        variantLabel: "Monochrom",
        variantOf: "default",
        source: { kind: "url", url: MONOCHROME_STYLE_URL },
        attributions: openMapTilesAttributions
    },
    {
        id: "hybrid",
        label: "Hybrid",
        source: { kind: "google", mapType: "hybrid" },
        attributions: googleAttributions
    },
    {
        id: "satellite",
        label: "Satellit",
        source: { kind: "google", mapType: "satellite" },
        attributions: googleAttributions
    }
];

/** The styles the picker shows as tiles — variants are folded into their parent. */
export const PRIMARY_MAP_STYLES = MAP_STYLES.filter(
    (style): style is MapStyleDefinition & { id: PrimaryMapStyleId } => !style.variantOf,
);

export function isMapStyleId(value: unknown): value is MapStyleId {
    return MAP_STYLES.some((style) => style.id === value);
}

export function getMapStyleSource(styleId: MapStyleId): MapStyleSource {
    return MAP_STYLES.find((style) => style.id === styleId)?.source ?? MAP_STYLES[0].source;
}

export function getMapAttributionsById(styleId: MapStyleId): MapAttributionLink[] {
    return MAP_STYLES.find((style) => style.id === styleId)?.attributions ?? MAP_STYLES[0].attributions;
}

/** The tile a style belongs to: itself, or the style it is a variant of. */
export function getMapStyleFamily(styleId: MapStyleId): PrimaryMapStyleId {
    const style = MAP_STYLES.find((entry) => entry.id === styleId);
    return style?.variantOf ?? (style?.id as PrimaryMapStyleId | undefined) ?? "default";
}

/**
 * A style plus its variants, parent first. Returns an empty list when there is
 * nothing to choose between, so callers can hide the variant control entirely.
 */
export function getMapStyleVariants(familyId: PrimaryMapStyleId): MapStyleDefinition[] {
    const variants = MAP_STYLES.filter((style) => style.variantOf === familyId);
    if (variants.length === 0) return [];

    const parent = MAP_STYLES.find((style) => style.id === familyId);
    return parent ? [parent, ...variants] : variants;
}
