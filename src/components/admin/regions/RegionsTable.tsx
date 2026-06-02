"use client";

import { useState, useMemo, useTransition } from "react";
import {
    SearchIcon, PencilIcon, ChevronUpIcon, ChevronDownIcon,
    ChevronsUpDownIcon, ChevronLeftIcon, ChevronRightIcon,
    CheckCircle2Icon, ClockIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stateCodeToName } from "@/lib/federalStates";
import RegionAdminEditDialog from "./RegionAdminEditDialog";
import { useRouter } from "next/navigation";

type RegionRow = {
    id: string;
    address: string;
    city: string;
    state: string;
    type: "default" | "plot" | "event";
    description: string | null;
    finished: boolean;
    buildings: number;
    area: string;
    creatorUUID: string;
    builders: string[] | null;
    createdAt: Date | string | null;
};

type SortKey = "address" | "city" | "buildings" | "area" | "createdAt";
type SortDir = "asc" | "desc";

const TYPE_LABELS: Record<string, string> = {
    default: "Standard",
    plot: "Plot",
    event: "Event",
};

const TYPE_COLORS: Record<string, string> = {
    default: "bg-sky-500/10 text-sky-400",
    plot: "bg-violet-500/10 text-violet-400",
    event: "bg-amber-500/10 text-amber-400",
};

const PAGE_SIZE = 50;

export default function RegionsTable({ regions }: { regions: RegionRow[] }) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "default" | "plot" | "event">("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "finished" | "ongoing">("all");
    const [stateFilter, setStateFilter] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("createdAt");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [page, setPage] = useState(0);

    const [editRegion, setEditRegion] = useState<RegionRow | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    const [, startTransition] = useTransition();

    function openEdit(region: RegionRow) {
        setEditRegion(region);
        setEditOpen(true);
    }

    function handleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
        setPage(0);
    }

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return regions
            .filter((r) => {
                if (q && !r.address.toLowerCase().includes(q) && !r.city.toLowerCase().includes(q)) return false;
                if (typeFilter !== "all" && r.type !== typeFilter) return false;
                if (statusFilter === "finished" && !r.finished) return false;
                if (statusFilter === "ongoing" && r.finished) return false;
                if (stateFilter && r.state !== stateFilter) return false;
                return true;
            })
            .sort((a, b) => {
                let cmp = 0;
                if (sortKey === "address") cmp = a.address.localeCompare(b.address);
                else if (sortKey === "city") cmp = a.city.localeCompare(b.city);
                else if (sortKey === "buildings") cmp = a.buildings - b.buildings;
                else if (sortKey === "area") cmp = parseFloat(a.area) - parseFloat(b.area);
                else if (sortKey === "createdAt")
                    cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
                return sortDir === "asc" ? cmp : -cmp;
            });
    }, [regions, search, typeFilter, statusFilter, stateFilter, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const uniqueStates = useMemo(() =>
        [...new Set(regions.map((r) => r.state).filter(Boolean))].sort(),
        [regions]
    );

    function SortIcon({ col }: { col: SortKey }) {
        if (sortKey !== col) return <ChevronsUpDownIcon size={12} className="opacity-30" />;
        return sortDir === "asc"
            ? <ChevronUpIcon size={12} className="text-primary" />
            : <ChevronDownIcon size={12} className="text-primary" />;
    }

    return (
        <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-48">
                    <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        placeholder="Suche nach Adresse oder Stadt…"
                        className="w-full rounded-xl border border-border bg-card pl-8 pr-3.5 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={(e) => { setTypeFilter(e.target.value as any); setPage(0); }}
                    className={selectCls}
                >
                    <option value="all">Alle Typen</option>
                    <option value="default">Standard</option>
                    <option value="plot">Plot</option>
                    <option value="event">Event</option>
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as any); setPage(0); }}
                    className={selectCls}
                >
                    <option value="all">Alle Status</option>
                    <option value="finished">Fertiggestellt</option>
                    <option value="ongoing">In Arbeit</option>
                </select>
                <select
                    value={stateFilter}
                    onChange={(e) => { setStateFilter(e.target.value); setPage(0); }}
                    className={selectCls}
                >
                    <option value="">Alle Bundesländer</option>
                    {uniqueStates.map((s) => (
                        <option key={s} value={s}>{stateCodeToName(s)}</option>
                    ))}
                </select>
                {(search || typeFilter !== "all" || statusFilter !== "all" || stateFilter) && (
                    <button
                        onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); setStateFilter(""); setPage(0); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                        Filter zurücksetzen
                    </button>
                )}
            </div>

            {/* Results count */}
            <p className="text-xs text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "Region" : "Regionen"}
                {filtered.length !== regions.length && ` von ${regions.length}`}
            </p>

            {/* Table */}
            <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <Th onClick={() => handleSort("address")} className="w-[200px]">
                                    <span className="flex items-center gap-1">Adresse <SortIcon col="address" /></span>
                                </Th>
                                <Th onClick={() => handleSort("city")}>
                                    <span className="flex items-center gap-1">Stadt <SortIcon col="city" /></span>
                                </Th>
                                <Th>Typ</Th>
                                <Th>Status</Th>
                                <Th onClick={() => handleSort("buildings")} className="text-right">
                                    <span className="flex items-center justify-end gap-1">Gebäude <SortIcon col="buildings" /></span>
                                </Th>
                                <Th onClick={() => handleSort("area")} className="text-right">
                                    <span className="flex items-center justify-end gap-1">Fläche <SortIcon col="area" /></span>
                                </Th>
                                <Th onClick={() => handleSort("createdAt")}>
                                    <span className="flex items-center gap-1">Erstellt <SortIcon col="createdAt" /></span>
                                </Th>
                                <Th className="w-10" />
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-muted-foreground text-sm">
                                        Keine Regionen gefunden.
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((region) => (
                                    <tr
                                        key={region.id}
                                        className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors group"
                                    >
                                        <Td className="font-medium max-w-[200px] truncate">
                                            {region.address || <span className="text-muted-foreground/50 italic">–</span>}
                                        </Td>
                                        <Td className="text-muted-foreground">
                                            {region.city}
                                            {region.state && (
                                                <span className="ml-1 text-muted-foreground/50">{region.state}</span>
                                            )}
                                        </Td>
                                        <Td>
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
                                                TYPE_COLORS[region.type]
                                            )}>
                                                {TYPE_LABELS[region.type]}
                                            </span>
                                        </Td>
                                        <Td>
                                            {region.finished ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                                                    <CheckCircle2Icon size={11} />Fertig
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                                                    <ClockIcon size={11} />In Arbeit
                                                </span>
                                            )}
                                        </Td>
                                        <Td className="text-right tabular-nums text-muted-foreground">
                                            {region.buildings.toLocaleString("de-DE")}
                                        </Td>
                                        <Td className="text-right tabular-nums text-muted-foreground">
                                            {formatArea(parseFloat(region.area))}
                                        </Td>
                                        <Td className="text-muted-foreground whitespace-nowrap">
                                            {region.createdAt
                                                ? new Date(region.createdAt as any).toLocaleDateString("de-DE", {
                                                      day: "2-digit", month: "2-digit", year: "2-digit"
                                                  })
                                                : "–"}
                                        </Td>
                                        <Td>
                                            <button
                                                onClick={() => openEdit(region)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                                title="Bearbeiten"
                                            >
                                                <PencilIcon size={13} />
                                            </button>
                                        </Td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
                        <p className="text-xs text-muted-foreground">
                            Seite {page + 1} von {totalPages}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="p-1.5 rounded-lg hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeftIcon size={14} />
                            </button>
                            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                const p = totalPages <= 7 ? i : clampPage(i, page, totalPages);
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={cn(
                                            "size-7 rounded-lg text-xs font-medium transition-colors",
                                            p === page
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-muted/60 text-muted-foreground"
                                        )}
                                    >
                                        {p + 1}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="p-1.5 rounded-lg hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRightIcon size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <RegionAdminEditDialog
                region={editRegion}
                open={editOpen}
                onOpenChange={setEditOpen}
                onSaved={() => startTransition(() => router.refresh())}
            />
        </>
    );
}

function Th({ children, className, onClick }: { children?: React.ReactNode; className?: string; onClick?: () => void }) {
    return (
        <th
            onClick={onClick}
            className={cn(
                "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                onClick && "cursor-pointer select-none hover:text-foreground transition-colors",
                className
            )}
        >
            {children}
        </th>
    );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
    return (
        <td className={cn("px-4 py-3", className)}>
            {children}
        </td>
    );
}

function formatArea(m2: number): string {
    if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
    if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(1)} ha`;
    return `${m2.toFixed(0)} m²`;
}

function clampPage(i: number, current: number, total: number): number {
    const half = 3;
    let start = Math.max(0, current - half);
    const end = Math.min(total - 1, start + 6);
    start = Math.max(0, end - 6);
    return start + i;
}

const selectCls =
    "rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition";
