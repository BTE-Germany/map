import { AnimatePresence, motion } from "motion/react";
import {
    HouseIcon, LandPlotIcon, XIcon, MapPinIcon,
    CalendarIcon, CheckCircle2Icon, ClockIcon, LayersIcon, ArrowRightIcon, PencilRulerIcon,
    Loader2, NavigationIcon, Trash2Icon, AlertTriangleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { teleportToRegion } from "@/actions/teleport/Teleport";
import { deleteRegion } from "@/actions/region/DeleteRegion";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMap } from "@vis.gl/react-maplibre";
import type { LngLatBounds } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import useRegionShapeEdit from "@/stores/RegionShapeEditStore";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { useRegion } from "@/dataHooks/regions/useRegion";
import useRegionPane from "@/stores/RegionPaneStore";
import { useMcUser } from "@/dataHooks/minecraft/useMcUser";
import SanitizedHtml from "@/components/common/SanitizedHtml";
import { useSession } from "next-auth/react";
import type { BoundsTuple } from "@/stores/RegionPaneStore";
import type { LandUseStats } from "@/db/schema";
import { stateCodeToName } from "@/lib/federalStates";
import useUserSettings, { formatAreaWithMode } from "@/stores/UserSettingsStore";
import RegionImageGallery from "@/components/map/region/RegionImageGallery";
import Region3DMap from "@/components/map/region/Region3DMap";

const isFiniteBounds = (bounds: BoundsTuple): boolean => {
    return bounds.every((value) => Number.isFinite(value));
};

const getBoundsTupleFromMapBounds = (bounds: LngLatBounds): BoundsTuple | null => {
    const west = typeof bounds?.getWest === "function" ? bounds.getWest() : undefined;
    const south = typeof bounds?.getSouth === "function" ? bounds.getSouth() : undefined;
    const east = typeof bounds?.getEast === "function" ? bounds.getEast() : undefined;
    const north = typeof bounds?.getNorth === "function" ? bounds.getNorth() : undefined;

    const tuple: BoundsTuple = [Number(west), Number(south), Number(east), Number(north)];
    return isFiniteBounds(tuple) ? tuple : null;
};

function formatDate(date: Date | string | null | undefined): string {
    if (!date) return "–";
    return new Date(date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

const LANDUSE_CONFIG: { key: keyof LandUseStats; label: string; color: string }[] = [
    { key: "residential", label: "Wohngebiet", color: "#f97316" },
    { key: "forest", label: "Wald", color: "#16a34a" },
    { key: "farmland", label: "Landwirtschaft", color: "#a3e635" },
    { key: "water", label: "Wasser", color: "#3b82f6" },
    { key: "industrial", label: "Gewerbe", color: "#94a3b8" },
    { key: "park", label: "Park / Grün", color: "#4ade80" },
];

const TYPE_CONFIG: Record<string, { label: string; textColor: string; dotColor: string }> = {
    default: { label: "Standard", textColor: "text-sky-400", dotColor: "bg-sky-400" },
    plot: { label: "Plot", textColor: "text-emerald-400", dotColor: "bg-emerald-400" },
    event: { label: "Event", textColor: "text-amber-400", dotColor: "bg-amber-400" },
};

function LandUseSection({ landuse, totalArea, areaMode }: { landuse: LandUseStats; totalArea: number; areaMode: import("@/stores/UserSettingsStore").AreaUnitMode }) {
    const categorized = LANDUSE_CONFIG.map(cfg => ({
        ...cfg,
        value: landuse[cfg.key],
    })).filter(d => d.value > 0);

    const categorizedSum = categorized.reduce((s, d) => s + d.value, 0);
    const other = Math.max(0, totalArea - categorizedSum);

    const data = [
        ...categorized,
        ...(other > 1 ? [{ key: "other" as const, label: "Sonstiges", color: "#3f3f46", value: other }] : []),
    ];

    const totalValue = data.reduce((s, d) => s + d.value, 0);
    if (data.length === 0 || totalValue === 0) return null;

    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <LayersIcon size={12} className="text-neutral-500" />
                <p className="uppercase text-neutral-500 text-[10px] font-semibold tracking-widest">
                    Flächennutzung
                </p>
            </div>

            {/* Stacked bar */}
            <div className="h-2 w-full rounded-full overflow-hidden flex mb-4" style={{ gap: "1px" }}>
                {data.map(d => {
                    const pct = (d.value / totalValue) * 100;
                    return (
                        <div
                            key={d.key}
                            title={`${d.label}: ${pct.toFixed(1)}%`}
                            style={{ width: `${pct}%`, backgroundColor: d.color, flexShrink: 0 }}
                        />
                    );
                })}
            </div>

            {/* Breakdown rows */}
            <div className="space-y-2">
                {data.map(d => {
                    const pct = (d.value / totalValue) * 100;
                    const area = formatAreaWithMode(d.value, areaMode);
                    return (
                        <div key={d.key} className="flex items-center gap-2.5 text-xs">
                            <span
                                className="size-2 rounded-[3px] shrink-0"
                                style={{ backgroundColor: d.color }}
                            />
                            <span className="text-neutral-400 flex-1 truncate">{d.label}</span>
                            <span className="text-neutral-600 tabular-nums text-[11px]">
                                {area.value} {area.unit}
                            </span>
                            <span className="text-neutral-300 tabular-nums font-medium w-9 text-right">
                                {pct.toFixed(1)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function BuilderAvatar({ uuid, size = 9 }: { uuid: string; size?: number }) {
    const { data } = useMcUser(uuid);
    if (!data) return <div className={`size-${size} rounded-full bg-neutral-800 animate-pulse shrink-0`} />;
    return (
        <img
            src={data.avatar}
            alt={data.username}
            className={`size-${size} rounded-full shrink-0`}
        />
    );
}

function BuilderAvatarStack({
    creatorUUID,
    builders,
    isLoading,
}: {
    creatorUUID: string;
    builders: string[];
    isLoading: boolean;
}) {
    const [hovered, setHovered] = useState(false);
    const { data: ownerData, isLoading: isOwnerLoading } = useMcUser(creatorUUID);
    const allUUIDs = [creatorUUID, ...builders];

    if (isLoading || isOwnerLoading) {
        return (
            <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-neutral-800 animate-pulse" />
                <div className="space-y-1">
                    <div className="w-16 h-2.5 bg-neutral-800 animate-pulse rounded" />
                    <div className="w-24 h-3.5 bg-neutral-800 animate-pulse rounded" />
                </div>
            </div>
        );
    }

    return (
        <div
            className="relative flex items-center gap-3"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Overlapping avatar stack */}
            <div className="flex items-center">
                {allUUIDs.map((uuid, i) => (
                    <div
                        key={uuid}
                        className="relative"
                        style={{ marginLeft: i === 0 ? 0 : -10, zIndex: allUUIDs.length - i }}
                    >
                        <BuilderAvatar uuid={uuid} size={9} />
                    </div>
                ))}
            </div>

            {/* Name area */}
            <div className="overflow-hidden">
                <p className="text-[10px] uppercase tracking-widest text-neutral-600 font-semibold">
                    {hovered ? "Team" : "Erstellt von"}
                </p>
                <AnimatePresence mode="wait">
                    {hovered ? (
                        <motion.div
                            key="all"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="flex flex-wrap gap-x-1.5 gap-y-0.5"
                        >
                            {allUUIDs.map((uuid) => (
                                <BuilderName key={uuid} uuid={uuid} isCreator={uuid === creatorUUID} />
                            ))}
                        </motion.div>
                    ) : (
                        <motion.p
                            key="creator"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="text-sm font-semibold text-neutral-200"
                        >
                            {ownerData?.username}
                            {builders.length > 0 && (
                                <span className="ml-1.5 text-xs font-normal text-neutral-500">
                                    +{builders.length}
                                </span>
                            )}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function BuilderName({ uuid, isCreator }: { uuid: string; isCreator: boolean }) {
    const { data } = useMcUser(uuid);
    if (!data) return null;
    return (
        <span className={`text-sm font-semibold ${isCreator ? "text-neutral-200" : "text-neutral-400"}`}>
            {data.username}
        </span>
    );
}

function StatCard({
    icon, label, children, isLoading, accent,
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
    isLoading: boolean;
    accent?: string;
}) {
    return (
        <div className="relative rounded-2xl bg-white/[0.04] border border-white/[0.07] px-5 py-4 overflow-hidden">
            <div className="flex items-center gap-1.5 text-neutral-500 mb-2.5">
                {icon}
                <p className="text-[10px] font-semibold uppercase tracking-widest">{label}</p>
            </div>
            {isLoading ? (
                <div className="w-2/3 h-8 bg-neutral-800 animate-pulse rounded-lg" />
            ) : (
                <div className="min-h-9 flex items-end">{children}</div>
            )}
            {accent && (
                <div
                    className="absolute -right-6 -bottom-6 size-20 rounded-full blur-2xl opacity-30"
                    style={{ backgroundColor: accent }}
                />
            )}
        </div>
    );
}

function MetaChip({
    label, children, isLoading,
}: {
    label: string;
    children: React.ReactNode;
    isLoading: boolean;
}) {
    return (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-1.5">
                {label}
            </p>
            {isLoading ? (
                <div className="w-1/2 h-4 bg-neutral-800 animate-pulse rounded" />
            ) : (
                children
            )}
        </div>
    );
}

export default function RegionPane() {
    const regionPageStore = useRegionPane();
    const { data: sessionData } = useSession();

    const { mainMap: map } = useMap();
    const { data: region, isLoading } = useRegion(regionPageStore.region);

    const isCreator = sessionData?.user?.minecraft_uuid === region?.creatorUUID;
    const roles = sessionData?.user.realm_access?.roles ?? [];
    const isAdmin = hasPermission(roles, PERMISSIONS.REGIONS_EDIT);
    const canEditShape = (isCreator || isAdmin) && !isLoading;
    const can3D = hasPermission(roles, PERMISSIONS.MAP_3D_VIEW);
    const hasMcLink = !!sessionData?.user?.minecraft_uuid;
    const canDelete = (isCreator || isAdmin) && !isLoading;
    const [isTeleporting, setIsTeleporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const queryClient = useQueryClient();

    async function handleDelete() {
        if (!region) return;
        setIsDeleting(true);
        try {
            await deleteRegion(region.id);
            toast.success("Region gelöscht.");
            setConfirmDelete(false);
            regionPageStore.setOpen(false);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["regions"] }),
                queryClient.invalidateQueries({ queryKey: ["regions_geojson"] }),
                queryClient.invalidateQueries({ queryKey: ["region", region.id] }),
            ]);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
        } finally {
            setIsDeleting(false);
        }
    }

    async function handleTeleport() {
        if (!region) return;
        setIsTeleporting(true);
        try {
            await teleportToRegion(region.id);
            toast.success("Teleport-Anfrage gesendet — wechsle in den Server.");
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Teleport fehlgeschlagen");
        } finally {
            setIsTeleporting(false);
        }
    }
    const shapeEdit = useRegionShapeEdit();
    const paneRef = useRef<HTMLDivElement>(null);

    // Close the pane when the user taps (not drags) on the map. Only map
    // clicks count — other overlays like the lightbox portal don't close it.
    useEffect(() => {
        if (!regionPageStore.open) return;

        let startX = 0;
        let startY = 0;
        let downOnMap = false;

        const onDown = (e: PointerEvent) => {
            startX = e.clientX;
            startY = e.clientY;
            const mapEl = document.querySelector(".maplibregl-map");
            const target = e.target as Node | null;
            downOnMap = !!(mapEl && target && mapEl.contains(target));
        };
        const onUp = (e: PointerEvent) => {
            if (!downOnMap) return;
            const moved = Math.hypot(e.clientX - startX, e.clientY - startY);
            if (moved > 5) return; // treat as drag/pan, don't close
            if (paneRef.current?.contains(e.target as Node)) return;
            regionPageStore.setOpen(false);
        };

        document.addEventListener("pointerdown", onDown, true);
        document.addEventListener("pointerup", onUp, true);
        return () => {
            document.removeEventListener("pointerdown", onDown, true);
            document.removeEventListener("pointerup", onUp, true);
        };
    }, [regionPageStore.open]);

    useEffect(() => {
        if (!regionPageStore.open && map && regionPageStore.restoreBox && isFiniteBounds(regionPageStore.restoreBox)) {
            map?.fitBounds(regionPageStore.restoreBox, { duration: 1000 });
            return;
        }

        if (regionPageStore.open && region && map) {
            const currentBounds = getBoundsTupleFromMapBounds(map.getBounds());
            if (currentBounds) {
                regionPageStore.setRestoreBox(currentBounds);
            }

            const coordinates = region.polygon;
            if (coordinates && coordinates.length > 0) {
                const lats = coordinates.map((coord: number[]) => coord[0]);
                const lngs = coordinates.map((coord: number[]) => coord[1]);

                const minLat = Math.min(...lats);
                const maxLat = Math.max(...lats);
                const minLng = Math.min(...lngs);
                const maxLng = Math.max(...lngs);

                const offsetLng = (maxLng - minLng) * 0.2;

                const bounds: BoundsTuple = [
                    minLng - offsetLng,
                    minLat,
                    maxLng + offsetLng,
                    maxLat,
                ];

                if (!isFiniteBounds(bounds)) return;

                const padding = 100;
                const isMobile = window.innerWidth < 768;
                map.fitBounds(bounds, {
                    padding: isMobile
                        ? {
                              top: padding,
                              bottom: window.innerHeight * 0.55 + 20,
                              left: 40,
                              right: 40,
                          }
                        : {
                              top: padding + 50,
                              bottom: padding,
                              left: Math.min(window.innerWidth * 0.4, 560) + padding,
                              right: padding,
                          },
                    duration: 1000,
                });
            }
        }
    }, [regionPageStore.open, region, map]);

    const { areaUnit, show3DMap } = useUserSettings();

    const area = region?.area ? parseFloat(region.area) : 0;
    const formattedArea = formatAreaWithMode(area, areaUnit);
    const typeConfig = TYPE_CONFIG[region?.type ?? "default"] ?? TYPE_CONFIG.default;

    const createdAt = region?.createdAt ? new Date(region.createdAt) : null;
    const modifiedAt = region?.modifiedAt ? new Date(region.modifiedAt) : null;
    const showModified =
        modifiedAt &&
        createdAt &&
        Math.abs(modifiedAt.getTime() - createdAt.getTime()) > 60_000;

    return (
        <AnimatePresence>
            {regionPageStore.open && (
                <motion.div ref={paneRef} className="absolute inset-x-0 bottom-0 h-[min(85vh,720px)] p-2 z-50 md:top-0 md:bottom-auto md:inset-x-auto md:left-0 md:h-full md:w-[min(40%,560px)] md:p-4">
                    <motion.div
                        className="scrollbar-thin relative h-full w-full bg-neutral-950/80 md:bg-neutral-950/75 backdrop-blur-2xl overflow-y-auto rounded-t-2xl md:rounded-2xl border border-white/[0.06] shadow-2xl"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{
                            opacity: 1,
                            x: 0,
                            y: 0,
                            transition: { type: "spring", stiffness: 409, damping: 38, mass: 0.3, restDelta: 0.001 },
                        }}
                        exit={{ opacity: 0, y: 40 }}
                    >
                        {/* Top gradient sheen */}
                        <div className="absolute inset-x-0 top-0 h-48 rounded-t-2xl bg-gradient-to-b from-sky-900/20 via-transparent to-transparent pointer-events-none" />

                        {/* Mobile drag handle */}
                        <div className="md:hidden flex justify-center pt-2 pb-1">
                            <div className="h-1 w-10 rounded-full bg-white/15" />
                        </div>

                        {/* Topbar */}
                        <div className="relative flex items-center justify-between px-5 md:px-7 pt-3 md:pt-6 pb-0">
                            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-neutral-600">
                                Region
                            </p>
                            <button
                                onClick={() => regionPageStore.setOpen(false)}
                                className="bg-white/[0.06] hover:bg-white/[0.1] rounded-xl p-2 active:scale-95 transition-all"
                            >
                                <XIcon size={15} className="text-neutral-400" />
                            </button>
                        </div>

                        <div className="relative px-5 md:px-7 pt-4 pb-8 space-y-5 md:space-y-6">
                            {/* Title block */}
                            <div>
                                {isCreator && !isLoading && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full mb-3"
                                    >
                                        <CheckCircle2Icon size={10} />
                                        Deine Region
                                    </motion.div>
                                )}

                                {isLoading ? (
                                    <div className="space-y-2">
                                        <div className="w-4/5 h-9 bg-neutral-800/80 animate-pulse rounded-xl" />
                                        <div className="w-1/2 h-4 bg-neutral-800/60 animate-pulse rounded-lg" />
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-2xl md:text-[1.75rem] font-bold leading-tight text-white line-clamp-2 mb-2">
                                            {region?.address}
                                        </h1>
                                        <div className="flex items-center gap-1.5 text-sm text-neutral-500">
                                            <MapPinIcon size={12} className="shrink-0" />
                                            <span>
                                                {[region?.city, region?.state ? stateCodeToName(region.state) : null]
                                                    .filter(Boolean)
                                                    .join(", ")}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Owner + Builders — hidden for plot/event */}
                            {region?.type === "default" && (
                                <div className="pb-5 border-b border-white/[0.06]">
                                    <BuilderAvatarStack
                                        creatorUUID={region.creatorUUID}
                                        builders={region.builders ?? []}
                                        isLoading={isLoading}
                                    />
                                </div>
                            )}

                            {/* Primary stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <StatCard
                                    icon={<HouseIcon size={13} />}
                                    label="Gebäude"
                                    isLoading={isLoading}
                                    accent="#3b82f6"
                                >
                                    <span className="text-3xl font-bold text-white tabular-nums">
                                        {region?.buildings?.toLocaleString("de-DE") ?? "–"}
                                    </span>
                                </StatCard>

                                <StatCard
                                    icon={<LandPlotIcon size={13} />}
                                    label="Fläche"
                                    isLoading={isLoading}
                                    accent="#22c55e"
                                >
                                    <span className="text-white tabular-nums">
                                        <span className="text-3xl font-bold">{formattedArea.value}</span>
                                        <span className="text-base text-neutral-500 ml-1.5">{formattedArea.unit}</span>
                                    </span>
                                </StatCard>
                            </div>

                            {/* Meta chips */}
                            <div className="grid grid-cols-2 gap-3">
                                <MetaChip label="Typ" isLoading={isLoading}>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`size-2 rounded-full ${typeConfig.dotColor}`}
                                        />
                                        <span className={`text-sm font-semibold ${typeConfig.textColor}`}>
                                            {typeConfig.label}
                                        </span>
                                    </div>
                                </MetaChip>

                                <MetaChip label="Status" isLoading={isLoading}>
                                    {region?.finished ? (
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle2Icon size={13} className="text-emerald-400" />
                                            <span className="text-sm font-semibold text-emerald-400">Fertig</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <ClockIcon size={13} className="text-amber-400" />
                                            <span className="text-sm font-semibold text-amber-400">In Arbeit</span>
                                        </div>
                                    )}
                                </MetaChip>
                            </div>

                            {/* Description */}
                            {!isLoading && region?.description && (
                                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
                                    <p className="text-[10px] uppercase tracking-widest text-neutral-600 font-semibold mb-2">
                                        Beschreibung
                                    </p>
                                    <SanitizedHtml
                                        html={region.description}
                                        className="text-sm text-neutral-300 leading-relaxed"
                                    />
                                </div>
                            )}

                            {/* Landuse */}
                            {region?.landuse && (
                                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
                                    <LandUseSection
                                        landuse={region.landuse as LandUseStats}
                                        totalArea={area}
                                        areaMode={areaUnit}
                                    />
                                </div>
                            )}

                            {/* Images */}
                            {!isLoading && region && (
                                <RegionImageGallery
                                    regionId={region.id}
                                    canUpload={canEditShape}
                                />
                            )}

                            {/* 3D-Ansicht (Plus) */}
                            {!isLoading && region && can3D && show3DMap && (
                                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
                                    <Region3DMap polygon={region.polygon as [number, number][]} />
                                </div>
                            )}

                            {/* Teleport button (linked Minecraft account) */}
                            {!isLoading && region && hasMcLink && (
                                <button
                                    onClick={handleTeleport}
                                    disabled={isTeleporting}
                                    className="flex items-center justify-between w-full rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 px-5 py-3.5 transition-colors group disabled:opacity-60"
                                >
                                    <div className="flex items-center gap-2.5">
                                        {isTeleporting ? (
                                            <Loader2 size={14} className="animate-spin text-emerald-400" />
                                        ) : (
                                            <NavigationIcon size={14} className="text-emerald-400" />
                                        )}
                                        <span className="text-sm font-semibold text-emerald-300">
                                            {isTeleporting ? "Wird gesendet…" : "Auf dem Server hierher teleportieren"}
                                        </span>
                                    </div>
                                    <ArrowRightIcon
                                        size={15}
                                        className="text-emerald-400 group-hover:translate-x-0.5 transition-transform"
                                    />
                                </button>
                            )}

                            {/* Shape edit button */}
                            {canEditShape && region && (
                                <button
                                    onClick={() => {
                                        shapeEdit.startEditing(region.id, region.polygon as [number, number][]);
                                        regionPageStore.setOpen(false);
                                    }}
                                    className="flex items-center justify-between w-full rounded-2xl bg-violet-500/10 hover:bg-violet-500/15 border border-violet-500/20 px-5 py-3.5 transition-colors group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <PencilRulerIcon size={14} className="text-violet-400" />
                                        <span className="text-sm font-semibold text-violet-300">
                                            Form bearbeiten
                                        </span>
                                    </div>
                                    <ArrowRightIcon
                                        size={15}
                                        className="text-violet-400 group-hover:translate-x-0.5 transition-transform"
                                    />
                                </button>
                            )}

                            {/* Delete button (creator or admin) */}
                            {canDelete && region && (
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    disabled={isDeleting}
                                    className="flex items-center justify-between w-full rounded-2xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 px-5 py-3.5 transition-colors group disabled:opacity-60"
                                >
                                    <div className="flex items-center gap-2.5">
                                        {isDeleting ? (
                                            <Loader2 size={14} className="animate-spin text-red-400" />
                                        ) : (
                                            <Trash2Icon size={14} className="text-red-400" />
                                        )}
                                        <span className="text-sm font-semibold text-red-300">
                                            {isDeleting ? "Wird gelöscht…" : "Region löschen"}
                                        </span>
                                    </div>
                                    <ArrowRightIcon
                                        size={15}
                                        className="text-red-400 group-hover:translate-x-0.5 transition-transform"
                                    />
                                </button>
                            )}

                            {/* Region detail page link */}
                            {!isLoading && regionPageStore.region && (
                                <Link
                                    href={`/region/${regionPageStore.region}`}
                                    className="flex items-center justify-between w-full rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] px-5 py-3.5 transition-colors group"
                                >
                                    <span className="text-sm font-semibold text-neutral-200">
                                        Detailseite öffnen
                                    </span>
                                    <ArrowRightIcon
                                        size={15}
                                        className="text-neutral-400 group-hover:translate-x-0.5 transition-transform"
                                    />
                                </Link>
                            )}

                            {/* Dates footer */}
                            {!isLoading && (
                                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1">
                                    {createdAt && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-600">
                                            <CalendarIcon size={11} />
                                            <span>Erstellt {formatDate(createdAt)}</span>
                                        </div>
                                    )}
                                    {showModified && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-600">
                                            <ClockIcon size={11} />
                                            <span>Geändert {formatDate(modifiedAt)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}

            <AlertDialog open={confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(false)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangleIcon className="size-4 text-red-400" />
                            Region wirklich löschen?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>{region?.address || "Diese Region"}</strong> wird unwiderruflich entfernt —
                            inklusive aller hochgeladenen Bilder. Diese Aktion lässt sich nicht rückgängig machen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            {isDeleting ? "Wird gelöscht…" : "Endgültig löschen"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AnimatePresence>
    );
}
