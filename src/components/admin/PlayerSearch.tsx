"use client";

import { useState, useRef, useCallback } from "react";
import { SearchIcon, LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import getUser, { type Player } from "@/actions/minecraft/user";
import { AnimatePresence, motion } from "motion/react";

/**
 * Debounced Minecraft-player picker used across the admin panel (region
 * transfer, region creation). Looks a player up by name/UUID via `getUser`,
 * shows the resolved profile card and lets the user confirm the selection.
 */
export default function PlayerSearch({
    label,
    value,
    onSelect,
    disabledUUID,
}: {
    label: string;
    value: Player | null;
    onSelect: (p: Player) => void;
    disabledUUID?: string;
}) {
    const [input, setInput] = useState("");
    const [result, setResult] = useState<Player | null | "not-found">(null);
    const [isSearching, setIsSearching] = useState(false);
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleInput = useCallback((val: string) => {
        setInput(val);
        setResult(null);
        if (debounce.current) clearTimeout(debounce.current);
        if (!val.trim()) return;
        debounce.current = setTimeout(async () => {
            setIsSearching(true);
            const player = await getUser(val.trim());
            setResult(player ?? "not-found");
            setIsSearching(false);
        }, 400);
    }, []);

    function select(p: Player) {
        onSelect(p);
        setInput("");
        setResult(null);
    }

    const isDisabled = result && result !== "not-found" && result.raw_id === disabledUUID;

    return (
        <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>

            {/* Selected player card */}
            {value && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3.5 py-2.5">
                    <img src={value.avatar} alt={value.username} className="size-9 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{value.username}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{value.raw_id}</p>
                    </div>
                </div>
            )}

            {/* Search input */}
            <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    {isSearching ? <LoaderIcon size={13} className="animate-spin" /> : <SearchIcon size={13} />}
                </div>
                <input
                    value={input}
                    onChange={(e) => handleInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && result && result !== "not-found" && !isDisabled) select(result);
                    }}
                    placeholder={value ? "Anderen Spieler suchen…" : "Minecraft-Name eingeben…"}
                    className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3.5 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
                />
            </div>

            <AnimatePresence mode="wait">
                {result === "not-found" && (
                    <motion.p key="nf" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-xs text-destructive px-1">Spieler nicht gefunden.</motion.p>
                )}
                {result && result !== "not-found" && (
                    <motion.button
                        key="res"
                        type="button"
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        onClick={() => !isDisabled && select(result)}
                        disabled={!!isDisabled}
                        className={cn(
                            "w-full flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all",
                            isDisabled
                                ? "border-border bg-muted/10 opacity-50 cursor-not-allowed"
                                : "border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                        )}
                    >
                        <img src={result.avatar} alt={result.username} className="size-8 rounded-full shrink-0" />
                        <span className="flex-1 text-sm font-medium">{result.username}</span>
                        {isDisabled
                            ? <span className="text-xs text-muted-foreground">Bereits ausgewählt</span>
                            : <span className="text-xs text-primary font-medium">↵ Auswählen</span>
                        }
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
