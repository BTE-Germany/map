"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
    ArrowDownIcon, ArrowUpIcon, Building2, CheckCircle2Icon, LandPlot,
    SearchIcon, Sparkles, Users,
} from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useMcUser } from "@/dataHooks/minecraft/useMcUser";
import { cn } from "@/lib/utils";
import type { PlayerScore } from "@/lib/scoring";

type SortKey = "points" | "area" | "buildings" | "regions" | "finished";

interface Column {
    key: SortKey;
    label: string;
    icon: React.ReactNode;
    getValue: (p: PlayerScore) => number;
    format: (v: number) => string;
    align?: "right" | "left";
}

function formatArea(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} km²`;
    if (n >= 10_000) return `${(n / 10_000).toFixed(1)} ha`;
    return `${Math.round(n).toLocaleString("de-DE")} m²`;
}

function formatInt(n: number) {
    return Math.round(n).toLocaleString("de-DE");
}

const COLUMNS: Column[] = [
    { key: "points",   label: "Punkte",   icon: <Sparkles className="size-3.5" />,      getValue: (p) => p.totalPoints,            format: formatInt,  align: "right" },
    { key: "area",     label: "Fläche",   icon: <LandPlot className="size-3.5" />,      getValue: (p) => p.totalArea,              format: formatArea, align: "right" },
    { key: "buildings",label: "Gebäude",  icon: <Building2 className="size-3.5" />,     getValue: (p) => p.buildings,              format: formatInt,  align: "right" },
    { key: "regions",  label: "Regionen", icon: <Users className="size-3.5" />,         getValue: (p) => p.regionCount,            format: formatInt,  align: "right" },
    { key: "finished", label: "Fertig",   icon: <CheckCircle2Icon className="size-3.5" />, getValue: (p) => p.finishedRegionCount, format: formatInt,  align: "right" },
];

interface RankedPlayer extends PlayerScore {
    rank: number;
}

export default function ExtendedRankingTable({ players }: { players: PlayerScore[] }) {
    const { data: sessionData } = useSession();
    const currentUserUuid = sessionData?.user?.minecraft_uuid ?? null;

    const [sortKey, setSortKey] = useState<SortKey>("points");
    const [search, setSearch] = useState("");

    const ranked = useMemo<RankedPlayer[]>(() => {
        const col = COLUMNS.find((c) => c.key === sortKey)!;
        return [...players]
            .sort((a, b) => col.getValue(b) - col.getValue(a))
            .map((p, i) => ({ ...p, rank: i + 1 }));
    }, [players, sortKey]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return ranked;
        return ranked.filter((p) => p.uuid.toLowerCase().includes(q));
    }, [ranked, search]);

    const me = currentUserUuid
        ? ranked.find((p) => p.uuid.toLowerCase() === currentUserUuid.toLowerCase())
        : null;

    return (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.04]">
                <div>
                    <p className="text-sm font-semibold text-white">Gesamtwertung</p>
                    <p className="text-xs text-neutral-500">
                        {ranked.length.toLocaleString("de-DE")} Builder mit Aktivität — Spalten klickbar zum Sortieren
                    </p>
                </div>

                <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-500 pointer-events-none" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Nach UUID-Anfang filtern…"
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/20 transition-colors"
                    />
                </div>
            </header>

            {me && (
                <MeBanner me={me} />
            )}

            <div className="max-h-[36rem] overflow-y-auto scrollbar-thin">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-neutral-950/85 backdrop-blur">
                        <TableRow className="border-white/[0.05] hover:bg-transparent">
                            <TableHead className="w-12 text-right text-[10px] uppercase tracking-widest text-neutral-500">
                                #
                            </TableHead>
                            <TableHead className="text-[10px] uppercase tracking-widest text-neutral-500">
                                Builder
                            </TableHead>
                            {COLUMNS.map((col) => (
                                <SortHead
                                    key={col.key}
                                    col={col}
                                    active={sortKey === col.key}
                                    onClick={() => setSortKey(col.key)}
                                />
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2 + COLUMNS.length} className="text-center text-neutral-500 py-10 text-sm">
                                    Keine Builder gefunden.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((player) => (
                                <PlayerRow
                                    key={player.uuid}
                                    player={player}
                                    sortKey={sortKey}
                                    isMe={!!currentUserUuid && player.uuid.toLowerCase() === currentUserUuid.toLowerCase()}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}

function SortHead({ col, active, onClick }: { col: Column; active: boolean; onClick: () => void }) {
    return (
        <TableHead className="text-right">
            <button
                onClick={onClick}
                className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest transition-colors",
                    active ? "text-white" : "text-neutral-500 hover:text-neutral-300",
                )}
            >
                <span className={active ? "text-amber-300" : ""}>{col.icon}</span>
                {col.label}
                {active && <ArrowDownIcon className="size-3" />}
            </button>
        </TableHead>
    );
}

function PlayerRow({
    player, sortKey, isMe,
}: {
    player: RankedPlayer;
    sortKey: SortKey;
    isMe: boolean;
}) {
    const { data: mc } = useMcUser(player.uuid);
    const username = mc?.username ?? player.uuid.slice(0, 8);
    const avatar = mc?.avatar ?? `https://minotar.net/helm/${player.uuid}`;

    return (
        <TableRow
            className={cn(
                "border-white/[0.04] transition-colors",
                isMe
                    ? "bg-sky-500/10 hover:bg-sky-500/15 ring-1 ring-sky-500/30"
                    : "hover:bg-white/[0.02]",
            )}
        >
            <TableCell className="text-right">
                <span
                    className={cn(
                        "inline-flex items-center justify-center min-w-8 px-1.5 h-6 rounded-md text-xs font-semibold tabular-nums",
                        player.rank === 1 && "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
                        player.rank === 2 && "bg-neutral-400/15 text-neutral-200 ring-1 ring-neutral-400/30",
                        player.rank === 3 && "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30",
                        player.rank > 3 && "text-neutral-400",
                    )}
                >
                    {player.rank}
                </span>
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2.5">
                    <img src={avatar} alt={username} className="size-7 rounded-md shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                            {username}
                            {isMe && (
                                <span className="ml-2 text-[10px] uppercase tracking-widest text-sky-300">Du</span>
                            )}
                        </p>
                    </div>
                </div>
            </TableCell>
            {COLUMNS.map((col) => {
                const v = col.getValue(player);
                return (
                    <TableCell
                        key={col.key}
                        className={cn(
                            "text-right tabular-nums",
                            sortKey === col.key ? "text-white font-semibold" : "text-neutral-400",
                        )}
                    >
                        {col.format(v)}
                    </TableCell>
                );
            })}
        </TableRow>
    );
}

function MeBanner({ me }: { me: RankedPlayer }) {
    const { data: mc } = useMcUser(me.uuid);
    const username = mc?.username ?? me.uuid.slice(0, 8);
    const avatar = mc?.avatar ?? `https://minotar.net/helm/${me.uuid}`;

    return (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-sky-500/20 bg-sky-500/[0.07]">
            <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center size-9 rounded-lg bg-sky-500/15 ring-1 ring-sky-500/30 text-sky-300 text-sm font-bold tabular-nums">
                    #{me.rank}
                </div>
                <img src={avatar} alt={username} className="size-8 rounded-md" />
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-sky-300/80 font-semibold">
                        Deine Position
                    </p>
                    <p className="text-sm font-semibold text-white">
                        {username}
                        <span className="ml-2 text-xs font-normal text-neutral-400">
                            • {formatInt(me.totalPoints)} Punkte • {formatArea(me.totalArea)}
                            {me.buildings > 0 && ` • ${formatInt(me.buildings)} Gebäude`}
                        </span>
                    </p>
                </div>
            </div>
            <ArrowUpIcon className="size-4 text-sky-300/60" />
        </div>
    );
}
