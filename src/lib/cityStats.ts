import type { LandUseStats } from "@/db/schema";
import { stateCodeToName } from "@/lib/federalStates";
import { aggregatePlayerScores, scoreRegion, type PlayerScore, type ScoringRegion } from "@/lib/scoring";

/**
 * Eine Stadt ist in diesem Datenmodell kein eigener Datensatz, sondern nur der
 * `city`-String auf den Regionen. Sie wird deshalb immer zusammen mit ihrem
 * Bundesland identifiziert: "Neustadt" gibt es in RP, SH, BY und noch ein paar
 * weiteren Ländern, und ohne das Land würden deren Regionen zu einer einzigen
 * erfundenen Stadt verschmelzen.
 */
export type CityStatsRegion = ScoringRegion & {
    address: string;
    createdAt: Date | null;
    modifiedAt: Date | null;
};

export interface CityRegionEntry {
    id: string;
    address: string;
    area: number;
    buildings: number;
    finished: boolean;
    type: "default" | "plot" | "event";
    /** Punkte der Region insgesamt, nicht pro Builder. */
    points: number;
    createdAt: string | null;
    modifiedAt: string | null;
}

export interface CityStats {
    city: string;
    state: string;
    stateName: string;
    regions: number;
    finishedRegions: number;
    inProgressRegions: number;
    totalArea: number;
    finishedArea: number;
    inProgressArea: number;
    buildings: number;
    finishedBuildings: number;
    /** Anzahl beteiligter Spieler (Ersteller und eingetragene Mitbuilder). */
    builders: number;
    totalPoints: number;
    topPlayers: PlayerScore[];
    types: Array<{ type: string; count: number; area: number }>;
    landuse: LandUseStats;
    /** Anteil der Regionen mit Landuse-Daten (0–1) — sagt, wie belastbar `landuse` ist. */
    landuseCoverage: number;
    firstActivity: string | null;
    latestActivity: string | null;
    largestRegion: CityRegionEntry | null;
    regionsList: CityRegionEntry[];
    /** Platz der Stadt innerhalb ihres Bundeslandes, nach beanspruchter Fläche. */
    rankInState: number;
    /** Wie viele Städte im Land überhaupt Regionen haben — Nenner zu `rankInState`. */
    citiesInState: number;
    /** Anteil an der Gesamtfläche aller Regionen des Landes (0–1). */
    shareOfStateArea: number;
}

export interface CityRanking {
    rankInState: number;
    citiesInState: number;
    stateTotalArea: number;
}

function toArea(value: string | number): number {
    const n = typeof value === "string" ? parseFloat(value) : value;
    return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/**
 * Rang und Nachbarschaft einer Stadt in ihrem Bundesland. Erwartet die
 * (city, area)-Paare aller Regionen des Landes — also auch die der anderen
 * Städte, denn ein Rang ohne Konkurrenz ist keiner.
 */
export function rankCityInState(
    city: string,
    stateRegions: Array<{ city: string; area: string | number }>,
): CityRanking {
    // Gruppiert case-insensitiv, wie die Abfrage der Stadtregionen auch: sonst
    // zählte "Köln" und "köln" hier als zwei Städte, dort aber als eine.
    const areaByCity = new Map<string, number>();
    let stateTotalArea = 0;

    for (const row of stateRegions) {
        const name = row.city?.trim().toLowerCase();
        const area = toArea(row.area);
        stateTotalArea += area;
        if (!name) continue;
        areaByCity.set(name, (areaByCity.get(name) ?? 0) + area);
    }

    const ordered = [...areaByCity.entries()].sort((a, b) => b[1] - a[1]);
    const needle = city.trim().toLowerCase();
    const index = ordered.findIndex(([name]) => name === needle);

    return {
        rankInState: index >= 0 ? index + 1 : 0,
        citiesInState: ordered.length,
        stateTotalArea,
    };
}

/**
 * Fasst die Regionen einer Stadt zu ihrer Statistikseite zusammen.
 *
 * Die Punkte laufen über dieselben Funktionen wie Rangliste und Landesansicht
 * (`scoreRegion` / `aggregatePlayerScores`), damit eine Stadt keine eigene
 * Rechnung aufmacht: Wer hier oben steht, steht aus demselben Grund oben wie
 * in der Bundeslandansicht.
 */
export function aggregateCityStats(params: {
    city: string;
    state: string;
    regions: CityStatsRegion[];
    ranking: CityRanking;
    topPlayerLimit?: number;
}): CityStats {
    const { city, state, regions, ranking, topPlayerLimit = 10 } = params;

    const landuse: LandUseStats = {
        residential: 0,
        industrial: 0,
        park: 0,
        farmland: 0,
        forest: 0,
        water: 0,
    };

    const typeMap = new Map<string, { count: number; area: number }>();
    const builderSet = new Set<string>();
    const entries: CityRegionEntry[] = [];

    let totalArea = 0;
    let finishedArea = 0;
    let inProgressArea = 0;
    let buildings = 0;
    let finishedBuildings = 0;
    let finishedRegions = 0;
    let totalPoints = 0;
    let regionsWithLanduse = 0;
    let firstActivity: Date | null = null;
    let latestActivity: Date | null = null;

    for (const region of regions) {
        const area = toArea(region.area);
        const buildingCount = region.buildings ?? 0;
        const score = scoreRegion(region);

        totalArea += area;
        buildings += buildingCount;
        totalPoints += score.total;

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

        const typeEntry = typeMap.get(region.type) ?? { count: 0, area: 0 };
        typeEntry.count += 1;
        typeEntry.area += area;
        typeMap.set(region.type, typeEntry);

        if (region.landuse) {
            regionsWithLanduse += 1;
            for (const key of Object.keys(landuse) as (keyof LandUseStats)[]) {
                landuse[key] += region.landuse[key] ?? 0;
            }
        }

        if (region.createdAt && (!firstActivity || region.createdAt < firstActivity)) {
            firstActivity = region.createdAt;
        }
        if (region.modifiedAt && (!latestActivity || region.modifiedAt > latestActivity)) {
            latestActivity = region.modifiedAt;
        }

        entries.push({
            id: region.id,
            address: region.address ?? "",
            area,
            buildings: buildingCount,
            finished: region.finished,
            type: region.type,
            points: score.total,
            createdAt: region.createdAt?.toISOString() ?? null,
            modifiedAt: region.modifiedAt?.toISOString() ?? null,
        });
    }

    entries.sort((a, b) => b.area - a.area);

    return {
        city,
        state,
        stateName: stateCodeToName(state),
        regions: regions.length,
        finishedRegions,
        inProgressRegions: regions.length - finishedRegions,
        totalArea,
        finishedArea,
        inProgressArea,
        buildings,
        finishedBuildings,
        builders: builderSet.size,
        totalPoints,
        topPlayers: aggregatePlayerScores(regions).slice(0, topPlayerLimit),
        types: [...typeMap.entries()]
            .map(([type, values]) => ({ type, ...values }))
            .sort((a, b) => b.count - a.count),
        landuse,
        landuseCoverage: regions.length > 0 ? regionsWithLanduse / regions.length : 0,
        firstActivity: firstActivity ? (firstActivity as Date).toISOString() : null,
        latestActivity: latestActivity ? (latestActivity as Date).toISOString() : null,
        largestRegion: entries[0] ?? null,
        regionsList: entries,
        rankInState: ranking.rankInState,
        citiesInState: ranking.citiesInState,
        shareOfStateArea: ranking.stateTotalArea > 0 ? totalArea / ranking.stateTotalArea : 0,
    };
}
