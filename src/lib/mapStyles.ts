/** Styles that get their own tile in the style picker. */
export type PrimaryMapStyleId = "default" | "hybrid" | "satellite";

export type MapStyleId = PrimaryMapStyleId | "monochrome";

export type MapStyleDefinition = {
    id: MapStyleId;
    label: string;
    style: string;
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

const defaultStyle = "https://tiles.dachstein.cloud/styles/btedarklight/style.json";
const monochromeStyle = "https://tiles.dachstein.cloud/styles/btemonodark/style.json";

const hybridStyle = "mapbox://styles/robinferch-bteg/cmmi8076c000y01s6hscq9xhi";
const satelliteStyle = "mapbox://styles/robinferch-bteg/cmmi82kwv003v01sb2v4yhree";

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

export const MAP_STYLES: MapStyleDefinition[] = [
    {
        id: "default",
        label: "Standard",
        variantLabel: "Farbig",
        style: defaultStyle,
        attributions: openMapTilesAttributions
    },
    {
        id: "monochrome",
        label: "Monochrom",
        variantLabel: "Monochrom",
        variantOf: "default",
        style: monochromeStyle,
        attributions: openMapTilesAttributions
    },
    {
        id: "hybrid",
        label: "Hybrid",
        style: hybridStyle,
        attributions: [
            {
                label: "© Mapbox",
                href: "https://www.mapbox.com/about/maps"
            },
            {
                label: "© OpenStreetMap contributors",
                href: "https://www.openstreetmap.org/copyright"
            },
            {
                label: "© Maxar",
                href: "https://www.maxar.com/copyright"
            }
        ]
    },
    {
        id: "satellite",
        label: "Satellit",
        style: satelliteStyle,
        attributions: [
            {
                label: "© Mapbox",
                href: "https://www.mapbox.com/about/maps"
            },
            {
                label: "© Maxar",
                href: "https://www.maxar.com/copyright"
            }
        ]
    }
];

/** The styles the picker shows as tiles — variants are folded into their parent. */
export const PRIMARY_MAP_STYLES = MAP_STYLES.filter(
    (style): style is MapStyleDefinition & { id: PrimaryMapStyleId } => !style.variantOf,
);

export function isMapStyleId(value: unknown): value is MapStyleId {
    return MAP_STYLES.some((style) => style.id === value);
}

export function getMapStyleById(styleId: MapStyleId): string {
    return MAP_STYLES.find((style) => style.id === styleId)?.style ?? MAP_STYLES[0].style;
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
