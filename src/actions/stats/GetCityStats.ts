"use server";

import { and, eq, sql } from "drizzle-orm";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { aggregateCityStats, rankCityInState, type CityStats, type CityStatsRegion } from "@/lib/cityStats";
import { FEDERAL_STATE_NAMES } from "@/lib/federalStates";
import { regionsToCreatorGeoJSON, type RegionGeoJSON } from "@/lib/regionGeo";

export interface CityStatsResult {
    stats: CityStats;
    /** Umrisse der Regionen dieser Stadt für die Übersichtskarte. */
    geoJSON: RegionGeoJSON;
}

/**
 * Statistik einer Stadt innerhalb eines Bundeslandes.
 *
 * Der Stadtname wird case-insensitiv verglichen: die Links der Heatmap treffen
 * die Schreibweise exakt, von Hand getippte URLs nicht unbedingt, und
 * unterschiedliche Groß-/Kleinschreibung im Datenbestand soll dieselbe Stadt
 * bleiben. Angezeigt wird anschließend die Schreibweise aus den Daten, nicht
 * die aus der URL.
 *
 * Gibt `null` zurück, wenn es zu Land + Stadt keine einzige Region gibt — die
 * Seite macht daraus ein 404, statt eine leere Stadt zu erfinden.
 */
export async function getCityStats(stateCode: string, cityName: string): Promise<CityStatsResult | null> {
    const state = stateCode?.trim().toUpperCase() ?? "";
    const city = cityName?.trim() ?? "";
    if (!FEDERAL_STATE_NAMES[state] || !city || !db) return null;

    // Zwei Abfragen statt einer über das ganze Land: die Rangliste braucht nur
    // (Stadt, Fläche) aller Regionen des Landes, die Polygone und Landuse-Daten
    // dagegen nur die der einen Stadt.
    const [cityRows, stateRows] = await Promise.all([
        db
            .select({
                id: region.id,
                address: region.address,
                city: region.city,
                area: region.area,
                buildings: region.buildings,
                type: region.type,
                finished: region.finished,
                landuse: region.landuse,
                creatorUUID: region.creatorUUID,
                builders: region.builders,
                polygon: region.polygon,
                createdAt: region.createdAt,
                modifiedAt: region.modifiedAt,
            })
            .from(region)
            .where(and(eq(region.state, state), sql`lower(${region.city}) = lower(${city})`)),
        db
            .select({ city: region.city, area: region.area })
            .from(region)
            .where(eq(region.state, state)),
    ]);

    if (cityRows.length === 0) return null;

    // Die Schreibweise aus den Daten gewinnt gegenüber der aus der URL.
    const canonicalCity = cityRows[0].city;

    const regions: CityStatsRegion[] = cityRows.map((row) => ({
        id: row.id,
        address: row.address ?? "",
        area: row.area,
        buildings: row.buildings,
        type: row.type,
        finished: row.finished,
        landuse: row.landuse ?? null,
        creatorUUID: row.creatorUUID,
        builders: row.builders ?? [],
        createdAt: row.createdAt,
        modifiedAt: row.modifiedAt,
    }));

    const stats = aggregateCityStats({
        city: canonicalCity,
        state,
        regions,
        ranking: rankCityInState(canonicalCity, stateRows),
    });

    return {
        stats,
        geoJSON: regionsToCreatorGeoJSON(
            cityRows.map((row) => ({ id: row.id, finished: row.finished, polygon: row.polygon })),
        ),
    };
}
