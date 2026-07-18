import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
    Activity,
    ArrowLeft,
    Building2,
    CalendarDays,
    CheckCircle2,
    Crown,
    LandPlot,
    Map as MapIcon,
    MapPin,
    Shapes,
    Sparkles,
} from "lucide-react";

import { getRegionsByBuilder, type BuilderRegion } from "@/actions/builder/GetBuilderRegions";
import getUser from "@/actions/minecraft/user";
import { getGlobalStats } from "@/actions/stats/GetGlobalStats";
import BuilderRegionsGrid, { type BuilderRegionCardData } from "@/components/builder/BuilderRegionsGrid";
import { FloatingNavigationBar } from "@/components/common/NavigationBar";
import ProfileMiniMapWrapper from "@/components/profile/ProfileMiniMapWrapper";
import type { LandUseStats } from "@/db/schema";
import { stateCodeToName } from "@/lib/federalStates";
import { normalizeMinecraftUuid } from "@/lib/minecraftUuid";
import { regionsToCreatorGeoJSON } from "@/lib/regionGeo";
import { scoreRegion, type PlayerScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const getBuilderUser = cache(getUser);

const LANDUSE_LABELS: Record<keyof LandUseStats, string> = {
    residential: "Wohngebiete",
    industrial: "Gewerbe",
    park: "Parks",
    farmland: "Landwirtschaft",
    forest: "Wälder",
    water: "Wasser",
};

const TYPE_LABELS: Record<BuilderRegion["type"], string> = {
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

function formatDate(value: Date | null) {
    return value ? DATE_FORMATTER.format(value) : "—";
}

function getMetricRank(
    ranking: PlayerScore[],
    uuid: string,
    getValue: (player: PlayerScore) => number,
) {
    const sorted = [...ranking]
        .filter((player) => getValue(player) > 0)
        .sort((a, b) => getValue(b) - getValue(a));
    const index = sorted.findIndex((player) => player.uuid.toLowerCase() === uuid);
    return index >= 0 ? index + 1 : null;
}

function summarizeBuilderRegions(builderUuid: string, regions: BuilderRegion[]) {
    const stateMap = new Map<string, { count: number; area: number }>();
    const typeMap = new Map<BuilderRegion["type"], number>();
    const landuseTotals: LandUseStats = {
        residential: 0,
        industrial: 0,
        park: 0,
        farmland: 0,
        forest: 0,
        water: 0,
    };

    let totalPoints = 0;
    let projectArea = 0;
    let projectBuildings = 0;
    let finishedRegions = 0;
    let createdRegions = 0;
    let contributedRegions = 0;
    let teamRegions = 0;
    let firstActivity: Date | null = null;
    let latestActivity: Date | null = null;
    let largestRegion: BuilderRegion | null = null;
    const cards: BuilderRegionCardData[] = [];

    for (const region of regions) {
        const area = parseFloat(region.area ?? "0") || 0;
        const buildings = region.buildings ?? 0;
        const regionScore = scoreRegion({
            ...region,
            area,
            buildings,
            landuse: region.landuse ?? null,
            builders: region.builders ?? [],
        });
        const points = regionScore.team.some((uuid) => uuid.toLowerCase() === builderUuid)
            ? regionScore.perBuilder
            : 0;
        const isCreator = region.creatorUUID.toLowerCase() === builderUuid;

        totalPoints += points;
        projectArea += area;
        projectBuildings += buildings;
        if (region.finished) finishedRegions += 1;
        if (isCreator) createdRegions += 1;
        else contributedRegions += 1;
        if (regionScore.team.length > 1) teamRegions += 1;

        if (region.createdAt && (!firstActivity || region.createdAt < firstActivity)) {
            firstActivity = region.createdAt;
        }
        if (!latestActivity || region.modifiedAt > latestActivity) {
            latestActivity = region.modifiedAt;
        }
        if (!largestRegion || area > (parseFloat(largestRegion.area ?? "0") || 0)) {
            largestRegion = region;
        }

        const stateKey = region.state || "—";
        const state = stateMap.get(stateKey) ?? { count: 0, area: 0 };
        state.count += 1;
        state.area += area;
        stateMap.set(stateKey, state);
        typeMap.set(region.type, (typeMap.get(region.type) ?? 0) + 1);

        if (region.landuse) {
            for (const key of Object.keys(landuseTotals) as (keyof LandUseStats)[]) {
                landuseTotals[key] += region.landuse[key] ?? 0;
            }
        }

        cards.push({
            id: region.id,
            address: region.address,
            city: region.city,
            stateName: stateCodeToName(region.state),
            area,
            buildings,
            points,
            finished: region.finished,
            type: region.type,
            role: isCreator ? "creator" : "builder",
            createdAt: region.createdAt?.toISOString() ?? null,
            modifiedAt: region.modifiedAt.toISOString(),
        });
    }

    const states = Array.from(stateMap.entries())
        .map(([state, values]) => ({ state, ...values }))
        .sort((a, b) => b.area - a.area);
    const types = Array.from(typeMap.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
    const dominantLanduse = (Object.keys(landuseTotals) as (keyof LandUseStats)[])
        .map((key) => ({ key, value: landuseTotals[key] }))
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value)[0]?.key ?? null;

    return {
        totalPoints,
        projectArea,
        projectBuildings,
        finishedRegions,
        createdRegions,
        contributedRegions,
        teamRegions,
        firstActivity,
        latestActivity,
        largestRegion,
        states,
        types,
        dominantLanduse,
        cards,
    };
}

function ProfileStatCard({
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

export async function generateMetadata({ params }: { params: Promise<{ uuid: string }> }): Promise<Metadata> {
    const { uuid: rawUuid } = await params;
    const uuid = normalizeMinecraftUuid(rawUuid);
    if (!uuid) return { title: "Builder nicht gefunden — BTE Germany" };

    const player = await getBuilderUser(uuid);
    const username = player?.username ?? uuid.slice(0, 8);
    return {
        title: `${username} — Builderprofil`,
        description: `Regionen, Punkte und Baustatistiken von ${username} auf BTE Germany.`,
    };
}

export default async function BuilderProfilePage({ params }: { params: Promise<{ uuid: string }> }) {
    const { uuid: rawUuid } = await params;
    const normalizedUuid = normalizeMinecraftUuid(rawUuid);
    if (!normalizedUuid) notFound();

    const uuid = normalizedUuid.toLowerCase();
    const [player, regions, globalStats] = await Promise.all([
        getBuilderUser(uuid),
        getRegionsByBuilder(uuid),
        getGlobalStats(),
    ]);
    if (regions.length === 0) notFound();

    const username = player?.username ?? `Builder ${uuid.slice(0, 8)}`;
    const summary = summarizeBuilderRegions(uuid, regions);
    const rankingEntry = globalStats.ranking.find((entry) => entry.uuid.toLowerCase() === uuid);
    const pointsRank = getMetricRank(globalStats.ranking, uuid, (entry) => entry.totalPoints);
    const areaRank = getMetricRank(globalStats.ranking, uuid, (entry) => entry.totalArea);
    const buildingsRank = getMetricRank(globalStats.ranking, uuid, (entry) => entry.buildings);
    const completionRate = Math.round((summary.finishedRegions / regions.length) * 100);
    const maxStateArea = summary.states[0]?.area ?? 1;
    const geoJSON = regionsToCreatorGeoJSON(regions);

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

                <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-sky-500/[0.07] via-neutral-950 to-violet-500/[0.06]">
                    <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-sky-500/10 blur-3xl" />
                    <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:32px_32px]" />

                    <div className="relative grid lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8 lg:p-10">
                            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                                <div className="relative shrink-0">
                                    <div className="absolute inset-0 rounded-3xl bg-sky-400/20 blur-2xl" />
                                    <Image
                                        src={`https://minotar.net/helm/${uuid}`}
                                        alt={`Minecraft-Avatar von ${username}`}
                                        width={112}
                                        height={112}
                                        priority
                                        className="relative size-24 rounded-3xl bg-neutral-900 ring-2 ring-white/10 sm:size-28"
                                    />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-300/70">
                                        Builderprofil
                                    </p>
                                    <h1 className="mt-1 break-words text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                                        {username}
                                    </h1>
                                    <p className="mt-2 break-all font-mono text-[10px] text-neutral-600 sm:text-xs">{uuid}</p>
                                </div>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-2">
                                {pointsRank ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                                        <Crown className="size-3.5" /> Rang #{pointsRank}
                                    </span>
                                ) : null}
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300">
                                    <CalendarDays className="size-3.5 text-neutral-500" /> Aktiv seit {formatDate(summary.firstActivity)}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300">
                                    <MapPin className="size-3.5 text-neutral-500" /> {summary.states.length} Bundesländer
                                </span>
                            </div>
                        </div>

                        <div className="relative min-h-64 border-t border-white/[0.06] lg:min-h-80 lg:border-l lg:border-t-0">
                            <ProfileMiniMapWrapper geoJSON={geoJSON} />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-neutral-950/25 via-transparent to-transparent" />
                            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-neutral-950/75 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-400 backdrop-blur">
                                Alle Projekte
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <ProfileStatCard
                        label="Punkte"
                        value={Math.round(summary.totalPoints).toLocaleString("de-DE")}
                        detail={pointsRank ? `Rang #${pointsRank} deutschlandweit` : "Noch ohne Ranglistenplatz"}
                        icon={<Sparkles className="size-4" />}
                        accent="#f59e0b"
                    />
                    <ProfileStatCard
                        label="Regionen"
                        value={regions.length.toLocaleString("de-DE")}
                        detail={`${summary.createdRegions} erstellt · ${summary.contributedRegions} mitgebaut`}
                        icon={<MapIcon className="size-4" />}
                        accent="#3b82f6"
                    />
                    <ProfileStatCard
                        label="Projektfläche"
                        value={formatArea(summary.projectArea)}
                        detail={areaRank && rankingEntry ? `${formatArea(rankingEntry.totalArea)} gewertet · Rang #${areaRank}` : "Über alle Projekte"}
                        icon={<LandPlot className="size-4" />}
                        accent="#22c55e"
                    />
                    <ProfileStatCard
                        label="Gebäude"
                        value={summary.projectBuildings.toLocaleString("de-DE")}
                        detail={buildingsRank && rankingEntry ? `${Math.round(rankingEntry.buildings).toLocaleString("de-DE")} gewertet · Rang #${buildingsRank}` : "Über alle Projekte"}
                        icon={<Building2 className="size-4" />}
                        accent="#f97316"
                    />
                    <ProfileStatCard
                        label="Fertiggestellt"
                        value={`${completionRate} %`}
                        detail={`${summary.finishedRegions} von ${regions.length} Regionen`}
                        icon={<CheckCircle2 className="size-4" />}
                        accent="#10b981"
                    />
                </section>

                <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] lg:col-span-2">
                        <header className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-5 py-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <LandPlot className="size-4 text-violet-400" />
                                Projektfläche nach Bundesland
                            </div>
                            <span className="text-[9px] uppercase tracking-widest text-neutral-600">Top {Math.min(summary.states.length, 8)}</span>
                        </header>
                        <div className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
                            {summary.states.slice(0, 8).map((state) => (
                                <div key={state.state} className="space-y-2">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="truncate font-medium text-neutral-300">{stateCodeToName(state.state)}</span>
                                        <span className="shrink-0 tabular-nums text-neutral-500">
                                            {formatArea(state.area)} · {state.count}×
                                        </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400"
                                            style={{ width: `${(state.area / maxStateArea) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                        <header className="flex items-center gap-2 border-b border-white/[0.05] px-5 py-4 text-sm font-semibold text-white">
                            <Activity className="size-4 text-sky-400" />
                            Profil im Überblick
                        </header>
                        <dl className="px-5 py-1">
                            <DetailRow label="Top-Bundesland" value={summary.states[0] ? stateCodeToName(summary.states[0].state) : "—"} />
                            <DetailRow
                                label="Größtes Projekt"
                                value={summary.largestRegion ? (
                                    <Link href={`/region/${summary.largestRegion.id}`} prefetch={false} className="transition-colors hover:text-sky-300">
                                        {summary.largestRegion.address || summary.largestRegion.city}
                                    </Link>
                                ) : "—"}
                            />
                            <DetailRow label="Ø Projektfläche" value={formatArea(summary.projectArea / regions.length)} />
                            <DetailRow label="Teamprojekte" value={`${summary.teamRegions} von ${regions.length}`} />
                            <DetailRow
                                label="Bauschwerpunkt"
                                value={summary.dominantLanduse ? LANDUSE_LABELS[summary.dominantLanduse] : "Keine Flächendaten"}
                            />
                            <DetailRow label="Zuletzt aktiv" value={formatDate(summary.latestActivity)} />
                        </dl>
                        <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] px-5 py-4">
                            <Shapes className="mr-1 size-3.5 text-neutral-600" />
                            {summary.types.map((entry) => (
                                <span key={entry.type} className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-neutral-500 ring-1 ring-inset ring-white/[0.06]">
                                    {TYPE_LABELS[entry.type]} {entry.count}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="space-y-4 pt-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-400/70">Projektarchiv</p>
                            <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Alle Regionen</h2>
                        </div>
                        <p className="max-w-xl text-xs leading-relaxed text-neutral-500 sm:text-right">
                            Selbst erstellte und gemeinsam gebaute Regionen. Die Punkte zeigen den persönlichen Anteil an der jeweiligen Region.
                        </p>
                    </div>
                    <BuilderRegionsGrid regions={summary.cards} />
                </section>
            </main>
        </div>
    );
}
