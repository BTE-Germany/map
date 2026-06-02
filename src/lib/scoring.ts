import type { LandUseStats } from "@/db/schema";

/**
 * Punktesystem für BTE-Regionen.
 *
 * Idee: Eine faire Bewertung der Bauleistung. Gebaute Gebiete (Wohngebiete,
 * Gewerbe, Parks) zählen deutlich mehr als unbebaute Flächen (Wald, Wasser,
 * Felder). Teams teilen sich die Punkte.
 *
 * Ergebnis ist immer normiert auf "Punkte" (keine feste Einheit) — Skala
 * so gewählt, dass eine durchschnittliche fertige Region ~50-500 Punkte bringt.
 */

export const LANDUSE_WEIGHTS: Record<keyof LandUseStats, number> = {
    residential: 1.5,
    industrial: 1.3,
    park: 1.2,
    farmland: 0.5,
    forest: 0.3,
    water: 0.2,
};

export const TYPE_MULTIPLIERS = {
    default: 1.0,
    plot: 0,
    event: 0,
} as const;

/** Punkte pro 1000 m² gebauter Basisfläche. */
export const BASE_POINTS_PER_1000_SQM = 1.0;

/** Bonus pro Gebäude in der Region. */
export const BUILDING_POINT_BONUS = 2.0;

/** Multiplikator für fertiggestellte Regionen. */
export const FINISHED_MULTIPLIER = 1.2;

/** Multiplikator für noch in Arbeit befindliche Regionen. */
export const IN_PROGRESS_MULTIPLIER = 0.6;

export type ScoringRegion = {
    id: string;
    area: string | number;
    buildings: number | null;
    type: "default" | "plot" | "event";
    finished: boolean;
    landuse: LandUseStats | null;
    creatorUUID: string;
    builders: string[] | null;
};

/**
 * Berechnet den Landuse-Multiplikator als flächengewichteter Durchschnitt der
 * Kategorie-Gewichte. Ohne Landuse-Daten fällt es auf 1.0 zurück.
 */
export function computeLanduseMultiplier(landuse: LandUseStats | null | undefined): number {
    if (!landuse) return 1.0;

    let weightedSum = 0;
    let totalCategorized = 0;

    for (const key of Object.keys(LANDUSE_WEIGHTS) as (keyof LandUseStats)[]) {
        const area = landuse[key] ?? 0;
        if (area <= 0) continue;
        weightedSum += area * LANDUSE_WEIGHTS[key];
        totalCategorized += area;
    }

    if (totalCategorized <= 0) return 1.0;
    return weightedSum / totalCategorized;
}

export interface RegionScore {
    total: number;
    perBuilder: number;
    team: string[];
    breakdown: {
        baseArea: number;
        landuseMultiplier: number;
        typeMultiplier: number;
        buildingsBonus: number;
        finishedMultiplier: number;
    };
}

/**
 * Berechnet die Gesamtpunkte einer Region und wie sie auf das Team verteilt
 * werden.
 */
export function scoreRegion(region: ScoringRegion): RegionScore {
    const areaSqm = typeof region.area === "string" ? parseFloat(region.area) : (region.area ?? 0);
    const safeArea = Number.isFinite(areaSqm) ? Math.max(0, areaSqm) : 0;

    const baseArea = (safeArea / 1000) * BASE_POINTS_PER_1000_SQM;
    const landuseMultiplier = computeLanduseMultiplier(region.landuse);
    const typeMultiplier = TYPE_MULTIPLIERS[region.type] ?? 1.0;
    const buildingsBonus = (region.buildings ?? 0) * BUILDING_POINT_BONUS;
    const finishedMultiplier = region.finished ? FINISHED_MULTIPLIER : IN_PROGRESS_MULTIPLIER;

    const raw = baseArea * landuseMultiplier * typeMultiplier;
    const total = typeMultiplier === 0 ? 0 : (raw + buildingsBonus) * finishedMultiplier;

    const builders = Array.isArray(region.builders) ? region.builders : [];
    const team = [region.creatorUUID, ...builders.filter((uuid) => uuid && uuid !== region.creatorUUID)];
    const teamSize = Math.max(1, team.length);

    return {
        total,
        perBuilder: total / teamSize,
        team,
        breakdown: {
            baseArea,
            landuseMultiplier,
            typeMultiplier,
            buildingsBonus,
            finishedMultiplier,
        },
    };
}

export interface PlayerScore {
    uuid: string;
    totalPoints: number;
    regionCount: number;
    finishedRegionCount: number;
    totalArea: number;
    buildings: number;
    soloRegions: number;
    teamRegions: number;
}

export function aggregatePlayerScores(regions: ScoringRegion[]): PlayerScore[] {
    const map = new Map<string, PlayerScore>();

    for (const region of regions) {
        const score = scoreRegion(region);
        if (score.total <= 0) continue;
        const teamSize = score.team.length;
        const areaShare = (typeof region.area === "string" ? parseFloat(region.area) : (region.area ?? 0)) / teamSize;
        const buildingsShare = (region.buildings ?? 0) / teamSize;

        for (const uuid of score.team) {
            if (!map.has(uuid)) {
                map.set(uuid, {
                    uuid,
                    totalPoints: 0,
                    regionCount: 0,
                    finishedRegionCount: 0,
                    totalArea: 0,
                    buildings: 0,
                    soloRegions: 0,
                    teamRegions: 0,
                });
            }
            const entry = map.get(uuid)!;
            entry.totalPoints += score.perBuilder;
            entry.regionCount += 1;
            if (region.finished) entry.finishedRegionCount += 1;
            entry.totalArea += areaShare;
            entry.buildings += buildingsShare;
            if (teamSize === 1) entry.soloRegions += 1;
            else entry.teamRegions += 1;
        }
    }

    return Array.from(map.values()).sort((a, b) => b.totalPoints - a.totalPoints);
}
