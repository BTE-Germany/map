import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCityStats } from "@/actions/stats/GetCityStats";
import CityStatsView from "@/components/city/CityStatsView";

export const dynamic = "force-dynamic";

const loadCityStats = cache(getCityStats);

/**
 * Die Route trägt Land und Stadt getrennt (`/city/NW/Köln`), weil ein Stadtname
 * allein in Deutschland nicht eindeutig ist — "Neustadt" gibt es in einem
 * halben Dutzend Ländern.
 *
 * `cache` dedupliziert den Aufruf über `generateMetadata` und die Seite hinweg,
 * die beide dieselben Zahlen brauchen. Gecacht wird über die aufgelösten
 * Strings, nicht über das `params`-Promise: dass Next beiden Aufrufern dasselbe
 * Promise-Objekt reicht, ist nicht zugesichert.
 *
 * Die Segmente kommen von Next bereits dekodiert an; ein eigenes
 * `decodeURIComponent` würde "Köln" nicht verbessern und an einem
 * Prozentzeichen im Namen scheitern.
 */
async function loadCity(params: Promise<{ state: string; name: string }>) {
    const { state, name } = await params;
    return loadCityStats(state, name);
}

function formatArea(area: number) {
    if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`;
    if (area >= 10_000) return `${(area / 10_000).toFixed(1)} ha`;
    return `${Math.round(area).toLocaleString("de-DE")} m²`;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ state: string; name: string }>;
}): Promise<Metadata> {
    const result = await loadCity(params);
    if (!result) return { title: "Stadt nicht gefunden — BTE Germany" };

    const { stats } = result;
    return {
        title: `${stats.city} — Stadtstatistik`,
        description: `${stats.regions} Regionen, ${formatArea(stats.totalArea)} beanspruchte Fläche und die aktivsten Builder in ${stats.city} (${stats.stateName}) auf BTE Germany.`,
    };
}

export default async function CityStatsPage({
    params,
}: {
    params: Promise<{ state: string; name: string }>;
}) {
    const result = await loadCity(params);
    if (!result) notFound();

    return <CityStatsView stats={result.stats} geoJSON={result.geoJSON} />;
}
