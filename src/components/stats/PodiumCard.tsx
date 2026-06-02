"use client";

import { useMcUser } from "@/dataHooks/minecraft/useMcUser";
import { Crown } from "lucide-react";
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
        height: "h-56",
        avatar: "size-24",
        ring: "ring-amber-400/40",
        glow: "from-amber-500/30 via-amber-500/10 to-transparent",
        gradient: "from-amber-500/15 to-amber-500/[0.02]",
        medal: "text-amber-300",
        medalBg: "bg-amber-500/15 ring-amber-500/30",
        crown: true,
    },
    2: {
        height: "h-44",
        avatar: "size-20",
        ring: "ring-neutral-300/30",
        glow: "from-neutral-300/15 via-neutral-300/5 to-transparent",
        gradient: "from-neutral-300/10 to-neutral-300/[0.02]",
        medal: "text-neutral-200",
        medalBg: "bg-neutral-300/15 ring-neutral-300/25",
        crown: false,
    },
    3: {
        height: "h-40",
        avatar: "size-20",
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
        <div className="flex flex-col items-center">
            {/* Avatar + crown above podium base */}
            <div className="relative flex flex-col items-center">
                {style.crown && (
                    <Crown className="size-6 text-amber-300 mb-1 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
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
                <p className="mt-3 text-sm font-semibold text-white text-center max-w-[10rem] truncate">
                    {username}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mt-0.5">
                    {player.regionCount} {player.regionCount === 1 ? "Region" : "Regionen"}
                </p>
            </div>

            {/* Podium base */}
            <div
                className={`relative mt-3 w-full ${style.height} rounded-2xl border border-white/[0.06] bg-gradient-to-b ${style.gradient} overflow-hidden flex flex-col items-center justify-center px-4`}
            >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div
                    className={`size-10 rounded-xl ring-1 flex items-center justify-center ${style.medalBg} mb-3`}
                >
                    <span className={`font-bold ${style.medal} text-lg`}>#{rank}</span>
                </div>
                <p className="text-2xl md:text-3xl font-bold tabular-nums text-white leading-none">
                    {value}
                </p>
                <p className="mt-1.5 text-[10px] uppercase tracking-widest text-neutral-500">
                    {valueLabel}
                </p>
            </div>
        </div>
    );
}
