"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
    XIcon, SearchIcon, LoaderIcon, CheckIcon,
    CheckCircle2Icon, ClockIcon, UserIcon,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminUpdateRegion, type AdminUpdateRegionInput } from "@/actions/region/AdminUpdateRegion";
import getUser, { type Player } from "@/actions/minecraft/user";
import { AnimatePresence, motion } from "motion/react";

const STATES = [
    { code: "", label: "Kein Bundesland" },
    { code: "BW", label: "Baden-Württemberg" },
    { code: "BY", label: "Bayern" },
    { code: "BE", label: "Berlin" },
    { code: "BB", label: "Brandenburg" },
    { code: "HB", label: "Bremen" },
    { code: "HH", label: "Hamburg" },
    { code: "HE", label: "Hessen" },
    { code: "MV", label: "Mecklenburg-Vorpommern" },
    { code: "NI", label: "Niedersachsen" },
    { code: "NW", label: "Nordrhein-Westfalen" },
    { code: "RP", label: "Rheinland-Pfalz" },
    { code: "SL", label: "Saarland" },
    { code: "SN", label: "Sachsen" },
    { code: "ST", label: "Sachsen-Anhalt" },
    { code: "SH", label: "Schleswig-Holstein" },
    { code: "TH", label: "Thüringen" },
];

const TYPE_OPTIONS = [
    { value: "default", label: "Standard" },
    { value: "plot", label: "Plot" },
    { value: "event", label: "Event" },
] as const;

const MAX_DESCRIPTION = 500;

interface RegionData {
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
}

interface BuilderProfile {
    uuid: string;
    username: string;
    avatar: string;
}

interface Props {
    region: RegionData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}

export default function RegionAdminEditDialog({ region, open, onOpenChange, onSaved }: Props) {
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [type, setType] = useState<"default" | "plot" | "event">("default");
    const [description, setDescription] = useState("");
    const [finished, setFinished] = useState(false);
    const [buildings, setBuildings] = useState(0);
    const [area, setArea] = useState("");
    const [creatorUUID, setCreatorUUID] = useState("");
    const [creatorProfile, setCreatorProfile] = useState<Player | null>(null);
    const [creatorSearchInput, setCreatorSearchInput] = useState("");
    const [creatorSearchResult, setCreatorSearchResult] = useState<Player | null | "not-found">(null);
    const [isSearchingCreator, setIsSearchingCreator] = useState(false);
    const [builders, setBuilders] = useState<BuilderProfile[]>([]);
    const [builderSearchInput, setBuilderSearchInput] = useState("");
    const [builderSearchResult, setBuilderSearchResult] = useState<Player | null | "not-found">(null);
    const [isSearchingBuilder, setIsSearchingBuilder] = useState(false);
    const [isPending, startTransition] = useTransition();
    const creatorDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const builderDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset form when region changes
    useEffect(() => {
        if (!open || !region) return;
        setAddress(region.address);
        setCity(region.city);
        setState(region.state);
        setType(region.type);
        setDescription(region.description ?? "");
        setFinished(region.finished);
        setBuildings(region.buildings);
        setArea(region.area);
        setCreatorUUID(region.creatorUUID);
        setCreatorSearchInput("");
        setCreatorSearchResult(null);
        setBuilderSearchInput("");
        setBuilderSearchResult(null);

        // Load creator profile
        getUser(region.creatorUUID).then(setCreatorProfile);

        // Load builder profiles
        const uuids = region.builders ?? [];
        if (uuids.length === 0) { setBuilders([]); return; }
        Promise.all(uuids.map((u) => getUser(u))).then((profiles) => {
            setBuilders(
                profiles
                    .filter((p): p is Player => p !== null)
                    .map((p) => ({ uuid: p.raw_id, username: p.username, avatar: p.avatar }))
            );
        });
    }, [open, region]); // eslint-disable-line react-hooks/exhaustive-deps

    const isDirty = region
        ? address !== region.address ||
          city !== region.city ||
          state !== region.state ||
          type !== region.type ||
          description !== (region.description ?? "") ||
          finished !== region.finished ||
          buildings !== region.buildings ||
          area !== region.area ||
          creatorUUID !== region.creatorUUID ||
          JSON.stringify(builders.map((b) => b.uuid).sort()) !==
              JSON.stringify([...(region.builders ?? [])].sort())
        : false;

    // Creator auto-search
    const handleCreatorInput = useCallback((value: string) => {
        setCreatorSearchInput(value);
        setCreatorSearchResult(null);
        if (creatorDebounce.current) clearTimeout(creatorDebounce.current);
        if (!value.trim()) return;
        creatorDebounce.current = setTimeout(async () => {
            setIsSearchingCreator(true);
            const player = await getUser(value.trim());
            setCreatorSearchResult(player ?? "not-found");
            setIsSearchingCreator(false);
        }, 400);
    }, []);

    function applyCreator(player: Player) {
        setCreatorUUID(player.raw_id);
        setCreatorProfile(player);
        setCreatorSearchInput("");
        setCreatorSearchResult(null);
    }

    // Builder auto-search
    const handleBuilderInput = useCallback((value: string) => {
        setBuilderSearchInput(value);
        setBuilderSearchResult(null);
        if (builderDebounce.current) clearTimeout(builderDebounce.current);
        if (!value.trim()) return;
        builderDebounce.current = setTimeout(async () => {
            setIsSearchingBuilder(true);
            const player = await getUser(value.trim());
            setBuilderSearchResult(player ?? "not-found");
            setIsSearchingBuilder(false);
        }, 400);
    }, []);

    function addBuilder(player: Player) {
        if (builders.some((b) => b.uuid === player.raw_id)) return;
        setBuilders((prev) => [...prev, { uuid: player.raw_id, username: player.username, avatar: player.avatar }]);
        setBuilderSearchInput("");
        setBuilderSearchResult(null);
    }

    function removeBuilder(uuid: string) {
        setBuilders((prev) => prev.filter((b) => b.uuid !== uuid));
    }

    function handleSave() {
        if (!region) return;
        startTransition(async () => {
            try {
                await adminUpdateRegion({
                    regionId: region.id,
                    address,
                    city,
                    state,
                    type,
                    description,
                    finished,
                    buildings,
                    area,
                    creatorUUID,
                    builders: builders.map((b) => b.uuid),
                });
                toast.success("Region gespeichert");
                onOpenChange(false);
                onSaved();
            } catch (e: any) {
                toast.error(e?.message ?? "Fehler beim Speichern");
            }
        });
    }

    const builderAlreadyAdded =
        builderSearchResult && builderSearchResult !== "not-found"
            ? builders.some((b) => b.uuid === builderSearchResult.raw_id)
            : false;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                    <DialogTitle className="text-base">
                        Region bearbeiten
                        {region && (
                            <span className="ml-2 text-muted-foreground font-normal text-sm">
                                {region.address || region.city}
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto">
                    {/* Location */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ort</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">Adresse</label>
                                <input
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Straße, Hausnummer…"
                                    className={inputCls}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">Stadt</label>
                                <input
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    placeholder="Stadtname…"
                                    className={inputCls}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">Bundesland</label>
                            <select value={state} onChange={(e) => setState(e.target.value)} className={inputCls}>
                                {STATES.map((s) => (
                                    <option key={s.code} value={s.code}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                    </section>

                    {/* Type & Status */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typ & Status</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {TYPE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setType(opt.value)}
                                    className={cn(
                                        "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all text-center",
                                        type === opt.value
                                            ? "border-primary/40 bg-primary/10 text-primary"
                                            : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setFinished((f) => !f)}
                            className={cn(
                                "w-full flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all",
                                finished
                                    ? "border-emerald-500/30 bg-emerald-500/5"
                                    : "border-border bg-muted/20 hover:bg-muted/30"
                            )}
                        >
                            <div className={cn(
                                "flex items-center justify-center size-8 rounded-full shrink-0 transition-colors",
                                finished ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
                            )}>
                                {finished ? <CheckCircle2Icon size={16} /> : <ClockIcon size={16} />}
                            </div>
                            <div className="flex-1">
                                <p className={cn("text-sm font-semibold", finished ? "text-emerald-400" : "text-foreground")}>
                                    {finished ? "Fertiggestellt" : "In Arbeit"}
                                </p>
                            </div>
                            <div className={cn(
                                "relative h-5 w-9 rounded-full transition-colors shrink-0",
                                finished ? "bg-emerald-500" : "bg-muted-foreground/30"
                            )}>
                                <span className={cn(
                                    "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
                                    finished ? "left-[calc(100%-1.125rem)]" : "left-0.5"
                                )} />
                            </div>
                        </button>
                    </section>

                    {/* Stats */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statistiken</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">Gebäude</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={buildings}
                                    onChange={(e) => setBuildings(parseInt(e.target.value) || 0)}
                                    className={inputCls}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">Fläche (m²)</label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={area}
                                    onChange={(e) => setArea(e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Description */}
                    <section className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Beschreibung</h3>
                            <span className={cn(
                                "text-xs tabular-nums transition-colors",
                                description.length > MAX_DESCRIPTION * 0.9 ? "text-destructive" : "text-muted-foreground/50"
                            )}>
                                {description.length}/{MAX_DESCRIPTION}
                            </span>
                        </div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                            placeholder="Beschreibung der Region…"
                            rows={3}
                            className={cn(inputCls, "resize-none")}
                        />
                    </section>

                    {/* Creator */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ersteller</h3>
                        {creatorProfile && (
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3.5 py-2.5">
                                <img src={creatorProfile.avatar} alt={creatorProfile.username} className="size-8 rounded-full shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold">{creatorProfile.username}</p>
                                    <p className="text-xs text-muted-foreground font-mono truncate">{creatorUUID}</p>
                                </div>
                                <UserIcon size={14} className="text-muted-foreground/50 shrink-0" />
                            </div>
                        )}
                        <div className="relative">
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                {isSearchingCreator
                                    ? <LoaderIcon size={13} className="animate-spin" />
                                    : <SearchIcon size={13} />
                                }
                            </div>
                            <input
                                value={creatorSearchInput}
                                onChange={(e) => handleCreatorInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && creatorSearchResult && creatorSearchResult !== "not-found") {
                                        applyCreator(creatorSearchResult);
                                    }
                                }}
                                placeholder="Anderen Ersteller suchen…"
                                className={cn(inputCls, "pl-9")}
                            />
                        </div>
                        <AnimatePresence mode="wait">
                            {creatorSearchResult === "not-found" && (
                                <motion.p key="nf" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="text-xs text-destructive px-1">Spieler nicht gefunden.</motion.p>
                            )}
                            {creatorSearchResult && creatorSearchResult !== "not-found" && (
                                <motion.button
                                    key="cr"
                                    type="button"
                                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    onClick={() => applyCreator(creatorSearchResult)}
                                    className="w-full flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 px-3.5 py-2.5 text-left transition-all"
                                >
                                    <img src={creatorSearchResult.avatar} alt={creatorSearchResult.username} className="size-8 rounded-full shrink-0" />
                                    <span className="flex-1 text-sm font-medium">{creatorSearchResult.username}</span>
                                    <span className="text-xs text-primary font-medium">↵ Übernehmen</span>
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </section>

                    {/* Builders */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Builder</h3>
                        <div className="relative">
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                {isSearchingBuilder
                                    ? <LoaderIcon size={13} className="animate-spin" />
                                    : <SearchIcon size={13} />
                                }
                            </div>
                            <input
                                value={builderSearchInput}
                                onChange={(e) => handleBuilderInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && builderSearchResult && builderSearchResult !== "not-found" && !builderAlreadyAdded) {
                                        addBuilder(builderSearchResult);
                                    }
                                }}
                                placeholder="Minecraft-Name eingeben…"
                                className={cn(inputCls, "pl-9")}
                            />
                        </div>
                        <AnimatePresence mode="wait">
                            {builderSearchResult === "not-found" && (
                                <motion.p key="nf" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="text-xs text-destructive px-1">Spieler nicht gefunden.</motion.p>
                            )}
                            {builderSearchResult && builderSearchResult !== "not-found" && (
                                <motion.button
                                    key="br"
                                    type="button"
                                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    onClick={() => !builderAlreadyAdded && addBuilder(builderSearchResult)}
                                    disabled={builderAlreadyAdded}
                                    className={cn(
                                        "w-full flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all",
                                        builderAlreadyAdded
                                            ? "border-border bg-muted/10 opacity-60 cursor-default"
                                            : "border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                                    )}
                                >
                                    <img src={builderSearchResult.avatar} alt={builderSearchResult.username} className="size-8 rounded-full shrink-0" />
                                    <span className="flex-1 text-sm font-medium">{builderSearchResult.username}</span>
                                    {builderAlreadyAdded
                                        ? <span className="text-xs text-muted-foreground">Bereits im Team</span>
                                        : <span className="text-xs text-primary font-medium">↵ Hinzufügen</span>
                                    }
                                </motion.button>
                            )}
                        </AnimatePresence>
                        <AnimatePresence>
                            {builders.length > 0 && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2">
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
                                            <img src={b.avatar} alt={b.username} className="size-6 rounded-full" />
                                            <span className="text-sm font-medium leading-none">{b.username}</span>
                                            <button type="button" onClick={() => removeBuilder(b.uuid)}
                                                className="ml-0.5 text-muted-foreground/60 hover:text-foreground transition-colors">
                                                <XIcon size={12} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {builders.length === 0 && !builderSearchResult && (
                            <p className="text-xs text-muted-foreground/50 px-1">Noch keine weiteren Builder.</p>
                        )}
                    </section>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex items-center gap-3">
                    <AnimatePresence>
                        {isDirty && (
                            <motion.p
                                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                                className="text-xs text-muted-foreground"
                            >
                                Ungespeicherte Änderungen
                            </motion.p>
                        )}
                    </AnimatePresence>
                    <div className="flex gap-2 ml-auto">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
                            Abbrechen
                        </Button>
                        <Button onClick={handleSave} disabled={isPending || !isDirty} className="gap-1.5 min-w-[100px]">
                            {isPending ? (
                                <><LoaderIcon size={13} className="animate-spin" />Speichern…</>
                            ) : (
                                <><CheckIcon size={13} />Speichern</>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const inputCls =
    "w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition";
