"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
    ArrowUpRight,
    Building2,
    CalendarDays,
    CheckCircle2,
    Circle,
    LandPlot,
    MapPin,
    Search,
    Sparkles,
    UserRoundCheck,
    UsersRound,
} from "lucide-react";

export type BuilderRegionCardData = {
    id: string;
    address: string;
    city: string;
    stateName: string;
    area: number;
    buildings: number;
    points: number;
    finished: boolean;
    type: "default" | "plot" | "event";
    role: "creator" | "builder";
    createdAt: string | null;
    modifiedAt: string;
};

type StatusFilter = "all" | "finished" | "open";
type SortKey = "latest" | "area" | "buildings" | "points";

const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});

const TYPE_LABELS: Record<BuilderRegionCardData["type"], string> = {
    default: "Standard",
    plot: "Plot",
    event: "Event",
};

function formatArea(area: number) {
    if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`;
    if (area >= 10_000) return `${(area / 10_000).toFixed(1)} ha`;
    return `${Math.round(area).toLocaleString("de-DE")} m²`;
}

function formatDate(value: string | null) {
    return value ? DATE_FORMATTER.format(new Date(value)) : "—";
}

function RegionCard({ region }: { region: BuilderRegionCardData }) {
    const isCreator = region.role === "creator";

    return (
        <Link
            href={`/region/${region.id}`}
            prefetch={false}
            className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 [content-visibility:auto] [contain-intrinsic-size:0_190px]"
        >
            <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${
                    region.finished ? "via-emerald-400/60" : "via-sky-400/60"
                } to-transparent`}
            />

            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                            isCreator
                                ? "bg-sky-500/10 text-sky-300 ring-sky-400/20"
                                : "bg-violet-500/10 text-violet-300 ring-violet-400/20"
                        }`}
                    >
                        {isCreator ? <UserRoundCheck className="size-3" /> : <UsersRound className="size-3" />}
                        {isCreator ? "Erstellt" : "Mitgebaut"}
                    </span>
                    <span className="truncate text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                        {TYPE_LABELS[region.type]}
                    </span>
                </div>

                {region.finished ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        Fertig
                    </span>
                ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-neutral-500">
                        <Circle className="size-3.5" />
                        Offen
                    </span>
                )}
            </div>

            <div className="mt-4 min-w-0">
                <h3 className="truncate text-base font-semibold text-white transition-colors group-hover:text-sky-300">
                    {region.address || region.city || "Region"}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-neutral-500">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{[region.city, region.stateName].filter(Boolean).join(", ")}</span>
                </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 border-y border-white/[0.05] py-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-neutral-600">
                        <LandPlot className="size-3" /> Fläche
                    </p>
                    <p className="mt-1 truncate text-xs font-semibold tabular-nums text-neutral-200">
                        {formatArea(region.area)}
                    </p>
                </div>
                <div className="min-w-0 border-l border-white/[0.05] pl-2">
                    <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-neutral-600">
                        <Building2 className="size-3" /> Gebäude
                    </p>
                    <p className="mt-1 truncate text-xs font-semibold tabular-nums text-neutral-200">
                        {region.buildings.toLocaleString("de-DE")}
                    </p>
                </div>
                <div className="min-w-0 border-l border-white/[0.05] pl-2">
                    <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-neutral-600">
                        <Sparkles className="size-3" /> Punkte
                    </p>
                    <p className="mt-1 truncate text-xs font-semibold tabular-nums text-neutral-200">
                        {Math.round(region.points).toLocaleString("de-DE")}
                    </p>
                </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-neutral-600">
                <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3" />
                    {formatDate(region.createdAt)}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-neutral-500 transition-colors group-hover:text-sky-300">
                    Details <ArrowUpRight className="size-3" />
                </span>
            </div>
        </Link>
    );
}

export default function BuilderRegionsGrid({ regions }: { regions: BuilderRegionCardData[] }) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [sortKey, setSortKey] = useState<SortKey>("latest");

    const filteredRegions = useMemo(() => {
        const query = search.trim().toLocaleLowerCase("de-DE");
        const filtered = regions.filter((region) => {
            if (status === "finished" && !region.finished) return false;
            if (status === "open" && region.finished) return false;
            if (!query) return true;

            return [
                region.address,
                region.city,
                region.stateName,
                TYPE_LABELS[region.type],
            ].some((value) => value.toLocaleLowerCase("de-DE").includes(query));
        });

        return filtered.sort((a, b) => {
            if (sortKey === "area") return b.area - a.area;
            if (sortKey === "buildings") return b.buildings - a.buildings;
            if (sortKey === "points") return b.points - a.points;
            return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
        });
    }, [regions, search, sortKey, status]);

    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-600" />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Region, Stadt oder Bundesland suchen…"
                        className="w-full rounded-xl border border-white/[0.07] bg-black/20 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-sky-400/40"
                    />
                </div>

                <div className="grid grid-cols-3 rounded-xl border border-white/[0.07] bg-black/20 p-1 text-xs sm:flex">
                    {([
                        ["all", "Alle"],
                        ["finished", "Fertig"],
                        ["open", "Offen"],
                    ] as const).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setStatus(value)}
                            className={`rounded-lg px-3 py-1.5 transition-colors ${
                                status === value ? "bg-white/[0.09] text-white" : "text-neutral-500 hover:text-neutral-300"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <select
                    value={sortKey}
                    onChange={(event) => setSortKey(event.target.value as SortKey)}
                    aria-label="Regionen sortieren"
                    className="rounded-xl border border-white/[0.07] bg-neutral-950 px-3 py-2.5 text-xs text-neutral-300 outline-none focus:border-sky-400/40"
                >
                    <option value="latest">Zuletzt bearbeitet</option>
                    <option value="area">Größte Fläche</option>
                    <option value="buildings">Meiste Gebäude</option>
                    <option value="points">Meiste Punkte</option>
                </select>
            </div>

            <div className="flex items-center justify-between gap-4 px-1 text-xs text-neutral-500">
                <p>
                    <span className="font-semibold tabular-nums text-neutral-300">{filteredRegions.length}</span>{" "}
                    {filteredRegions.length === 1 ? "Region" : "Regionen"}
                </p>
                {filteredRegions.length !== regions.length ? <p>von {regions.length} gesamt</p> : null}
            </div>

            {filteredRegions.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredRegions.map((region) => <RegionCard key={region.id} region={region} />)}
                </div>
            ) : (
                <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] text-center text-neutral-500">
                    <Search className="size-7 opacity-30" />
                    <p className="text-sm">Keine passenden Regionen gefunden.</p>
                </div>
            )}
        </section>
    );
}
