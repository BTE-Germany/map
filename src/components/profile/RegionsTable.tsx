"use client";

import { useState, useMemo } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { stateCodeToName } from "@/lib/federalStates";
import {
    Search, ArrowUpDown, ArrowUp, ArrowDown,
    MapPin, Building2, CheckCircle2, Circle, LandPlot,
    ChevronLeft, ChevronRight,
} from "lucide-react";

type Region = {
    id: string;
    description: string | null;
    creatorUUID: string;
    polygon: [number, number][];
    city: string;
    state: string;
    area: string;
    buildings: number;
    createdAt: Date | null;
    modifiedAt: Date;
    type: "default" | "plot" | "event";
    address: string;
    finished: boolean;
};

type SortKey = "city" | "state" | "area" | "buildings" | "createdAt" | "type";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

const TYPE_LABELS: Record<Region["type"], string> = {
    default: "Standard",
    plot: "Plot",
    event: "Event",
};

const TYPE_STYLES: Record<Region["type"], string> = {
    default: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    plot: "border-green-500/30 bg-green-500/10 text-green-400",
    event: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

function formatArea(area: string | number): string {
    const n = typeof area === "string" ? parseFloat(area) : area;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} km²`;
    if (n >= 10_000) return `${(n / 10_000).toFixed(2)} ha`;
    return `${n.toFixed(0)} m²`;
}

function formatDate(d: Date | null): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("de-DE", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

export default function RegionsTable({ regions }: { regions: Region[] }) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<Region["type"] | "all">("all");
    const [finishedFilter, setFinishedFilter] = useState<boolean | "all">("all");
    const [sortKey, setSortKey] = useState<SortKey>("createdAt");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [page, setPage] = useState(0);

    const filtered = useMemo(() => {
        let data = regions;
        if (search.trim()) {
            const q = search.toLowerCase();
            data = data.filter(r =>
                r.city.toLowerCase().includes(q) ||
                r.address.toLowerCase().includes(q) ||
                stateCodeToName(r.state).toLowerCase().includes(q)
            );
        }
        if (typeFilter !== "all") data = data.filter(r => r.type === typeFilter);
        if (finishedFilter !== "all") data = data.filter(r => r.finished === finishedFilter);
        return data;
    }, [regions, search, typeFilter, finishedFilter]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            let cmp = 0;
            if (sortKey === "city") cmp = a.city.localeCompare(b.city);
            else if (sortKey === "state") cmp = stateCodeToName(a.state).localeCompare(stateCodeToName(b.state));
            else if (sortKey === "area") cmp = parseFloat(a.area) - parseFloat(b.area);
            else if (sortKey === "buildings") cmp = a.buildings - b.buildings;
            else if (sortKey === "type") cmp = a.type.localeCompare(b.type);
            else if (sortKey === "createdAt") {
                const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                cmp = aT - bT;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });
    }, [filtered, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    function toggleSort(key: SortKey) {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
        setPage(0);
    }

    function SortIcon({ col }: { col: SortKey }) {
        if (sortKey !== col) return <ArrowUpDown className="size-3.5 opacity-40" />;
        return sortDir === "asc"
            ? <ArrowUp className="size-3.5 text-primary" />
            : <ArrowDown className="size-3.5 text-primary" />;
    }

    function SortableHead({ col, children }: { col: SortKey; children: React.ReactNode }) {
        return (
            <TableHead>
                <button
                    onClick={() => toggleSort(col)}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                    {children}
                    <SortIcon col={col} />
                </button>
            </TableHead>
        );
    }

    function onSearch(v: string) { setSearch(v); setPage(0); }
    function onType(v: Region["type"] | "all") { setTypeFilter(v); setPage(0); }
    function onFinished(v: boolean | "all") { setFinishedFilter(v); setPage(0); }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full flex-1 sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <input
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                        placeholder="Stadt, Adresse oder Bundesland..."
                        className="w-full rounded-lg border border-border bg-muted/30 pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
                    />
                </div>

                <div className="flex w-full flex-wrap gap-2 sm:w-auto">


                    {/* Finished filter */}
                    <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                        {([
                            { label: "Alle", value: "all" as const },
                            { label: "Fertig", value: true as const },
                            { label: "Offen", value: false as const },
                        ]).map(({ label, value }) => (
                            <button
                                key={String(value)}
                                onClick={() => onFinished(value)}
                                className={`px-3 py-1.5 transition-colors ${finishedFilter === value
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>{filtered.length} {filtered.length === 1 ? "Region" : "Regionen"}</span>
                {filtered.length !== regions.length && (
                    <span className="text-primary/70">von {regions.length} gesamt</span>
                )}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableHead className="w-8 text-center text-muted-foreground/60">#</TableHead>
                            <SortableHead col="city">Stadt</SortableHead>
                            <SortableHead col="state">Bundesland</SortableHead>
                            <TableHead>Adresse</TableHead>
                            <SortableHead col="area">Fläche</SortableHead>
                            <SortableHead col="buildings">Gebäude</SortableHead>
                            <TableHead>Status</TableHead>
                            <SortableHead col="createdAt">Erstellt</SortableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-40 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <LandPlot className="size-8 opacity-30" />
                                        <p className="text-sm">Keine Regionen gefunden</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            pageData.map((r, i) => (
                                <TableRow key={r.id} className="group">
                                    <TableCell className="text-center text-muted-foreground/50 text-xs font-mono">
                                        {page * PAGE_SIZE + i + 1}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="size-3.5 text-muted-foreground/50 shrink-0" />
                                            <span className="font-medium">{r.city}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {stateCodeToName(r.state)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm max-w-48 truncate" title={r.address}>
                                        {r.address || "—"}
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-mono text-sm tabular-nums">
                                            {formatArea(r.area)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <Building2 className="size-3.5 text-muted-foreground/50" />
                                            <span className="tabular-nums">{r.buildings.toLocaleString("de-DE")}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {r.finished ? (
                                            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                                                <CheckCircle2 className="size-4" />
                                                Fertig
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                                <Circle className="size-4" />
                                                Offen
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                        {formatDate(r.createdAt)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Seite {page + 1} von {totalPages}
                    </p>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                            const pg = start + i;
                            return (
                                <Button
                                    key={pg}
                                    variant={pg === page ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setPage(pg)}
                                    className="h-8 w-8 p-0 text-xs"
                                >
                                    {pg + 1}
                                </Button>
                            );
                        })}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page === totalPages - 1}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
