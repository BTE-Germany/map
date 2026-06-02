"use client";

import { useMemo, useState } from "react";
import { Building2, LandPlot, Sparkles, Trophy } from "lucide-react";
import type { PlayerScore } from "@/lib/scoring";
import PlayerRankingRow, { type RankingMetric } from "./PlayerRankingRow";
import PodiumCard from "./PodiumCard";

function formatArea(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} km²`;
    if (n >= 10_000) return `${(n / 10_000).toFixed(1)} ha`;
    return `${Math.round(n).toLocaleString("de-DE")} m²`;
}

const METRICS: Record<"points" | "area" | "buildings", RankingMetric & { icon: React.ReactNode; title: string }> = {
    points: {
        label: "Punkte",
        title: "Punkte",
        icon: <Sparkles className="size-3.5" />,
        getValue: (p) => p.totalPoints,
        format: (v) => Math.round(v).toLocaleString("de-DE"),
    },
    area: {
        label: "Fläche",
        title: "Fläche",
        icon: <LandPlot className="size-3.5" />,
        getValue: (p) => p.totalArea,
        format: (v) => formatArea(v),
    },
    buildings: {
        label: "Gebäude",
        title: "Gebäude",
        icon: <Building2 className="size-3.5" />,
        getValue: (p) => p.buildings,
        format: (v) => Math.round(v).toLocaleString("de-DE"),
    },
};

type MetricKey = keyof typeof METRICS;

const LIMIT = 50;

export default function RankingSection({ players }: { players: PlayerScore[] }) {
    const [metricKey, setMetricKey] = useState<MetricKey>("points");
    const metric = METRICS[metricKey];

    const sorted = useMemo(() => {
        return [...players]
            .filter((p) => metric.getValue(p) > 0)
            .sort((a, b) => metric.getValue(b) - metric.getValue(a))
            .slice(0, LIMIT);
    }, [players, metric]);

    const maxValue = sorted[0] ? metric.getValue(sorted[0]) : 0;
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3);

    return (
        <section className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-amber-500/[0.04] via-neutral-950/60 to-indigo-500/[0.04] overflow-hidden relative">
            {/* Ambient glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 right-12 size-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

            <div className="relative">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap px-6 md:px-8 pt-7 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="size-11 rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30 flex items-center justify-center">
                            <Trophy className="size-5 text-amber-300" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-amber-400/80">
                                Leaderboard
                            </p>
                            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                                Die besten Builder
                            </h2>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                        {(Object.keys(METRICS) as MetricKey[]).map((key) => {
                            const m = METRICS[key];
                            const active = key === metricKey;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setMetricKey(key)}
                                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active
                                        ? "bg-white/[0.08] text-white shadow-sm"
                                        : "text-neutral-400 hover:text-neutral-200"
                                        }`}
                                >
                                    <span className={active ? "text-amber-300" : ""}>{m.icon}</span>
                                    {m.title}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Podium */}
                {top3.length > 0 && (
                    <div className="px-6 md:px-8 pb-6">
                        <div className="grid grid-cols-3 gap-3 md:gap-6 items-end max-w-3xl mx-auto">
                            {/* #2 on the left */}
                            <div className="pt-10">
                                {top3[1] ? (
                                    <PodiumCard
                                        player={top3[1]}
                                        rank={2}
                                        value={metric.format(metric.getValue(top3[1]))}
                                        valueLabel={metric.label}
                                    />
                                ) : null}
                            </div>
                            {/* #1 center, elevated */}
                            <div>
                                {top3[0] ? (
                                    <PodiumCard
                                        player={top3[0]}
                                        rank={1}
                                        value={metric.format(metric.getValue(top3[0]))}
                                        valueLabel={metric.label}
                                    />
                                ) : null}
                            </div>
                            {/* #3 on the right */}
                            <div className="pt-14">
                                {top3[2] ? (
                                    <PodiumCard
                                        player={top3[2]}
                                        rank={3}
                                        value={metric.format(metric.getValue(top3[2]))}
                                        valueLabel={metric.label}
                                    />
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}

                {/* Rest of the ranking */}
                {rest.length > 0 && (
                    <div className="mx-4 md:mx-6 mb-6 rounded-2xl border border-white/[0.06] bg-neutral-950/40 backdrop-blur-sm overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                            <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
                                Plätze 4 – {Math.min(sorted.length, LIMIT)}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                                sortiert nach {metric.title}
                            </p>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                            {rest.map((player, i) => (
                                <PlayerRankingRow
                                    key={player.uuid}
                                    player={player}
                                    rank={i + 4}
                                    maxValue={maxValue}
                                    metric={metric}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {sorted.length === 0 && (
                    <div className="px-8 py-16 text-center text-neutral-500 text-sm">
                        Noch keine Einträge in dieser Rangliste.
                    </div>
                )}
            </div>
        </section>
    );
}
