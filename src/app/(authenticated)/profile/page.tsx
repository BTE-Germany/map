import {
    getCreatorScalarStats,
    getMostPopularStateByCreator,
    getRegionStatsByStateByCreator,
    getRegionsByCreator,
} from "@/actions/region/GetRegions";
import { regionsToCreatorGeoJSON } from "@/lib/regionGeo";
import { getSession } from "@/lib/auth";
import { stateCodeToName } from "@/lib/federalStates";
import { Building2, CheckCircle2, Circle, LandPlot, Map, MapPin } from "lucide-react";
import Link from "next/link";
import ProfileMiniMapWrapper from "@/components/profile/ProfileMiniMapWrapper";

function formatArea(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} km²`;
    if (n >= 10_000) return `${(n / 10_000).toFixed(2)} ha`;
    return `${n.toLocaleString("de-DE")} m²`;
}

function formatDate(d: Date | null): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ProfilePage() {
    const session = await getSession();
    const uuid = session?.user.minecraft_uuid || "";

    // Four headline numbers in one query; the creator's rows fetched ONCE and
    // reused for both the mini-map geojson and the "recent" cards.
    const [scalarStats, mostPopularState, regions, stateStats] = await Promise.all([
        getCreatorScalarStats(uuid),
        getMostPopularStateByCreator(uuid, true),
        getRegionsByCreator(uuid),
        getRegionStatsByStateByCreator(uuid),
    ]);

    const { totalRegions, finishedRegions, totalFinishedArea, totalBuildings } = scalarStats;
    const allRegions = regions ?? [];
    const geoJSON = regionsToCreatorGeoJSON(allRegions);
    const recentRegions = allRegions.slice(0, 4);

    const finishedPct = totalRegions > 0 ? Math.round((finishedRegions / totalRegions) * 100) : 0;

    const maxStateArea = stateStats && stateStats.length > 0
        ? Math.max(...stateStats.map(s => parseFloat(s.totalArea ?? "0")))
        : 1;

    return (
        <div className="container mx-auto space-y-6">

            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                {/* Total regions */}
                <div className="relative rounded-xl border border-border bg-card overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(59,130,246,0.06)_0%,transparent_60%)]" />
                    <div className="relative flex min-w-0 flex-col gap-3 p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Regionen gesamt</p>
                            <div className="size-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <Map className="size-3.5 text-blue-400" />
                            </div>
                        </div>
                        <div>
                            <p className="text-3xl font-bold tabular-nums">{totalRegions}</p>
                            <div className="mt-2.5 flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-all"
                                        style={{ width: `${finishedPct}%` }}
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                                    {finishedRegions}/{totalRegions}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Finished area */}
                <div className="relative rounded-xl border border-border bg-card overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(16,185,129,0.06)_0%,transparent_60%)]" />
                    <div className="relative flex min-w-0 flex-col gap-3 p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fertige Fläche</p>
                            <div className="size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <CheckCircle2 className="size-3.5 text-emerald-400" />
                            </div>
                        </div>
                        <div>
                            <p className="break-words text-2xl font-bold tabular-nums sm:text-3xl">{formatArea(totalFinishedArea)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {finishedRegions > 0
                                    ? `${finishedRegions} Region${finishedRegions !== 1 ? "en" : ""}`
                                    : "Noch keine fertig"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Most popular state */}
                <div className="relative rounded-xl border border-border bg-card overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(168,85,247,0.06)_0%,transparent_60%)]" />
                    {mostPopularState && (
                        <div className="absolute right-3 bottom-0 size-20 opacity-[0.12] translate-y-2">
                            <img
                                src={`https://cdn.bte-germany.de/general/coa/svg/${mostPopularState}.svg`}
                                alt=""
                                className="w-full h-full object-contain -rotate-6"
                            />
                        </div>
                    )}
                    <div className="relative flex min-w-0 flex-col gap-3 p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Top Bundesland</p>
                            <div className="size-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                <LandPlot className="size-3.5 text-purple-400" />
                            </div>
                        </div>
                        <div>
                            <p className="break-words text-2xl font-bold leading-tight">
                                {mostPopularState ? stateCodeToName(mostPopularState) : "—"}
                            </p>
                            {mostPopularState && (
                                <p className="mt-1 text-xs text-muted-foreground">Nach fertiggest. Fläche</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Total buildings */}
                <div className="relative rounded-xl border border-border bg-card overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(245,158,11,0.06)_0%,transparent_60%)]" />
                    <div className="relative flex min-w-0 flex-col gap-3 p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gebäude gesamt</p>
                            <div className="size-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <Building2 className="size-3.5 text-amber-400" />
                            </div>
                        </div>
                        <div>
                            <p className="break-words text-3xl font-bold tabular-nums">{(totalBuildings ?? 0).toLocaleString("de-DE")}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Über alle Regionen</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map + State Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Mini Map */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
                        <p className="text-sm font-medium flex items-center gap-2">
                            <Map className="size-4 text-blue-400" />
                            Meine Regionen
                        </p>
                        <Link
                            href="/profile/regions"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Alle anzeigen →
                        </Link>
                    </div>
                    <div className="h-64 sm:h-72">
                        {totalRegions === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                <Map className="size-8 opacity-20" />
                                <p className="text-sm">Noch keine Regionen erstellt</p>
                            </div>
                        ) : (
                            <ProfileMiniMapWrapper geoJSON={geoJSON} />
                        )}
                    </div>
                </div>

                {/* State Distribution */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-5 py-3 border-b border-border">
                        <p className="text-sm font-medium flex items-center gap-2">
                            <LandPlot className="size-4 text-purple-400" />
                            Bundesländer
                        </p>
                    </div>
                    <div className="p-4 space-y-2.5 max-h-72 overflow-y-auto">
                        {!stateStats || stateStats.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Keine Daten</p>
                        ) : (
                            stateStats.map((s) => {
                                const area = parseFloat(s.totalArea ?? "0");
                                const pct = maxStateArea > 0 ? (area / maxStateArea) * 100 : 0;
                                return (
                                    <div key={s.state} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium truncate">{stateCodeToName(s.state)}</span>
                                            <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                                                {s.count}×
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-purple-500/70 transition-all"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Regions */}
            {recentRegions.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
                        <p className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="size-4 text-blue-400" />
                            Zuletzt bearbeitet
                        </p>
                        <Link
                            href="/profile/regions"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Alle anzeigen →
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
                        {recentRegions.map((r) => (
                            <Link
                                key={r.id}
                                href={`/region/${r.id}`}
                                className="p-4 hover:bg-muted/30 transition-colors group"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                            {r.city}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                            {stateCodeToName(r.state)}
                                        </p>
                                    </div>
                                    {r.finished ? (
                                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                                    ) : (
                                        <Circle className="size-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                                    )}
                                </div>
                                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="tabular-nums">{formatArea(parseFloat(r.area))}</span>
                                    {r.buildings > 0 && (
                                        <span className="flex items-center gap-1">
                                            <Building2 className="size-3" />
                                            {r.buildings.toLocaleString("de-DE")}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1.5 text-xs text-muted-foreground/60">{formatDate(r.createdAt)}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
