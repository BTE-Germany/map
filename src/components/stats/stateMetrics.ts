import type { StateStats } from "@/lib/stateStats";

/**
 * Sequenzielle Blau-Rampe für die Heatmap: dunkel = wenig (verschwindet fast im
 * dunklen Hintergrund), hell = viel. Ein Farbton, monoton heller werdend — kein
 * Regenbogen, damit die Stufen als Größenordnung lesbar bleiben.
 */
export const HEAT_STEPS = ["#0d366b", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"];

/**
 * Füllung für Bundesländer ganz ohne Regionen — neutrales Grau statt der
 * untersten Blaustufe, aber kräftig genug, dass das Land noch als Fläche und
 * nicht als Loch in der Karte gelesen wird.
 */
export const HEAT_EMPTY = "rgba(255,255,255,0.08)";

/**
 * Stufe für einen Wert. Die Wurzel staucht den Abstand zum Spitzenreiter —
 * ohne sie läge bei der üblichen Verteilung (ein Land dominiert) alles andere
 * auf der untersten Stufe und die Karte wäre einfarbig.
 */
export function heatIndex(value: number, max: number): number {
    if (value <= 0 || max <= 0) return -1;
    const scaled = Math.sqrt(value / max);
    return Math.min(HEAT_STEPS.length - 1, Math.floor(scaled * HEAT_STEPS.length));
}

export function heatColor(value: number, max: number): string {
    const index = heatIndex(value, max);
    return index < 0 ? HEAT_EMPTY : HEAT_STEPS[index];
}

function decimal(n: number, digits: number) {
    return n.toLocaleString("de-DE", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

/**
 * Flächen wechseln die Einheit mit der Größenordnung, damit weder "0,000004 km²"
 * noch "70541570000 m²" auftaucht. Deutsche Schreibweise (Komma als Dezimal-,
 * Punkt als Tausendertrennzeichen) — bei Landesflächen im fünfstelligen
 * km²-Bereich sonst unlesbar.
 */
export function formatArea(n: number) {
    if (n >= 1_000_000) {
        const km2 = n / 1_000_000;
        return `${decimal(km2, km2 >= 1000 ? 0 : 2)} km²`;
    }
    if (n >= 10_000) return `${decimal(n / 10_000, 1)} ha`;
    return `${decimal(Math.round(n), 0)} m²`;
}

/** Kompakte Variante für Legende, Chips und Tabellenzellen. */
export function formatAreaShort(n: number) {
    if (n >= 1_000_000) {
        const km2 = n / 1_000_000;
        return `${decimal(km2, km2 >= 100 ? 0 : 1)} km²`;
    }
    if (n >= 10_000) return `${decimal(n / 10_000, 0)} ha`;
    return `${decimal(Math.round(n), 0)} m²`;
}

export function formatNumber(n: number) {
    return Math.round(n).toLocaleString("de-DE");
}

export function formatRegionCount(n: number) {
    return `${formatNumber(n)} ${n === 1 ? "Region" : "Regionen"}`;
}

/**
 * Prozentwerte der Flächendeckung werden schnell winzig — die Nachkommastellen
 * wachsen mit, damit "0,00 %" nicht als "nichts gebaut" missverstanden wird.
 */
export function formatCoverage(percent: number) {
    if (percent <= 0) return "0 %";
    if (percent < 0.0001) return "< 0,0001 %";

    const digits = percent < 0.01 ? 4 : percent < 1 ? 3 : 2;
    return `${percent.toLocaleString("de-DE", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })} %`;
}

export type MetricKey = "area" | "buildings" | "regions";

export interface StateMetric {
    key: MetricKey;
    label: string;
    /** Beschriftung der Legende, z. B. "gebaute Fläche". */
    legend: string;
    value: (state: StateStats) => number;
    format: (value: number) => string;
}

export const STATE_METRICS: Record<MetricKey, StateMetric> = {
    area: {
        key: "area",
        label: "Fläche",
        legend: "beanspruchte Fläche",
        value: (s) => s.totalArea,
        format: formatAreaShort,
    },
    buildings: {
        key: "buildings",
        label: "Gebäude",
        legend: "Gebäude",
        value: (s) => s.buildings,
        format: formatNumber,
    },
    regions: {
        key: "regions",
        label: "Regionen",
        legend: "Regionen",
        value: (s) => s.regions,
        format: formatNumber,
    },
};

export const METRIC_ORDER: MetricKey[] = ["area", "buildings", "regions"];
