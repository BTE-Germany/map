import Link from "next/link";
import {
    Activity,
    ArrowLeft,
    Building2,
    CalendarDays,
    CheckCircle2,
    Construction,
    LandPlot,
    MapPin,
    Shapes,
    Sparkles,
    Trophy,
    Users,
} from "lucide-react";

import CityRegionsList from "@/components/city/CityRegionsList";
import { FloatingNavigationBar } from "@/components/common/NavigationBar";
import ProfileMiniMapWrapper from "@/components/profile/ProfileMiniMapWrapper";
import TopPlayerRow from "@/components/stats/TopPlayerRow";
import type { LandUseStats } from "@/db/schema";
import type { CityStats } from "@/lib/cityStats";
import type { RegionGeoJSON } from "@/lib/regionGeo";

const LANDUSE_LABELS: Record<keyof LandUseStats, string> = {
    residential: "Wohngebiete",
    industrial: "Gewerbe",
    park: "Parks",
    farmland: "Landwirtschaft",
    forest: "Wälder",
    water: "Wasser",
};

const TYPE_LABELS: Record<string, string> = {
    default: "Standard",
    plot: "Plot",
    event: "Event",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
});

function formatArea(area: number) {
    if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`;
    if (area >= 10_000) return `${(area / 10_000).toFixed(1)} ha`;
    return `${Math.round(area).toLocaleString("de-DE")} m²`;
}

function formatDate(iso: string | null) {
    return iso ? DATE_FORMATTER.format(new Date(iso)) : "—";
}

function formatShare(share: number) {
    const percent = share * 100;
    if (percent <= 0) return "0 %";
    if (percent < 0.1) return "< 0,1 %";
    return `${percent.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function StatCard({
    label,
    value,
    detail,
    icon,
    accent,
}: {
    label: string;
    value: string;
    detail: string;
    icon: React.ReactNode;
    accent: string;
}) {
    return (
        <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
            <div
                className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-20 blur-3xl"
                style={{ backgroundColor: accent }}
            />
            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-600">{label}</p>
                    <p className="mt-2 break-words text-2xl font-bold tabular-nums tracking-tight text-white">{value}</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">{detail}</p>
                </div>
                <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset"
                    style={{ color: accent, backgroundColor: `${accent}14`, boxShadow: `inset 0 0 0 1px ${accent}24` }}
                >
                    {icon}
                </div>
            </div>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-3 last:border-0">
            <dt className="text-xs text-neutral-500">{label}</dt>
            <dd className="max-w-[65%] text-right text-xs font-medium text-neutral-200">{value}</dd>
        </div>
    );
}

/**
 * Die Darstellung einer Stadtstatistik, getrennt von ihrer Beschaffung: die
 * Route lädt, diese Komponente zeigt. Das hält die Seite auf Datenzugriff
 * reduziert und macht die Ansicht ohne Datenbank darstellbar.
 */
export default function CityStatsView({ stats, geoJSON }: { stats: CityStats; geoJSON: RegionGeoJSON }) {
    const completionRate = stats.regions > 0 ? Math.round((stats.finishedRegions / stats.regions) * 100) : 0;
    const maxPoints = stats.topPlayers[0]?.totalPoints ?? 0;
    const landuseTotal = Object.values(stats.landuse).reduce((sum, value) => sum + value, 0);
    const landuseEntries = (Object.keys(stats.landuse) as (keyof LandUseStats)[])
        .map((key) => ({ key, value: stats.landuse[key] }))
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <FloatingNavigationBar collapsable={false} />

            <main className="container mx-auto space-y-6 px-4 pb-20 sm:space-y-8">
                <Link
                    href="/stats"
                    className="inline-flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-white"
                >
                    <ArrowLeft className="size-3.5" />
                    Zurück zu den Statistiken
                </Link>

                <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-sky-500/[0.07] via-neutral-950 to-emerald-500/[0.06]">
                    <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-sky-500/10 blur-3xl" />
                    <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:32px_32px]" />

                    <div className="relative grid lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8 lg:p-10">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-300/70">
                                Stadtstatistik
                            </p>
                            <h1 className="mt-1 break-words text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                                {stats.city}
                            </h1>
                            <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-400">
                                <MapPin className="size-3.5 text-neutral-600" />
                                {stats.stateName}
                            </p>

                            <div className="mt-6 flex flex-wrap gap-2">
                                {stats.rankInState > 0 && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                                        <Trophy className="size-3.5" />
                                        Platz {stats.rankInState} von {stats.citiesInState} in {stats.state}
                                    </span>
                                )}
                                {/* Anteil an der Fläche, die das Projekt in diesem Land beansprucht —
                                    nicht an der amtlichen Landesfläche. Die Formulierung muss das
                                    tragen, sonst liest sich ein Drittel Nordrhein-Westfalens daraus. */}
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300">
                                    <LandPlot className="size-3.5 text-neutral-500" />
                                    {formatShare(stats.shareOfStateArea)} aller Regionsflächen in {stats.state}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300">
                                    <CalendarDays className="size-3.5 text-neutral-500" />
                                    Seit {formatDate(stats.firstActivity)}
                                </span>
                            </div>
                        </div>

                        <div className="relative min-h-64 border-t border-white/[0.06] lg:min-h-80 lg:border-l lg:border-t-0">
                            <ProfileMiniMapWrapper geoJSON={geoJSON} />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-neutral-950/25 via-transparent to-transparent" />
                            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-neutral-950/75 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-400 backdrop-blur">
                                Regionen der Stadt
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <StatCard
                        label="Regionen"
                        value={stats.regions.toLocaleString("de-DE")}
                        detail={`${stats.finishedRegions} fertig · ${stats.inProgressRegions} in Arbeit`}
                        icon={<MapPin className="size-4" />}
                        accent="#3b82f6"
                    />
                    <StatCard
                        label="Fläche"
                        value={formatArea(stats.totalArea)}
                        detail={`davon ${formatArea(stats.finishedArea)} fertig`}
                        icon={<LandPlot className="size-4" />}
                        accent="#22c55e"
                    />
                    <StatCard
                        label="Gebäude"
                        value={stats.buildings.toLocaleString("de-DE")}
                        detail={`${stats.finishedBuildings.toLocaleString("de-DE")} in fertigen Regionen`}
                        icon={<Building2 className="size-4" />}
                        accent="#f97316"
                    />
                    <StatCard
                        label="Builder"
                        value={stats.builders.toLocaleString("de-DE")}
                        detail="an dieser Stadt beteiligt"
                        icon={<Users className="size-4" />}
                        accent="#a855f7"
                    />
                    <StatCard
                        label="Fertiggestellt"
                        value={`${completionRate} %`}
                        detail={`${stats.finishedRegions} von ${stats.regions} Regionen`}
                        icon={<CheckCircle2 className="size-4" />}
                        accent="#10b981"
                    />
                </section>

                <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] lg:col-span-2">
                        <header className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-5 py-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <Trophy className="size-4 text-amber-400" />
                                Top Builder in {stats.city}
                            </div>
                            {stats.topPlayers.length > 0 && (
                                <span className="text-[9px] uppercase tracking-widest text-neutral-600">
                                    Top {stats.topPlayers.length}
                                </span>
                            )}
                        </header>
                        <div className="p-2">
                            {stats.topPlayers.length === 0 ? (
                                <p className="px-3 py-8 text-center text-xs text-neutral-600">
                                    Für diese Stadt sind noch keine Punkte vergeben.
                                </p>
                            ) : (
                                <div className="flex flex-col">
                                    {stats.topPlayers.map((player, i) => (
                                        <TopPlayerRow
                                            key={player.uuid}
                                            player={player}
                                            rank={i + 1}
                                            maxPoints={maxPoints}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                        <header className="flex items-center gap-2 border-b border-white/[0.05] px-5 py-4 text-sm font-semibold text-white">
                            <Activity className="size-4 text-sky-400" />
                            Stadt im Überblick
                        </header>
                        <dl className="px-5 py-1">
                            <DetailRow label="Punkte gesamt" value={Math.round(stats.totalPoints).toLocaleString("de-DE")} />
                            <DetailRow
                                label="Größte Region"
                                value={stats.largestRegion ? (
                                    <Link
                                        href={`/region/${stats.largestRegion.id}`}
                                        prefetch={false}
                                        className="transition-colors hover:text-sky-300"
                                    >
                                        {stats.largestRegion.address || formatArea(stats.largestRegion.area)}
                                    </Link>
                                ) : "—"}
                            />
                            <DetailRow label="Ø Regionsfläche" value={formatArea(stats.totalArea / Math.max(1, stats.regions))} />
                            <DetailRow label="Im Bau" value={formatArea(stats.inProgressArea)} />
                            <DetailRow label="Zuletzt bearbeitet" value={formatDate(stats.latestActivity)} />
                        </dl>
                        <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] px-5 py-4">
                            <Shapes className="mr-1 size-3.5 text-neutral-600" />
                            {stats.types.map((entry) => (
                                <span
                                    key={entry.type}
                                    className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-neutral-500 ring-1 ring-inset ring-white/[0.06]"
                                >
                                    {TYPE_LABELS[entry.type] ?? entry.type} {entry.count}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {landuseEntries.length > 0 && (
                    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] px-5 py-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <Sparkles className="size-4 text-emerald-400" />
                                Flächennutzung
                            </div>
                            {/* Ohne die Abdeckung wäre die Verteilung nicht einzuordnen: sie
                                beschreibt nur die Regionen, für die OSM-Daten vorliegen. */}
                            <span className="text-[9px] uppercase tracking-widest text-neutral-600">
                                {Math.round(stats.landuseCoverage * 100)} % der Regionen mit Daten
                            </span>
                        </header>
                        <div className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
                            {landuseEntries.map((entry) => (
                                <div key={entry.key} className="space-y-2">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="truncate font-medium text-neutral-300">
                                            {LANDUSE_LABELS[entry.key]}
                                        </span>
                                        <span className="shrink-0 tabular-nums text-neutral-500">
                                            {formatArea(entry.value)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400"
                                            style={{ width: `${(entry.value / landuseTotal) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="space-y-4 pt-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-400/70">
                                Regionen
                            </p>
                            <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Alles in {stats.city}</h2>
                        </div>
                        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                            <Construction className="size-3.5" />
                            {stats.inProgressRegions} von {stats.regions} Regionen sind noch in Arbeit
                        </p>
                    </div>
                    <CityRegionsList regions={stats.regionsList} />
                </section>
            </main>
        </div>
    );
}
