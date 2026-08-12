"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, Circle, LandPlot, Sparkles } from "lucide-react";
import type { CityRegionEntry } from "@/lib/cityStats";

const TYPE_LABELS: Record<CityRegionEntry["type"], string> = {
    default: "Standard",
    plot: "Plot",
    event: "Event",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});

/**
 * Wie viele Regionen zunächst zu sehen sind. Große Städte kommen auf dreistellige
 * Zahlen — alle auf einmal zu rendern macht die Seite lang und langsam, ohne dass
 * jemand so weit scrollt.
 */
const INITIAL_VISIBLE = 24;

type SortKey = "area" | "buildings" | "points" | "latest";

const SORT_LABELS: Record<SortKey, string> = {
    area: "Fläche",
    buildings: "Gebäude",
    points: "Punkte",
    latest: "Zuletzt",
};

function formatArea(area: number) {
    if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`;
    if (area >= 10_000) return `${(area / 10_000).toFixed(1)} ha`;
    return `${Math.round(area).toLocaleString("de-DE")} m²`;
}

export default function CityRegionsList({ regions }: { regions: CityRegionEntry[] }) {
    const [sortKey, setSortKey] = useState<SortKey>("area");
    const [statusFilter, setStatusFilter] = useState<"all" | "finished" | "open">("all");
    const [visible, setVisible] = useState(INITIAL_VISIBLE);

    const sorted = useMemo(() => {
        const filtered = regions.filter((r) =>
            statusFilter === "all" ? true : statusFilter === "finished" ? r.finished : !r.finished,
        );
        return [...filtered].sort((a, b) => {
            if (sortKey === "area") return b.area - a.area;
            if (sortKey === "buildings") return b.buildings - a.buildings;
            if (sortKey === "points") return b.points - a.points;
            const aDate = a.modifiedAt ?? a.createdAt ?? "";
            const bDate = b.modifiedAt ?? b.createdAt ?? "";
            return bDate.localeCompare(aDate);
        });
    }, [regions, sortKey, statusFilter]);

    const shown = sorted.slice(0, visible);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={sortKey === key}
                            onClick={() => setSortKey(key)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${sortKey === key ? "bg-white/[0.09] text-white" : "text-neutral-500 hover:text-neutral-200"
                                }`}
                        >
                            {SORT_LABELS[key]}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                    {([
                        ["all", "Alle"],
                        ["finished", "Fertig"],
                        ["open", "In Arbeit"],
                    ] as const).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={statusFilter === key}
                            onClick={() => setStatusFilter(key)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === key ? "bg-white/[0.09] text-white" : "text-neutral-500 hover:text-neutral-200"
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <p className="text-xs tabular-nums text-neutral-600">
                    {sorted.length} {sorted.length === 1 ? "Region" : "Regionen"}
                </p>
            </div>

            {shown.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-10 text-center text-xs text-neutral-500">
                    Keine Region mit diesem Status.
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {shown.map((entry) => (
                        <Link
                            key={entry.id}
                            href={`/region/${entry.id}`}
                            prefetch={false}
                            className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 flex-1 truncate text-sm font-medium text-white transition-colors group-hover:text-sky-300">
                                    {entry.address || <span className="italic text-neutral-600">Ohne Adresse</span>}
                                </p>
                                {entry.finished ? (
                                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                                ) : (
                                    <Circle className="size-3.5 shrink-0 text-amber-400/70" />
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
                                <span className="flex items-center gap-1 tabular-nums">
                                    <LandPlot className="size-3 text-neutral-600" />
                                    {formatArea(entry.area)}
                                </span>
                                {entry.buildings > 0 && (
                                    <span className="flex items-center gap-1 tabular-nums">
                                        <Building2 className="size-3 text-neutral-600" />
                                        {entry.buildings.toLocaleString("de-DE")}
                                    </span>
                                )}
                                {entry.points > 0 && (
                                    <span className="flex items-center gap-1 tabular-nums">
                                        <Sparkles className="size-3 text-neutral-600" />
                                        {Math.round(entry.points).toLocaleString("de-DE")}
                                    </span>
                                )}
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-neutral-600">
                                <span className="rounded-full bg-white/[0.04] px-2 py-0.5 ring-1 ring-inset ring-white/[0.06]">
                                    {TYPE_LABELS[entry.type]}
                                </span>
                                <span className="tabular-nums">
                                    {entry.createdAt ? DATE_FORMATTER.format(new Date(entry.createdAt)) : "—"}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {visible < sorted.length && (
                <button
                    type="button"
                    onClick={() => setVisible((v) => v + INITIAL_VISIBLE)}
                    className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                    Weitere {Math.min(INITIAL_VISIBLE, sorted.length - visible)} von {sorted.length - visible} anzeigen
                </button>
            )}
        </div>
    );
}
