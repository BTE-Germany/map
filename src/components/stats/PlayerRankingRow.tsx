"use client";

import { useMcUser } from "@/dataHooks/minecraft/useMcUser";
import { Building2, LandPlot, Trophy } from "lucide-react";
import type { PlayerScore } from "@/lib/scoring";

function formatArea(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} km²`;
    if (n >= 10_000) return `${(n / 10_000).toFixed(1)} ha`;
    return `${Math.round(n).toLocaleString("de-DE")} m²`;
}

function rankColors(rank: number) {
    if (rank === 1) return { bg: "bg-amber-500/10", text: "text-amber-400", ring: "ring-amber-500/30" };
    if (rank === 2) return { bg: "bg-neutral-400/10", text: "text-neutral-300", ring: "ring-neutral-400/30" };
    if (rank === 3) return { bg: "bg-orange-600/10", text: "text-orange-400", ring: "ring-orange-500/30" };
    return { bg: "bg-white/[0.03]", text: "text-neutral-400", ring: "ring-white/10" };
}

export interface RankingMetric {
    label: string;
    getValue: (p: PlayerScore) => number;
    format: (v: number) => string;
}

export default function PlayerRankingRow({
    player,
    rank,
    maxValue,
    metric,
}: {
    player: PlayerScore;
    rank: number;
    maxValue: number;
    metric: RankingMetric;
}) {
    const { data: mc } = useMcUser(player.uuid);
    const colors = rankColors(rank);
    const value = metric.getValue(player);
    const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;

    const username = mc?.username ?? player.uuid.slice(0, 8);
    const avatar = mc?.avatar ?? `https://minotar.net/helm/${player.uuid}`;

    return (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-3 transition-colors hover:bg-white/[0.02] sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:gap-4 sm:px-5">
            <div
                className={`flex items-center justify-center size-9 sm:size-10 rounded-xl ring-1 ${colors.bg} ${colors.ring} shrink-0`}
            >
                {rank <= 3 ? (
                    <Trophy className={`size-4 ${colors.text}`} />
                ) : (
                    <span className={`text-sm font-semibold tabular-nums ${colors.text}`}>#{rank}</span>
                )}
            </div>

            <img src={avatar} alt={username} className="hidden size-10 rounded-lg shrink-0 sm:block" />

            <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                    <p className="font-semibold text-sm text-white truncate">{username}</p>
                    <span className="hidden text-[10px] uppercase tracking-widest text-neutral-600 min-[420px]:inline">
                        {player.regionCount} {player.regionCount === 1 ? "Region" : "Regionen"}
                    </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden max-w-xs">
                        <div
                            className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
                <div className="mt-1.5 hidden items-center gap-3 text-[11px] text-neutral-500 sm:flex">
                    <span className="flex items-center gap-1">
                        <LandPlot className="size-3" />
                        {formatArea(player.totalArea)}
                    </span>
                    {player.buildings > 0 && (
                        <span className="flex items-center gap-1">
                            <Building2 className="size-3" />
                            {Math.round(player.buildings).toLocaleString("de-DE")}
                        </span>
                    )}
                    {player.finishedRegionCount > 0 && <span>{player.finishedRegionCount} fertig</span>}
                    {player.teamRegions > 0 && <span>{player.teamRegions} im Team</span>}
                </div>
            </div>

            <div className="text-right">
                <p className="max-w-[7.5rem] truncate text-base font-bold tabular-nums text-white sm:text-xl">{metric.format(value)}</p>
                <p className="text-[10px] uppercase tracking-widest text-neutral-600">{metric.label}</p>
            </div>
        </div>
    );
}
