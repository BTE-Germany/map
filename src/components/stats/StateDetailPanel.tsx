"use client";

import { Building2, Construction, Hammer, LandPlot, MapPin, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useMcUser } from "@/dataHooks/minecraft/useMcUser";
import type { PlayerScore } from "@/lib/scoring";
import type { StateCityStats, StateStats } from "@/lib/stateStats";
import { formatArea, formatCoverage, formatNumber, formatRegionCount } from "./stateMetrics";

function StatTile({
    icon,
    label,
    value,
    sub,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    accent: string;
}) {
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-2">
                <span style={{ color: accent }}>{icon}</span>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{label}</p>
            </div>
            <p className="mt-2 text-lg font-bold leading-tight text-white break-words">{value}</p>
            {sub && <p className="mt-0.5 text-[11px] text-neutral-500">{sub}</p>}
        </div>
    );
}

function ProgressBar({ state }: { state: StateStats }) {
    const percent = state.officialArea ? (state.finishedArea / state.officialArea) * 100 : 0;
    // Unter ~0,3 % wäre der Balken unsichtbar — ein Mindeststreifen zeigt, dass
    // überhaupt etwas da ist, ohne den Wert zu verfälschen (die Zahl steht daneben).
    const barWidth = Math.min(100, percent);

    return (
        <div className="rounded-2xl border border-emerald-400/10 bg-gradient-to-r from-emerald-500/[0.07] via-white/[0.02] to-sky-500/[0.05] p-4">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/70">
                        Fertig gebaut
                    </p>
                    <p className="mt-1 text-2xl font-bold leading-none text-white">{formatCoverage(percent)}</p>
                </div>
                <p className="text-right text-xs text-neutral-400">
                    <span className="tabular-nums text-neutral-200">{formatArea(state.finishedArea)}</span>
                    <span className="text-neutral-600"> von </span>
                    <span className="tabular-nums">
                        {state.officialArea ? formatArea(state.officialArea) : "—"}
                    </span>
                </p>
            </div>

            <div className="mt-3 h-2 rounded-full bg-white/[0.05] ring-1 ring-inset ring-white/[0.04]">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 shadow-[0_0_12px_rgba(52,211,153,0.4)] transition-[width] duration-500"
                    style={{ width: `${barWidth}%`, minWidth: state.finishedArea > 0 ? "3px" : undefined }}
                />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-neutral-600">
                <span>0 %</span>
                <span>Landesfläche</span>
            </div>
        </div>
    );
}

function TopPlayerRow({ player, rank, maxPoints }: { player: PlayerScore; rank: number; maxPoints: number }) {
    const { data: mc } = useMcUser(player.uuid);
    const username = mc?.username ?? player.uuid.slice(0, 8);
    const avatar = mc?.avatar ?? `https://minotar.net/helm/${player.uuid}`;
    const pct = maxPoints > 0 ? (player.totalPoints / maxPoints) * 100 : 0;

    return (
        <Link
            href={`/builder/${player.uuid}`}
            prefetch={false}
            aria-label={`Builderprofil von ${username} öffnen`}
            className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400/50"
        >
            <span
                className={`w-4 shrink-0 text-right text-xs font-semibold tabular-nums ${rank === 1 ? "text-amber-300" : "text-neutral-600"
                    }`}
            >
                {rank}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar} alt="" className="size-7 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white transition-colors group-hover:text-sky-300">
                    {username}
                </p>
                <div className="mt-1 h-1 max-w-[10rem] overflow-hidden rounded-full bg-white/[0.05]">
                    {/* Amber = Ranglisten-Akzent der Seite, Blau = Kartenrampe. */}
                    <div className="h-full rounded-full bg-amber-400/80" style={{ width: `${pct}%` }} />
                </div>
            </div>
            <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-white">{formatNumber(player.totalPoints)}</p>
                <p className="text-[10px] uppercase tracking-wider text-neutral-600">Punkte</p>
            </div>
        </Link>
    );
}

function CityRow({ city, rank, maxArea }: { city: StateCityStats; rank: number; maxArea: number }) {
    const pct = maxArea > 0 ? (city.totalArea / maxArea) * 100 : 0;

    return (
        <div className="flex items-center gap-3 px-2.5 py-2">
            <span className="w-4 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-600">{rank}</span>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <p className="truncate text-sm font-medium text-white">{city.city}</p>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-neutral-600">
                        {formatRegionCount(city.regions)}
                    </span>
                </div>
                <div className="mt-1 h-1 max-w-[10rem] overflow-hidden rounded-full bg-white/[0.05]">
                    {/* Gleiches Blau wie die Karte — Städte sind Fläche, wie die Heatmap. */}
                    <div className="h-full rounded-full bg-[#3987e5]" style={{ width: `${pct}%` }} />
                </div>
            </div>
            <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-white">{formatArea(city.totalArea)}</p>
                {city.buildings > 0 && (
                    <p className="flex items-center justify-end gap-1 text-[10px] tabular-nums text-neutral-500">
                        <Building2 className="size-2.5" />
                        {formatNumber(city.buildings)}
                    </p>
                )}
            </div>
        </div>
    );
}

function ListCard({
    icon,
    title,
    subtitle,
    empty,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    empty: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <span className="text-neutral-500">{icon}</span>
                    <p className="text-xs font-semibold text-white">{title}</p>
                </div>
                {subtitle && <p className="text-[10px] uppercase tracking-widest text-neutral-600">{subtitle}</p>}
            </div>
            <div className="p-1.5">
                {empty ? <p className="px-3 py-5 text-center text-xs text-neutral-600">Noch keine Daten</p> : children}
            </div>
        </div>
    );
}

export default function StateDetailPanel({ state }: { state: StateStats }) {
    const maxPoints = state.topPlayers[0]?.totalPoints ?? 0;
    const maxCityArea = state.topCities[0]?.totalArea ?? 0;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex items-center gap-2.5">
                    <span className="rounded-lg bg-sky-400/10 px-2 py-1 text-xs font-bold tabular-nums tracking-wider text-sky-300 ring-1 ring-inset ring-sky-400/20">
                        {state.code}
                    </span>
                    <h3 className="text-xl font-bold leading-tight text-white">{state.name}</h3>
                </div>
                <p className="text-xs text-neutral-500">
                    <span className="tabular-nums text-neutral-300">{formatRegionCount(state.regions)}</span>
                    <span className="text-neutral-700"> · </span>
                    <span className="tabular-nums text-neutral-300">{formatNumber(state.finishedRegions)}</span> fertig
                </p>
            </div>

            <ProgressBar state={state} />

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <StatTile
                    icon={<LandPlot className="size-3.5" />}
                    label="Fertig"
                    value={formatArea(state.finishedArea)}
                    sub={formatRegionCount(state.finishedRegions)}
                    accent="#34d399"
                />
                <StatTile
                    icon={<Construction className="size-3.5" />}
                    label="Im Bau"
                    value={formatArea(state.inProgressArea)}
                    sub={formatRegionCount(state.inProgressRegions)}
                    accent="#fbbf24"
                />
                <StatTile
                    icon={<Building2 className="size-3.5" />}
                    label="Gebäude"
                    value={formatNumber(state.buildings)}
                    sub={`${formatNumber(state.finishedBuildings)} in fertigen Regionen`}
                    accent="#38bdf8"
                />
                <StatTile
                    icon={<Users className="size-3.5" />}
                    label="Builder"
                    value={formatNumber(state.builders)}
                    sub="beteiligt"
                    accent="#c084fc"
                />
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <ListCard
                    icon={<Trophy className="size-3.5" />}
                    title="Top Builder"
                    subtitle={state.topPlayers.length > 0 ? `Top ${state.topPlayers.length}` : undefined}
                    empty={state.topPlayers.length === 0}
                >
                    <div className="flex flex-col">
                        {state.topPlayers.map((player, i) => (
                            <TopPlayerRow key={player.uuid} player={player} rank={i + 1} maxPoints={maxPoints} />
                        ))}
                    </div>
                </ListCard>

                <ListCard
                    icon={<MapPin className="size-3.5" />}
                    title="Top Städte"
                    subtitle={state.topCities.length > 0 ? "nach Fläche" : undefined}
                    empty={state.topCities.length === 0}
                >
                    <div className="flex flex-col">
                        {state.topCities.map((city, i) => (
                            <CityRow key={city.city} city={city} rank={i + 1} maxArea={maxCityArea} />
                        ))}
                    </div>
                </ListCard>
            </div>

            {state.regions === 0 && (
                <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] px-4 py-6 text-xs text-neutral-500">
                    <Hammer className="size-3.5" />
                    In {state.name} wurde noch keine Region angelegt.
                </p>
            )}
        </div>
    );
}
