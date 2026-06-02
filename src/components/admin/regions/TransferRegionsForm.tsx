"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { SearchIcon, LoaderIcon, ArrowRightIcon, AlertTriangleIcon, CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import getUser, { type Player } from "@/actions/minecraft/user";
import { previewTransfer, executeTransfer, type TransferPreview } from "@/actions/region/TransferRegions";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";

interface PlayerCard {
    player: Player;
}

function PlayerSearch({
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

function PreviewCard({ preview }: { preview: TransferPreview }) {
    const rows = [
        {
            label: "Standard-Regionen (als Ersteller)",
            count: preview.defaultAsCreator,
            description: "Werden auf den Ziel-Spieler übertragen.",
            color: "text-emerald-400",
        },
        {
            label: "Plot- & Eventregionen (als Ersteller)",
            count: preview.plotEventAsCreator,
            description: "Ersteller & Builder werden entfernt.",
            color: "text-amber-400",
        },
        {
            label: "Regionen (als Builder)",
            count: preview.asBuilder,
            description: "Standard: Quell-UUID wird ersetzt. Plot/Event: Quell-UUID wird entfernt.",
            color: "text-sky-400",
        },
    ];

    return (
        <div className="rounded-xl border border-border bg-muted/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
                <p className="text-sm font-semibold">Vorschau — {preview.total} Einträge betroffen</p>
            </div>
            <div className="divide-y divide-border/50">
                {rows.map((row) => (
                    <div key={row.label} className="flex items-center gap-4 px-4 py-3">
                        <span className={cn("text-2xl font-bold tabular-nums w-10 text-right shrink-0", row.color)}>
                            {row.count}
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-medium">{row.label}</p>
                            <p className="text-xs text-muted-foreground">{row.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function TransferRegionsForm() {
    const [source, setSource] = useState<Player | null>(null);
    const [target, setTarget] = useState<Player | null>(null);
    const [preview, setPreview] = useState<TransferPreview | null>(null);
    const [isPreviewing, startPreview] = useTransition();
    const [isExecuting, startExecute] = useTransition();
    const [confirmed, setConfirmed] = useState(false);
    const [done, setDone] = useState(false);

    function handleSourceSelect(p: Player) {
        setSource(p);
        setPreview(null);
        setConfirmed(false);
        setDone(false);
    }

    function handleTargetSelect(p: Player) {
        setTarget(p);
        setPreview(null);
        setConfirmed(false);
        setDone(false);
    }

    function handlePreview() {
        if (!source || !target) return;
        startPreview(async () => {
            try {
                const result = await previewTransfer(source.raw_id, target.raw_id);
                setPreview(result);
                setConfirmed(false);
            } catch (e: any) {
                toast.error(e?.message ?? "Fehler bei der Vorschau");
            }
        });
    }

    function handleExecute() {
        if (!source || !target || !confirmed) return;
        startExecute(async () => {
            try {
                const result = await executeTransfer(source.raw_id, target.raw_id);
                toast.success(`${result.transferred} Einträge wurden übertragen.`);
                setDone(true);
                setPreview(null);
                setConfirmed(false);
                setSource(null);
                setTarget(null);
            } catch (e: any) {
                toast.error(e?.message ?? "Fehler beim Übertragen");
            }
        });
    }

    const canPreview = !!source && !!target && !isPreviewing && !isExecuting;
    const canExecute = !!preview && confirmed && !isExecuting;

    return (
        <div className="max-w-3xl space-y-6">
            {/* Player selection */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
                <div className="flex items-start gap-4">
                    <PlayerSearch
                        label="Quell-Spieler (von)"
                        value={source}
                        onSelect={handleSourceSelect}
                        disabledUUID={target?.raw_id}
                    />

                    <div className="shrink-0 mt-8 pt-2">
                        <div className="size-8 rounded-full bg-muted/50 border border-border flex items-center justify-center">
                            <ArrowRightIcon size={14} className="text-muted-foreground" />
                        </div>
                    </div>

                    <PlayerSearch
                        label="Ziel-Spieler (zu)"
                        value={target}
                        onSelect={handleTargetSelect}
                        disabledUUID={source?.raw_id}
                    />
                </div>

                <Button
                    onClick={handlePreview}
                    disabled={!canPreview}
                    variant="outline"
                    className="w-full"
                >
                    {isPreviewing ? (
                        <><LoaderIcon size={13} className="animate-spin" />Analysiere…</>
                    ) : (
                        "Vorschau laden"
                    )}
                </Button>
            </div>

            {/* Preview */}
            <AnimatePresence>
                {preview && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="space-y-4"
                    >
                        <PreviewCard preview={preview} />

                        {preview.total === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                                Keine Regionen gefunden, die übertragen werden könnten.
                            </p>
                        ) : (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangleIcon size={16} className="text-destructive shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-destructive">Achtung — nicht rückgängig machbar</p>
                                        <p className="text-xs text-muted-foreground">
                                            Diese Aktion überträgt {preview.defaultAsCreator} Standard-Region(en) auf{" "}
                                            <span className="font-semibold text-foreground">{target?.username}</span> und
                                            entfernt die Zuordnung bei {preview.plotEventAsCreator} Plot-/Eventregion(en).
                                            Sie kann nicht automatisch rückgängig gemacht werden.
                                        </p>
                                    </div>
                                </div>

                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmed((c) => !c)}
                                        className={cn(
                                            "size-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                            confirmed
                                                ? "bg-destructive border-destructive"
                                                : "border-border bg-background hover:border-destructive/50"
                                        )}
                                    >
                                        {confirmed && <CheckIcon size={11} className="text-white" />}
                                    </button>
                                    <span className="text-sm text-muted-foreground">
                                        Ich bestätige, dass ich alle {preview.total} Einträge übertragen möchte.
                                    </span>
                                </label>

                                <Button
                                    onClick={handleExecute}
                                    disabled={!canExecute}
                                    className="w-full bg-destructive hover:bg-destructive/90 text-white"
                                >
                                    {isExecuting ? (
                                        <><LoaderIcon size={13} className="animate-spin" />Übertrage…</>
                                    ) : (
                                        <>Regionen übertragen ({preview.total})</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </motion.div>
                )}

                {done && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3"
                    >
                        <CheckIcon size={16} className="text-emerald-400 shrink-0" />
                        <p className="text-sm text-emerald-400 font-medium">Übertragung erfolgreich abgeschlossen.</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
