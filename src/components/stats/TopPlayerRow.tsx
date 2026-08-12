"use client";

import Link from "next/link";
import { useMcUser } from "@/dataHooks/minecraft/useMcUser";
import type { PlayerScore } from "@/lib/scoring";
import { formatNumber } from "./stateMetrics";

/**
 * Eine Zeile einer Bestenliste: Rang, Avatar, Name, Balken, Punkte. Wird von der
 * Bundesland-Detailansicht und der Stadtseite geteilt, damit "Top Builder" an
 * beiden Stellen dasselbe bedeutet und gleich aussieht.
 */
export default function TopPlayerRow({
    player,
    rank,
    maxPoints,
}: {
    player: PlayerScore;
    rank: number;
    maxPoints: number;
}) {
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
