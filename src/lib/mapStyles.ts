export type MapStyleId = "default" | "hybrid" | "satellite";

export type MapStyleDefinition = {
    id: MapStyleId;
    label: string;
    style: string;
    attributions: MapAttributionLink[];
};

export type MapAttributionLink = {
    label: string;
    href: string;
};

const defaultStyle = "https://gist.githubusercontent.com/Nachwahl/7d0969c76922fb5025dac7358fbf9c74/raw/04a9bdfb631784bc6d256e4c6e8c68cef7bbf474/gistfile1.txt";

const hybridStyle = "mapbox://styles/robinferch-bteg/cmmi8076c000y01s6hscq9xhi";
const satelliteStyle = "mapbox://styles/robinferch-bteg/cmmi82kwv003v01sb2v4yhree";

export const MAP_STYLES: MapStyleDefinition[] = [
    {
        id: "default",
        label: "Standard",
        style: defaultStyle,
        attributions: [
            {
                label: "© OpenMapTiles",
                href: "https://www.maptiler.com/copyright/"
            },
            {
                label: "© OpenStreetMap contributors",
                href: "https://www.openstreetmap.org/copyright"
            }
        ]
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

export function getMapStyleById(styleId: MapStyleId): string {
    return MAP_STYLES.find((style) => style.id === styleId)?.style ?? MAP_STYLES[0].style;
}

export function getMapAttributionsById(styleId: MapStyleId): MapAttributionLink[] {
    return MAP_STYLES.find((style) => style.id === styleId)?.attributions ?? MAP_STYLES[0].attributions;
}
