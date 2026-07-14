import { getGlobalStats } from "@/actions/stats/GetGlobalStats";
import {
    LanduseStackedBar,
    StateBarChart,
    TimelineChart,
    TypeDonutChart,
} from "@/components/stats/StatsCharts";
import RankingSection from "@/components/stats/RankingSection";
import ExtendedRankingTable from "@/components/stats/ExtendedRankingTable";
import { stateCodeToName } from "@/lib/federalStates";
import {
    BASE_POINTS_PER_1000_SQM,
    BUILDING_POINT_BONUS,
    FINISHED_MULTIPLIER,
    IN_PROGRESS_MULTIPLIER,
    LANDUSE_WEIGHTS,
} from "@/lib/scoring";
import {
    Activity,
    Building2,
    CheckCircle2,
    ChevronDown,
    Gauge,
    LandPlot,
    Layers,
    Map as MapIcon,
    Sparkles,
    Users,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Statistisches Bundesamt: Gebietsfläche Deutschlands (357.588 km²).
const GERMANY_AREA_SQM = 357_588_000_000;

function formatArea(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} km²`;
    if (n >= 10_000) return `${(n / 10_000).toFixed(1)} ha`;
    return `${Math.round(n).toLocaleString("de-DE")} m²`;
}

function formatGermanyCoverage(percent: number) {
    if (percent === 0) return "0 %";
    if (percent < 0.000001) return "< 0,000001 %";

    const fractionDigits = percent < 0.001 ? 6 : percent < 0.1 ? 4 : 2;
    return `${percent.toLocaleString("de-DE", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    })} %`;
}

function SectionCard({
    icon,
    title,
    subtitle,
    children,
    className = "",
}: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="text-neutral-400">{icon}</span>
                    <span className="text-white">{title}</span>
                </div>
                {subtitle && <p className="text-[10px] uppercase tracking-widest text-neutral-600">{subtitle}</p>}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function StatCard({
    label,
    value,
    sub,
    icon,
    accent,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ReactNode;
    accent: string;
}) {
    return (
        <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div
                className="absolute -right-8 -top-8 size-28 rounded-full blur-3xl opacity-25 pointer-events-none"
                style={{ backgroundColor: accent }}
            />
            <div className="relative p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{label}</p>
                    <div
                        className="size-7 rounded-lg flex items-center justify-center ring-1"
                        style={{ backgroundColor: `${accent}18`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}30` }}
                    >
                        {icon}
                    </div>
                </div>
                <div>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums text-white leading-tight break-words">{value}</p>
                    {sub && <p className="mt-2 text-xs text-neutral-500">{sub}</p>}
                </div>
            </div>
        </div>
    );
}

function GermanyProgress({ finishedArea }: { finishedArea: number }) {
    const percent = Math.min(100, Math.max(0, (finishedArea / GERMANY_AREA_SQM) * 100));

    return (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-400/10 bg-gradient-to-r from-emerald-500/[0.06] via-white/[0.025] to-sky-500/[0.05] p-5 sm:p-6">
            <div className="pointer-events-none absolute -left-12 top-1/2 size-36 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                        <Gauge className="size-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
                            Deutschland gebaut
                        </p>
                        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
                            {formatGermanyCoverage(percent)}
                        </p>
                        <p className="mt-1.5 text-xs text-neutral-500">
                            {formatArea(finishedArea)} fertiggestellt · bezogen auf 357.588 km² Gesamtfläche
                        </p>
                    </div>
                </div>

                <div className="w-full lg:max-w-xl lg:flex-1">
                    <div className="relative h-2 rounded-full bg-white/[0.05] ring-1 ring-inset ring-white/[0.04]">
                        <div
                            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 shadow-[0_0_16px_rgba(52,211,153,0.45)] transition-[width] duration-700"
                            style={{
                                width: `${percent}%`,
                                minWidth: percent > 0 ? "3px" : undefined,
                            }}
                        />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] tabular-nums text-neutral-600">
                        <span>0 %</span>
                        <span>100 %</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default async function StatsPage() {
    const stats = await getGlobalStats();

    const finishedPct = stats.totals.regions > 0 ? Math.round((stats.totals.finished / stats.totals.regions) * 100) : 0;

    return (
        <div className="container mx-auto px-4 pt-32 pb-16 space-y-8">
            <div className="flex items-end justify-between gap-6 flex-wrap">
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white">Statistiken</h1>

                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Regionen"
                    value={stats.totals.regions.toLocaleString("de-DE")}
                    sub={`${stats.totals.finished} fertig (${finishedPct}%)`}
                    icon={<MapIcon className="size-4" />}
                    accent="#3b82f6"
                />
                <StatCard
                    label="Gesamtfläche"
                    value={formatArea(stats.totals.totalArea)}
                    sub={`davon ${formatArea(stats.totals.finishedArea)} fertig`}
                    icon={<LandPlot className="size-4" />}
                    accent="#22c55e"
                />
                <StatCard
                    label="Gebäude"
                    value={stats.totals.buildings.toLocaleString("de-DE")}
                    sub="über alle Regionen"
                    icon={<Building2 className="size-4" />}
                    accent="#f59e0b"
                />
                <StatCard
                    label="Builder"
                    value={stats.totals.uniqueBuilders.toLocaleString("de-DE")}
                    sub="einzigartige Spieler"
                    icon={<Users className="size-4" />}
                    accent="#a855f7"
                />
            </div>

            <GermanyProgress finishedArea={stats.totals.finishedArea} />

            {/* Hero: Ranglisten (Punkte / Fläche / Gebäude) */}
            <RankingSection players={stats.ranking} />

            {/* Vollständige sortierbare Tabelle mit eigener Position */}
            <ExtendedRankingTable players={stats.ranking} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SectionCard
                    icon={<LandPlot className="size-4" />}
                    title="Fläche pro Bundesland"
                    subtitle="Top 10"
                    className="lg:col-span-2"
                >
                    <StateBarChart data={stats.byState} />
                </SectionCard>

                <SectionCard
                    icon={<Layers className="size-4" />}
                    title="Region-Typen"
                >
                    <TypeDonutChart data={stats.byType} />
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SectionCard
                    icon={<Activity className="size-4" />}
                    title="Aktivität über die Zeit"
                    subtitle="pro Monat"
                    className="lg:col-span-2"
                >
                    {stats.timeline.length > 0 ? (
                        <TimelineChart data={stats.timeline} />
                    ) : (
                        <p className="text-sm text-neutral-500 text-center py-10">
                            Noch keine Zeitreihendaten verfügbar.
                        </p>
                    )}
                </SectionCard>

                <SectionCard
                    icon={<Sparkles className="size-4" />}
                    title="Flächennutzung"
                >
                    <LanduseStackedBar landuse={stats.landuse} />
                </SectionCard>
            </div>

            <SectionCard
                icon={<CheckCircle2 className="size-4" />}
                title="Größte Regionen"
                subtitle={`Top ${stats.topRegions.length}`}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {stats.topRegions.map((r, i) => (
                        <Link
                            key={r.id}
                            href={`/region/${r.id}`}
                            className="group rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-[10px] uppercase tracking-widest text-neutral-600">
                                    #{i + 1}
                                </span>
                                {r.finished && <CheckCircle2 className="size-3.5 text-emerald-400" />}
                            </div>
                            <p className="mt-2 font-medium text-sm text-white truncate group-hover:text-sky-300 transition-colors">
                                {r.address || r.city}
                            </p>
                            <p className="text-xs text-neutral-500 truncate">
                                {r.city}
                                {r.state ? `, ${stateCodeToName(r.state)}` : ""}
                            </p>
                            <div className="mt-3 flex items-center gap-3 text-xs text-neutral-400">
                                <span className="tabular-nums">{formatArea(r.area)}</span>
                                {r.buildings > 0 && (
                                    <span className="flex items-center gap-1">
                                        <Building2 className="size-3" />
                                        {r.buildings.toLocaleString("de-DE")}
                                    </span>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            </SectionCard>

            <ScoringExplainer />

        </div>
    );
}

function ScoringExplainer() {
    return (
        <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-transparent group-open:border-white/[0.04] cursor-pointer hover:bg-white/[0.02] transition-colors list-none select-none">
                <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-neutral-400" />
                    <p className="text-sm font-semibold text-white">Wie werden die Punkte berechnet?</p>
                </div>
                <ChevronDown className="size-4 text-neutral-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-5 space-y-5 text-sm text-neutral-400 leading-relaxed">
                <p>
                    Das Punktesystem soll <span className="text-white">tatsächlich gebaute Flächen</span> stärker belohnen
                    als unbebaute Naturflächen. Die Punkte einer Region werden immer gleichmäßig auf das gesamte Team
                    (Ersteller:in + eingetragene Mitbuilder) verteilt, damit Gemeinschaftsprojekte nicht bestraft werden.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
                        <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-2">Grundformel</p>
                        <div className="font-mono text-xs text-neutral-300 leading-relaxed">
                            <p>
                                <span className="text-sky-400">baseArea</span> = Fläche (m²) / 1000 ×{" "}
                                <span className="text-sky-400">{BASE_POINTS_PER_1000_SQM}</span>
                            </p>
                            <p className="mt-2">
                                <span className="text-emerald-400">raw</span> = baseArea × landuseMultiplier
                            </p>
                            <p className="mt-2">
                                <span className="text-amber-400">total</span> = (raw + buildings ×{" "}
                                <span className="text-sky-400">{BUILDING_POINT_BONUS}</span>) × finishedMultiplier
                            </p>
                            <p className="mt-2">
                                <span className="text-rose-400">pro Builder</span> = total / Teamgröße
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
                        <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-3">Landuse-Gewichte</p>
                        <div className="space-y-1.5 text-xs">
                            {Object.entries(LANDUSE_WEIGHTS)
                                .sort(([, a], [, b]) => b - a)
                                .map(([key, weight]) => (
                                    <div key={key} className="flex items-center justify-between">
                                        <span className="text-neutral-400 capitalize">{key}</span>
                                        <span className="tabular-nums text-white">×{weight.toFixed(2)}</span>
                                    </div>
                                ))}
                        </div>
                        <p className="mt-3 text-[11px] text-neutral-500">
                            Gewichteter Durchschnitt anhand der OSM-Flächennutzung. Ohne Daten: ×1.00.
                        </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4">
                        <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-3">Status-Multiplikator</p>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-400">Fertig</span>
                                <span className="tabular-nums text-white">×{FINISHED_MULTIPLIER.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-400">In Arbeit</span>
                                <span className="tabular-nums text-white">×{IN_PROGRESS_MULTIPLIER.toFixed(2)}</span>
                            </div>
                        </div>
                        <p className="mt-3 text-[11px] text-neutral-500">
                            Fertige Regionen bekommen einen Bonus, angefangene Regionen zählen reduziert.
                        </p>
                    </div>
                </div>

                <p className="text-xs text-neutral-500">
                    Beispiel: Eine 10.000 m² große, fertiggestellte Wohngebietsregion mit 40 Gebäuden,
                    allein gebaut, ergibt etwa (10 × 1,5 × 1,0 + 40 × 2) × 1,2 ≈ <span className="text-white font-semibold">114 Punkte</span>.
                </p>
            </div>
        </details>
    );
}
