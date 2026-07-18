"use client";

import { useMcUser } from "@/dataHooks/minecraft/useMcUser";
import { Crown } from "lucide-react";
import Link from "next/link";
import type { PlayerScore } from "@/lib/scoring";

type Rank = 1 | 2 | 3;

const RANK_STYLES: Record<Rank, {
    height: string;
    avatar: string;
    ring: string;
    glow: string;
    gradient: string;
    medal: string;
    medalBg: string;
    crown: boolean;
}> = {
    1: {
        height: "h-40 sm:h-56",
        avatar: "size-16 sm:size-24",
        ring: "ring-amber-400/40",
        glow: "from-amber-500/30 via-amber-500/10 to-transparent",
        gradient: "from-amber-500/15 to-amber-500/[0.02]",
        medal: "text-amber-300",
        medalBg: "bg-amber-500/15 ring-amber-500/30",
        crown: true,
    },
    2: {
        height: "h-32 sm:h-44",
        avatar: "size-14 sm:size-20",
        ring: "ring-neutral-300/30",
        glow: "from-neutral-300/15 via-neutral-300/5 to-transparent",
        gradient: "from-neutral-300/10 to-neutral-300/[0.02]",
        medal: "text-neutral-200",
        medalBg: "bg-neutral-300/15 ring-neutral-300/25",
        crown: false,
    },
    3: {
        height: "h-32 sm:h-40",
        avatar: "size-14 sm:size-20",
        ring: "ring-orange-500/30",
        glow: "from-orange-500/15 via-orange-500/5 to-transparent",
        gradient: "from-orange-500/10 to-orange-500/[0.02]",
        medal: "text-orange-300",
        medalBg: "bg-orange-500/15 ring-orange-500/30",
        crown: false,
    },
};

export default function PodiumCard({
    player,
    rank,
    value,
    valueLabel,
}: {
    player: PlayerScore;
    rank: Rank;
    value: string;
    valueLabel: string;
}) {
    const { data: mc } = useMcUser(player.uuid);
    const style = RANK_STYLES[rank];

    const username = mc?.username ?? player.uuid.slice(0, 8);
    const avatar = mc?.avatar ?? `https://minotar.net/helm/${player.uuid}`;

    return (
        <Link
            href={`/builder/${player.uuid}`}
            prefetch={false}
            aria-label={`Builderprofil von ${username} öffnen`}
            className="group flex min-w-0 flex-col items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
        >
            {/* Avatar + crown above podium base */}
            <div className="relative flex flex-col items-center">
                {style.crown && (
                    <Crown className="size-5 sm:size-6 text-amber-300 mb-1 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
                )}
                <div className="relative">
                    <div
                        className={`absolute inset-0 rounded-2xl blur-2xl bg-gradient-to-b ${style.glow}`}
                    />
                    <img
                        src={avatar}
                        alt={username}
                        className={`relative ${style.avatar} rounded-2xl ring-2 ${style.ring} bg-neutral-900`}
                    />
                </div>
                <p className="mt-2 w-full max-w-[10rem] truncate text-center text-xs font-semibold text-white transition-colors group-hover:text-sky-300 sm:mt-3 sm:text-sm">
                    {username}
                </p>
                <p className="mt-0.5 whitespace-nowrap text-[8px] uppercase tracking-wide text-neutral-500 sm:text-[10px] sm:tracking-widest">
                    {player.regionCount} {player.regionCount === 1 ? "Region" : "Regionen"}
                </p>
            </div>

            {/* Podium base */}
            <div
                className={`relative mt-2 sm:mt-3 w-full ${style.height} rounded-xl sm:rounded-2xl border border-white/[0.06] bg-gradient-to-b ${style.gradient} overflow-hidden flex flex-col items-center justify-center px-1.5 transition-all group-hover:-translate-y-0.5 group-hover:border-white/[0.14] sm:px-4`}
            >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div
                    className={`size-8 sm:size-10 rounded-lg sm:rounded-xl ring-1 flex items-center justify-center ${style.medalBg} mb-2 sm:mb-3`}
                >
                    <span className={`font-bold ${style.medal} text-sm sm:text-lg`}>#{rank}</span>
                </div>
                <p
                    title={value}
                    className="max-w-full truncate whitespace-nowrap text-sm font-bold leading-none tracking-tight tabular-nums text-white min-[380px]:text-base sm:text-2xl md:text-3xl"
                >
                    {value}
                </p>
                <p className="mt-1.5 text-[8px] uppercase tracking-wide text-neutral-500 sm:text-[10px] sm:tracking-widest">
                    {valueLabel}
                </p>
            </div>
        </Link>
    );
}
