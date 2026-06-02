"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    PencilIcon, XIcon, SearchIcon, LoaderIcon,
    CheckCircle2Icon, ClockIcon, CheckIcon,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateRegion } from "@/actions/region/UpdateRegion";
import getUser, { type Player } from "@/actions/minecraft/user";
import { AnimatePresence, motion } from "motion/react";

const MAX_DESCRIPTION = 500;

interface Props {
    regionId: string;
    initialDescription: string;
    initialFinished: boolean;
    initialBuilders: string[];
}

interface BuilderProfile {
    uuid: string;
    username: string;
    avatar: string;
}

export default function RegionEditDialog({
    regionId,
    initialDescription,
    initialFinished,
    initialBuilders,
}: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [description, setDescription] = useState(initialDescription);
    const [finished, setFinished] = useState(initialFinished);
    const [builders, setBuilders] = useState<BuilderProfile[]>([]);
    const [searchInput, setSearchInput] = useState("");
    const [searchResult, setSearchResult] = useState<Player | null | "not-found">(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isPending, startTransition] = useTransition();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isDirty =
        description !== initialDescription ||
        finished !== initialFinished ||
        JSON.stringify(builders.map((b) => b.uuid).sort()) !==
            JSON.stringify([...initialBuilders].sort());

    // Load initial builder profiles when dialog opens
    useEffect(() => {
        if (!open) return;
        setDescription(initialDescription);
        setFinished(initialFinished);
        setSearchInput("");
        setSearchResult(null);

        if (initialBuilders.length === 0) {
            setBuilders([]);
            return;
        }
        Promise.all(initialBuilders.map((uuid) => getUser(uuid))).then((profiles) => {
            setBuilders(
                profiles
                    .filter((p): p is Player => p !== null)
                    .map((p) => ({ uuid: p.raw_id, username: p.username, avatar: p.avatar }))
            );
        });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Debounced auto-search
    const handleSearchInput = useCallback((value: string) => {
        setSearchInput(value);
        setSearchResult(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!value.trim()) return;
        debounceRef.current = setTimeout(async () => {
            setIsSearching(true);
            const player = await getUser(value.trim());
            setSearchResult(player ?? "not-found");
            setIsSearching(false);
        }, 400);
    }, []);

    function addBuilder(player: Player) {
        const uuid = player.raw_id;
        if (builders.some((b) => b.uuid === uuid)) return;
        setBuilders((prev) => [...prev, { uuid, username: player.username, avatar: player.avatar }]);
        setSearchInput("");
        setSearchResult(null);
    }

    function removeBuilder(uuid: string) {
        setBuilders((prev) => prev.filter((b) => b.uuid !== uuid));
    }

    function handleSave() {
        startTransition(async () => {
            try {
                await updateRegion({
                    regionId,
                    description,
                    finished,
                    builders: builders.map((b) => b.uuid),
                });
                toast.success("Region gespeichert");
                setOpen(false);
                router.refresh();
            } catch (e: any) {
                toast.error(e?.message ?? "Fehler beim Speichern");
            }
        });
    }

    const alreadyAdded =
        searchResult && searchResult !== "not-found"
            ? builders.some((b) => b.uuid === searchResult.raw_id)
            : false;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <PencilIcon size={13} />
                    Bearbeiten
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                    <DialogTitle className="text-base">Region bearbeiten</DialogTitle>
                </DialogHeader>

                <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Description */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Beschreibung
                            </label>
                            <span className={cn(
                                "text-xs tabular-nums transition-colors",
                                description.length > MAX_DESCRIPTION * 0.9
                                    ? "text-destructive"
                                    : "text-muted-foreground/50"
                            )}>
                                {description.length}/{MAX_DESCRIPTION}
                            </span>
                        </div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                            placeholder="Beschreibe deine Region…"
                            rows={3}
                            className="w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition resize-none"
                        />
                    </div>

                    {/* Status toggle */}
                    <button
                        type="button"
                        onClick={() => setFinished((f) => !f)}
                        className={cn(
                            "w-full flex items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-all duration-200",
                            finished
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : "border-border bg-muted/20 hover:bg-muted/30"
                        )}
                    >
                        <div className={cn(
                            "flex items-center justify-center size-9 rounded-full shrink-0 transition-colors duration-200",
                            finished ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
                        )}>
                            {finished
                                ? <CheckCircle2Icon size={18} />
                                : <ClockIcon size={18} />
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={cn(
                                "text-sm font-semibold transition-colors",
                                finished ? "text-emerald-400" : "text-foreground"
                            )}>
                                {finished ? "Fertiggestellt" : "In Arbeit"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {finished
                                    ? "Diese Region ist vollständig gebaut."
                                    : "Diese Region wird noch gebaut."}
                            </p>
                        </div>
                        {/* Toggle */}
                        <div className={cn(
                            "relative h-6 w-11 rounded-full transition-colors duration-200 shrink-0",
                            finished ? "bg-emerald-500" : "bg-muted-foreground/30"
                        )}>
                            <span className={cn(
                                "absolute top-1 size-4 rounded-full bg-white shadow transition-all duration-200",
                                finished ? "left-[calc(100%-1.25rem)]" : "left-1"
                            )} />
                        </div>
                    </button>

                    {/* Builders */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                            Builder
                        </label>

                        {/* Search input — auto-searches on typing */}
                        <div className="relative">
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                {isSearching
                                    ? <LoaderIcon size={13} className="animate-spin" />
                                    : <SearchIcon size={13} />
                                }
                            </div>
                            <input
                                value={searchInput}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && searchResult && searchResult !== "not-found" && !alreadyAdded) {
                                        addBuilder(searchResult);
                                    }
                                }}
                                placeholder="Minecraft-Name eingeben…"
                                className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3.5 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
                            />
                        </div>

                        {/* Search result */}
                        <AnimatePresence mode="wait">
                            {searchResult === "not-found" && (
                                <motion.p
                                    key="not-found"
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="text-xs text-destructive px-1"
                                >
                                    Spieler nicht gefunden.
                                </motion.p>
                            )}
                            {searchResult && searchResult !== "not-found" && (
                                <motion.button
                                    key="result"
                                    type="button"
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => !alreadyAdded && addBuilder(searchResult)}
                                    disabled={alreadyAdded}
                                    className={cn(
                                        "w-full flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all",
                                        alreadyAdded
                                            ? "border-border bg-muted/10 opacity-60 cursor-default"
                                            : "border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                                    )}
                                >
                                    <img
                                        src={searchResult.avatar}
                                        alt={searchResult.username}
                                        className="size-8 rounded-full shrink-0"
                                    />
                                    <span className="flex-1 text-sm font-medium">{searchResult.username}</span>
                                    {alreadyAdded ? (
                                        <span className="text-xs text-muted-foreground">Bereits im Team</span>
                                    ) : (
                                        <span className="text-xs text-primary font-medium">↵ Hinzufügen</span>
                                    )}
                                </motion.button>
                            )}
                        </AnimatePresence>

                        {/* Current builders as chips */}
                        <AnimatePresence>
                            {builders.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-wrap gap-2"
                                >
                                    {builders.map((b) => (
                                        <motion.div
                                            key={b.uuid}
                                            layout
                                            initial={{ opacity: 0, scale: 0.85 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.85 }}
                                            transition={{ duration: 0.15 }}
                                            className="flex items-center gap-2 rounded-full border border-border bg-muted/30 pl-1 pr-2.5 py-1"
                                        >
                                            <img
                                                src={b.avatar}
                                                alt={b.username}
                                                className="size-6 rounded-full"
                                            />
                                            <span className="text-sm font-medium leading-none">{b.username}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeBuilder(b.uuid)}
                                                className="ml-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
                                            >
                                                <XIcon size={12} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {builders.length === 0 && !searchResult && (
                            <p className="text-xs text-muted-foreground/50 px-1">
                                Noch keine weiteren Builder hinzugefügt.
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
                    <AnimatePresence>
                        {isDirty && (
                            <motion.p
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -6 }}
                                className="text-xs text-muted-foreground"
                            >
                                Ungespeicherte Änderungen
                            </motion.p>
                        )}
                    </AnimatePresence>
                    <div className="flex gap-2 ml-auto">
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                            Abbrechen
                        </Button>
                        <Button onClick={handleSave} disabled={isPending || !isDirty} className="gap-1.5 min-w-[100px]">
                            {isPending ? (
                                <>
                                    <LoaderIcon size={13} className="animate-spin" />
                                    Speichern…
                                </>
                            ) : (
                                <>
                                    <CheckIcon size={13} />
                                    Speichern
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
