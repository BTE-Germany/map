"use server"

import db from "@/db/drizzle";
import { region, type LandUseStats } from "@/db/schema";
import { count, desc, sum } from "drizzle-orm";
import { aggregatePlayerScores, type PlayerScore, type ScoringRegion } from "@/lib/scoring";

export interface GlobalStats {
    totals: {
        regions: number;
        finished: number;
        inProgress: number;
        totalArea: number;
        finishedArea: number;
        buildings: number;
        uniqueBuilders: number;
    };
    byState: Array<{ state: string; count: number; totalArea: number }>;
    byType: Array<{ type: string; count: number }>;
    timeline: Array<{ month: string; created: number; finished: number }>;
    landuse: LandUseStats;
    landuseCoverage: number;
    topRegions: Array<{
        id: string;
        address: string;
        city: string;
        state: string;
        area: number;
        buildings: number;
        type: string;
        finished: boolean;
    }>;
    ranking: PlayerScore[];
}

export async function getGlobalStats(): Promise<GlobalStats> {
    const all = await db!.select().from(region);

    const totals = {
        regions: all.length,
        finished: all.filter((r) => r.finished).length,
        inProgress: all.filter((r) => !r.finished).length,
        totalArea: 0,
        finishedArea: 0,
        buildings: 0,
        uniqueBuilders: 0,
    };

    const builderSet = new Set<string>();

    const stateMap = new Map<string, { count: number; totalArea: number }>();
    const typeMap = new Map<string, number>();
    const timelineMap = new Map<string, { created: number; finished: number }>();

    const landuseTotals: LandUseStats = {
        forest: 0,
        water: 0,
        farmland: 0,
        residential: 0,
        industrial: 0,
        park: 0,
    };
    let regionsWithLanduse = 0;

    for (const r of all) {
        const area = parseFloat(r.area ?? "0") || 0;
        totals.totalArea += area;
        if (r.finished) totals.finishedArea += area;
        totals.buildings += r.buildings ?? 0;

        builderSet.add(r.creatorUUID);
        for (const uuid of r.builders ?? []) {
            if (uuid) builderSet.add(uuid);
        }

        const stateKey = r.state || "—";
        if (!stateMap.has(stateKey)) stateMap.set(stateKey, { count: 0, totalArea: 0 });
        const s = stateMap.get(stateKey)!;
        s.count += 1;
        s.totalArea += area;

        typeMap.set(r.type, (typeMap.get(r.type) ?? 0) + 1);

        if (r.createdAt) {
            const d = new Date(r.createdAt);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!timelineMap.has(monthKey)) timelineMap.set(monthKey, { created: 0, finished: 0 });
            const t = timelineMap.get(monthKey)!;
            t.created += 1;
            if (r.finished) t.finished += 1;
        }

        if (r.landuse) {
            regionsWithLanduse += 1;
            for (const key of Object.keys(landuseTotals) as (keyof LandUseStats)[]) {
                landuseTotals[key] += r.landuse[key] ?? 0;
            }
        }
    }

    totals.uniqueBuilders = builderSet.size;

    const byState = Array.from(stateMap.entries())
        .map(([state, v]) => ({ state, ...v }))
        .sort((a, b) => b.totalArea - a.totalArea);

    const byType = Array.from(typeMap.entries())
        .map(([type, cnt]) => ({ type, count: cnt }))
        .sort((a, b) => b.count - a.count);

    const timeline = Array.from(timelineMap.entries())
        .map(([month, v]) => ({ month, ...v }))
        .sort((a, b) => a.month.localeCompare(b.month));

    const topRegions = [...all]
        .sort((a, b) => parseFloat(b.area ?? "0") - parseFloat(a.area ?? "0"))
        .slice(0, 8)
        .map((r) => ({
            id: r.id,
            address: r.address ?? "",
            city: r.city,
            state: r.state,
            area: parseFloat(r.area ?? "0") || 0,
            buildings: r.buildings ?? 0,
            type: r.type,
            finished: r.finished,
        }));

    const scoringRegions: ScoringRegion[] = all.map((r) => ({
        id: r.id,
        area: r.area,
        buildings: r.buildings,
        type: r.type,
        finished: r.finished,
        landuse: r.landuse ?? null,
        creatorUUID: r.creatorUUID,
        builders: r.builders ?? [],
    }));

    // Alle Spieler mit Punkten > 0 zurückgeben — der Client sortiert / limitiert
    // dann je nach Ranking-Metrik (Punkte / Fläche / Gebäude).
    const ranking = aggregatePlayerScores(scoringRegions);

    const landuseCoverage = totals.regions > 0 ? regionsWithLanduse / totals.regions : 0;

    return {
        totals,
        byState,
        byType,
        timeline,
        landuse: landuseTotals,
        landuseCoverage,
        topRegions,
        ranking,
    };
}
