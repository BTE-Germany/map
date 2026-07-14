"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronUp, LandPlot, Sparkles, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
const COLLAPSED_RANKING_HEIGHT = "21rem";

export default function RankingSection({ players }: { players: PlayerScore[] }) {
    const [metricKey, setMetricKey] = useState<MetricKey>("points");
    const [isExpanded, setIsExpanded] = useState(false);
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
    const canExpand = rest.length > 4;
    const visibleRest = isExpanded || !canExpand ? rest : rest.slice(0, 7);

    return (
        <section className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-amber-500/[0.04] via-neutral-950/60 to-indigo-500/[0.04] overflow-hidden relative">
            {/* Ambient glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 right-12 size-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

            <div className="relative">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap px-4 sm:px-6 md:px-8 pt-7 pb-5">
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
                    <div className="grid w-full grid-cols-3 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm sm:inline-flex sm:w-auto">
                        {(Object.keys(METRICS) as MetricKey[]).map((key) => {
                            const m = METRICS[key];
                            const active = key === metricKey;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setMetricKey(key)}
                                    className={`relative flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all sm:gap-2 sm:px-4 sm:text-sm ${active
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
                    <div className="px-3 sm:px-6 md:px-8 pb-6">
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-3 md:gap-6 items-end max-w-3xl mx-auto">
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
                    <div className="mx-2 sm:mx-4 md:mx-6 mb-6 rounded-2xl border border-white/[0.06] bg-neutral-950/40 backdrop-blur-sm overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                            <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
                                Plätze 4 – {Math.min(sorted.length, LIMIT)}
                            </p>
                            <p className="hidden text-[10px] uppercase tracking-widest text-neutral-600 sm:block">
                                sortiert nach {metric.title}
                            </p>
                        </div>

                        <div className="relative">
                            <motion.div
                                id="builder-ranking-list"
                                initial={false}
                                animate={{
                                    height: isExpanded || !canExpand ? "auto" : COLLAPSED_RANKING_HEIGHT,
                                }}
                                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                                className="divide-y divide-white/[0.04] overflow-hidden"
                            >
                                {visibleRest.map((player, i) => (
                                    <PlayerRankingRow
                                        key={player.uuid}
                                        player={player}
                                        rank={i + 4}
                                        maxValue={maxValue}
                                        metric={metric}
                                    />
                                ))}
                            </motion.div>

                            <AnimatePresence>
                                {!isExpanded && canExpand ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-32 items-end justify-center bg-gradient-to-t from-neutral-950 via-neutral-950/90 to-transparent pb-5 backdrop-blur-[1.5px] [mask-image:linear-gradient(to_top,black_55%,transparent)]"
                                    >
                                        <button
                                            type="button"
                                            aria-expanded={false}
                                            aria-controls="builder-ranking-list"
                                            onClick={() => setIsExpanded(true)}
                                            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/90 px-4 py-2 text-xs font-semibold text-white shadow-xl shadow-black/30 transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
                                        >
                                            Mehr anzeigen
                                            <ChevronDown className="size-3.5" />
                                        </button>
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>
                        </div>

                        {isExpanded && canExpand ? (
                            <div className="flex justify-center border-t border-white/[0.04] px-4 py-3">
                                <button
                                    type="button"
                                    aria-expanded={true}
                                    aria-controls="builder-ranking-list"
                                    onClick={() => setIsExpanded(false)}
                                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
                                >
                                    Weniger anzeigen
                                    <ChevronUp className="size-3.5" />
                                </button>
                            </div>
                        ) : null}
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
