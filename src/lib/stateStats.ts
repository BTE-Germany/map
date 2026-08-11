import { FEDERAL_STATE_NAMES, stateAreaSqm } from "@/lib/federalStates";
import { aggregatePlayerScores, type PlayerScore, type ScoringRegion } from "@/lib/scoring";

/** Wie viele Einträge die Detailansicht je Bundesland zeigt. */
const TOP_PLAYER_LIMIT = 5;
const TOP_CITY_LIMIT = 6;

export type StateStatsRegion = ScoringRegion & {
    state: string;
    city: string;
};

export interface StateCityStats {
    city: string;
    regions: number;
    totalArea: number;
    finishedArea: number;
    buildings: number;
}

export interface StateStats {
    /** ISO-3166-2-Kürzel ohne Präfix, z. B. "BE". */
    code: string;
    name: string;
    regions: number;
    finishedRegions: number;
    inProgressRegions: number;
    totalArea: number;
    finishedArea: number;
    inProgressArea: number;
    buildings: number;
    finishedBuildings: number;
    builders: number;
    /** Amtliche Gebietsfläche des Landes in m² (null, falls unbekannt). */
    officialArea: number | null;
    /** Anteil der fertigen Fläche an der Gebietsfläche (0–1). */
    coverage: number;
    topPlayers: PlayerScore[];
    topCities: StateCityStats[];
}

function toArea(value: string | number): number {
    const n = typeof value === "string" ? parseFloat(value) : value;
    return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/**
 * Aggregiert die Regionen zu einer Statistik je Bundesland — Basis für die
 * Heatmap-Karte auf der Statistikseite.
 *
 * Es werden immer alle 16 Länder zurückgegeben, auch die ohne eine einzige
 * Region: die Karte braucht für jedes Land einen Eintrag, und ein leeres
 * Bundesland ist selbst eine Aussage. Regionen ohne (oder mit unbekanntem)
 * `state` fallen heraus, weil sie sich keiner Fläche zuordnen lassen.
 */
export function aggregateStateStats(regions: StateStatsRegion[]): StateStats[] {
    const byState = new Map<string, StateStatsRegion[]>();
    for (const code of Object.keys(FEDERAL_STATE_NAMES)) byState.set(code, []);

    for (const region of regions) {
        const bucket = byState.get(region.state);
        if (bucket) bucket.push(region);
    }

    return Array.from(byState.entries())
        .map(([code, stateRegions]) => {
            let totalArea = 0;
            let finishedArea = 0;
            let inProgressArea = 0;
            let buildings = 0;
            let finishedBuildings = 0;
            let finishedRegions = 0;

            const builderSet = new Set<string>();
            const cityMap = new Map<string, StateCityStats>();

            for (const region of stateRegions) {
                const area = toArea(region.area);
                const buildingCount = region.buildings ?? 0;

                totalArea += area;
                buildings += buildingCount;
                if (region.finished) {
                    finishedRegions += 1;
                    finishedArea += area;
                    finishedBuildings += buildingCount;
                } else {
                    inProgressArea += area;
                }

                builderSet.add(region.creatorUUID);
                for (const uuid of region.builders ?? []) {
                    if (uuid) builderSet.add(uuid);
                }

                const city = region.city?.trim();
                if (city) {
                    let entry = cityMap.get(city);
                    if (!entry) {
                        entry = { city, regions: 0, totalArea: 0, finishedArea: 0, buildings: 0 };
                        cityMap.set(city, entry);
                    }
                    entry.regions += 1;
                    entry.totalArea += area;
                    entry.buildings += buildingCount;
                    if (region.finished) entry.finishedArea += area;
                }
            }

            const officialArea = stateAreaSqm(code);

            return {
                code,
                name: FEDERAL_STATE_NAMES[code],
                regions: stateRegions.length,
                finishedRegions,
                inProgressRegions: stateRegions.length - finishedRegions,
                totalArea,
                finishedArea,
                inProgressArea,
                buildings,
                finishedBuildings,
                builders: builderSet.size,
                officialArea,
                coverage: officialArea && officialArea > 0 ? finishedArea / officialArea : 0,
                topPlayers: aggregatePlayerScores(stateRegions).slice(0, TOP_PLAYER_LIMIT),
                topCities: Array.from(cityMap.values())
                    .sort((a, b) => b.totalArea - a.totalArea)
                    .slice(0, TOP_CITY_LIMIT),
            } satisfies StateStats;
        })
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
}
