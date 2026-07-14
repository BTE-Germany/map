import { notFound } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeftIcon,
    HouseIcon,
    LandPlotIcon,
    MapPinIcon,
    CalendarIcon,
    ClockIcon,
    CheckCircle2Icon,
    LayersIcon,
    ExternalLinkIcon,
    SparklesIcon,
} from "lucide-react";
import { getRegion } from "@/actions/region/GetRegions";
import getUser from "@/actions/minecraft/user";
import { getSession } from "@/lib/auth";
import { stateCodeToName } from "@/lib/federalStates";
import { formatAreaWithMode } from "@/stores/UserSettingsStore";
import { FloatingNavigationBar } from "@/components/common/NavigationBar";
import RegionMiniMapWrapper from "@/components/map/region/RegionMiniMapWrapper";
import RegionEditDialog from "@/components/map/region/RegionEditDialog";
import BuilderAvatarStack from "@/components/region/BuilderAvatarStack";
import RegionImageGallery from "@/components/map/region/RegionImageGallery";
import Region3DMapGated from "@/components/map/region/Region3DMapGated";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import SanitizedHtml, { htmlToPlainText } from "@/components/common/SanitizedHtml";
import type { LandUseStats } from "@/db/schema";
import { scoreRegion } from "@/lib/scoring";

/* ─── helpers ─────────────────────────────────────────────────── */

function formatDate(d: Date | string | null | undefined) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

const LANDUSE_CONFIG: { key: keyof LandUseStats; label: string; color: string }[] = [
    { key: "residential", label: "Wohngebiet",     color: "#f97316" },
    { key: "forest",      label: "Wald",           color: "#16a34a" },
    { key: "farmland",    label: "Landwirtschaft", color: "#a3e635" },
    { key: "water",       label: "Wasser",         color: "#3b82f6" },
    { key: "industrial",  label: "Gewerbe",        color: "#94a3b8" },
    { key: "park",        label: "Park / Grün",    color: "#4ade80" },
];

const TYPE_LABELS: Record<string, string> = {
    default: "Standard",
    plot:    "Plot",
    event:   "Event",
};

/* ─── Server component ────────────────────────────────────────── */

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const region = await getRegion(id);
    if (!region) return { title: "Region nicht gefunden — BTE Germany" };
    // Descriptions may contain HTML; use plain text for the meta tag.
    const plainDescription = htmlToPlainText(region.description);
    return {
        title: `${region.address} — BTE Germany`,
        description: plainDescription || `Region in ${region.city}`,
    };
}

export default async function RegionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // region + session don't depend on each other — fetch concurrently.
    const [region, session] = await Promise.all([getRegion(id), getSession()]);
    if (!region) notFound();

    // Creator + all builder profiles resolve concurrently (and getUser is cached).
    const [owner, builderProfilesRaw] = await Promise.all([
        getUser(region.creatorUUID),
        Promise.all((region.builders ?? []).map((uuid) => getUser(uuid))),
    ]);
    const builderProfiles = builderProfilesRaw.filter((p): p is NonNullable<typeof p> => p !== null);

    const isCreator = session?.user?.minecraft_uuid === region.creatorUUID;
    const roles = session?.user?.realm_access?.roles ?? [];
    const canUpload = isCreator || hasPermission(roles, PERMISSIONS.REGIONS_EDIT);

    const area = parseFloat(region.area ?? "0");
    const formattedArea = formatAreaWithMode(area, "full");
    const regionScore = scoreRegion(region);
    const locationParts = [region.city, region.state ? stateCodeToName(region.state) : null].filter(Boolean);

    /* landuse */
    const landuse = region.landuse as LandUseStats | null | undefined;
    const landuseData = landuse
        ? LANDUSE_CONFIG.map((cfg) => ({ ...cfg, value: landuse[cfg.key] })).filter((d) => d.value > 0)
        : [];
    const categorizedSum = landuseData.reduce((s, d) => s + d.value, 0);
    const otherArea = Math.max(0, area - categorizedSum);
    const allLanduse = [
        ...landuseData,
        ...(otherArea > 1 ? [{ key: "other", label: "Sonstiges", color: "#3f3f46", value: otherArea }] : []),
    ];
    const totalLanduse = allLanduse.reduce((s, d) => s + d.value, 0);

    const createdAt = region.createdAt ? new Date(region.createdAt) : null;
    const modifiedAt = region.modifiedAt ? new Date(region.modifiedAt) : null;
    const showModified =
        modifiedAt && createdAt && Math.abs(modifiedAt.getTime() - createdAt.getTime()) > 60_000;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <FloatingNavigationBar collapsable={false} />

            {/* ── Hero ─────────────────────────────────────────── */}
            <div className="relative min-h-[480px] overflow-hidden">
                {/* Embedded map as faded background on mobile / small screens */}
                <div className="absolute inset-0 lg:hidden opacity-20 pointer-events-none">
                    <RegionMiniMapWrapper polygon={region.polygon as [number, number][]} finished={region.finished} />
                </div>
                {/* gradient mask over the background map */}
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent lg:hidden" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

                <div className="relative container mx-auto px-4 pt-32 pb-16 flex flex-col lg:flex-row gap-12 items-start lg:items-end">
                    {/* Left: text content */}
                    <div className="flex-1 min-w-0">
                        {/* Back link */}
                        <Link
                            href={`/?region=${id}`}
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
                        >
                            <ArrowLeftIcon size={13} />
                            Auf der Karte anzeigen
                        </Link>

                        {/* Type + status badges */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full">
                                {TYPE_LABELS[region.type] ?? "Region"}
                            </span>
                            {region.finished ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                                    <CheckCircle2Icon size={10} />
                                    Fertiggestellt
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                                    <ClockIcon size={10} />
                                    In Arbeit
                                </span>
                            )}
                        </div>

                        {/* Title */}
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-white mb-3">
                            {region.address}
                        </h1>

                        {/* Location */}
                        {locationParts.length > 0 && (
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-6">
                                <MapPinIcon size={14} className="shrink-0" />
                                <span className="text-sm">{locationParts.join(", ")}</span>
                            </div>
                        )}

                        {/* Build team — hidden for plot/event */}
                        {owner && region.type === "default" && (
                            <BuilderAvatarStack owner={owner} builders={builderProfiles} />
                        )}

                        {isCreator && (
                            <div className="mt-4">
                                <RegionEditDialog
                                    regionId={id}
                                    initialDescription={region.description ?? ""}
                                    initialFinished={region.finished}
                                    initialBuilders={region.builders ?? []}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right: embedded map card */}
                    <div className="hidden lg:block w-[420px] shrink-0">
                        <div className="w-full rounded-2xl border border-white/10 shadow-2xl overflow-hidden" style={{ aspectRatio: "8/5" }}>
                            <RegionMiniMapWrapper polygon={region.polygon as [number, number][]} finished={region.finished} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Content ──────────────────────────────────────── */}
            <div className="container mx-auto px-4 pb-20">

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
                    <StatCard icon={<HouseIcon size={14} />} label="Gebäude">
                        <span className="text-2xl font-bold">
                            {region.buildings?.toLocaleString("de-DE") ?? "–"}
                        </span>
                    </StatCard>

                    <StatCard icon={<LandPlotIcon size={14} />} label="Fläche">
                        <span className="text-2xl font-bold">
                            {formattedArea.value}
                            <span className="text-sm text-muted-foreground ml-1">{formattedArea.unit}</span>
                        </span>
                    </StatCard>

                    <StatCard icon={<SparklesIcon size={14} />} label="Punkte">
                        <div>
                            <span className="text-2xl font-bold tabular-nums">
                                {Math.round(regionScore.total).toLocaleString("de-DE")}
                            </span>
                            {regionScore.team.length > 1 ? (
                                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                                    {Math.round(regionScore.perBuilder).toLocaleString("de-DE")} je Builder
                                </p>
                            ) : null}
                        </div>
                    </StatCard>

                    <StatCard icon={<CalendarIcon size={14} />} label="Erstellt">
                        <span className="text-sm font-semibold">{formatDate(createdAt) ?? "–"}</span>
                    </StatCard>

                    <StatCard icon={<ClockIcon size={14} />} label="Zuletzt geändert">
                        <span className="text-sm font-semibold">
                            {showModified ? formatDate(modifiedAt) : (formatDate(createdAt) ?? "–")}
                        </span>
                    </StatCard>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main column */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Images */}
                        <RegionImageGallery regionId={id} canUpload={canUpload} />

                        {/* 3D-Ansicht (Plus) */}
                        <Region3DMapGated polygon={region.polygon as [number, number][]} />

                        {/* Description (may contain migrated HTML — rendered sanitized) */}
                        {region.description && (
                            <ContentCard title="Beschreibung">
                                <SanitizedHtml
                                    html={region.description}
                                    className="text-sm text-muted-foreground leading-relaxed"
                                />
                            </ContentCard>
                        )}

                        {/* Landuse */}
                        {allLanduse.length > 0 && totalLanduse > 0 && (
                            <ContentCard
                                title="Flächennutzung"
                                icon={<LayersIcon size={14} />}
                            >
                                {/* Stacked bar */}
                                <div
                                    className="h-3 w-full rounded-full overflow-hidden flex mb-5"
                                    style={{ gap: "1px" }}
                                >
                                    {allLanduse.map((d) => {
                                        const pct = (d.value / totalLanduse) * 100;
                                        return (
                                            <div
                                                key={d.key}
                                                title={`${d.label}: ${pct.toFixed(1)}%`}
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: d.color,
                                                    flexShrink: 0,
                                                }}
                                            />
                                        );
                                    })}
                                </div>

                                {/* Breakdown grid */}
                                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                                    {allLanduse.map((d) => {
                                        const pct = (d.value / totalLanduse) * 100;
                                        const formatted = formatAreaWithMode(d.value, "full");
                                        return (
                                            <div key={d.key} className="flex items-center gap-3">
                                                <span
                                                    className="size-3 rounded shrink-0"
                                                    style={{ backgroundColor: d.color }}
                                                />
                                                <span className="flex-1 text-sm text-muted-foreground truncate">
                                                    {d.label}
                                                </span>
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {formatted.value} {formatted.unit}
                                                </span>
                                                <span className="text-sm font-semibold tabular-nums w-12 text-right">
                                                    {pct.toFixed(1)}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ContentCard>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Details */}
                        <ContentCard title="Details">
                            <dl className="space-y-3">
                                <Detail label="Typ" value={TYPE_LABELS[region.type] ?? region.type} />
                                <Detail
                                    label="Status"
                                    value={region.finished ? "Fertiggestellt" : "In Arbeit"}
                                />
                                {region.city && <Detail label="Stadt" value={region.city} />}
                                {region.state && (
                                    <Detail label="Bundesland" value={stateCodeToName(region.state)} />
                                )}
                                <Detail label="Gebäude" value={(region.buildings ?? 0).toLocaleString("de-DE")} />
                                <Detail
                                    label="Fläche"
                                    value={`${formattedArea.value} ${formattedArea.unit}`}
                                />
                                {createdAt && (
                                    <Detail label="Erstellt am" value={formatDate(createdAt)!} />
                                )}
                                {showModified && (
                                    <Detail label="Geändert am" value={formatDate(modifiedAt)!} />
                                )}
                            </dl>
                        </ContentCard>

                        {/* Quick actions */}
                        <ContentCard title="Aktionen">
                            <Link
                                href={`/?region=${id}`}
                                className="flex items-center justify-between w-full rounded-xl px-4 py-3 bg-primary/10 hover:bg-primary/15 text-primary text-sm font-semibold transition-colors"
                            >
                                <span>Auf der Karte öffnen</span>
                                <ExternalLinkIcon size={14} />
                            </Link>
                        </ContentCard>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function StatCard({
    icon,
    label,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                {icon}
                <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
            </div>
            {children}
        </div>
    );
}

function ContentCard({
    title,
    icon,
    children,
}: {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-border bg-card px-6 py-5">
            <div className="flex items-center gap-2 mb-4">
                {icon && <span className="text-muted-foreground">{icon}</span>}
                <h2 className="font-semibold text-sm">{title}</h2>
            </div>
            {children}
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
            <dd className="text-sm font-medium text-right">{value}</dd>
        </div>
    );
}
