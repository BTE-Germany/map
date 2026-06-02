"use client";

import { useEffect, useRef, useState } from "react";
import { RulerIcon, SettingsIcon, CuboidIcon, LockIcon, ShieldIcon } from "lucide-react";
import { usePrivacy } from "@/dataHooks/privacy/usePrivacy";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import useUserSettings, { type AreaUnitMode } from "@/stores/UserSettingsStore";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/* ─── Section registry ──────────────────────────────────────────── */

const SECTIONS = [
    { id: "einheiten", label: "Einheiten", icon: RulerIcon },
    { id: "3d-ansicht", label: "3D-Ansicht", icon: CuboidIcon },
    { id: "datenschutz", label: "Datenschutz", icon: ShieldIcon },
    // Add more sections here as the settings page grows.
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/* ─── Area unit option cards ────────────────────────────────────── */

const AREA_UNIT_OPTIONS: {
    value: AreaUnitMode;
    title: string;
    description: string;
    examples: string[];
}[] = [
        {
            value: "simple",
            title: "Einfach",
            description: "Nur m² und km². Ideal für einen schnellen Überblick.",
            examples: ["850 m²", "0,42 km²"],
        },
        {
            value: "full",
            title: "Vollständig",
            description: "m², ha und km². Zeigt die passende Einheit je nach Größenordnung.",
            examples: ["850 m²", "6,7 ha", "1,20 km²"],
        },
    ];

/* ─── Floating table of contents ───────────────────────────────── */

function TableOfContents({ activeId }: { activeId: SectionId | null }) {
    return (
        <aside className="hidden lg:block w-52 shrink-0">
            <div className="sticky top-24">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-3">
                    Inhalt
                </p>
                <nav className="space-y-0.5">
                    {SECTIONS.map(({ id, label, icon: Icon }) => (
                        <a
                            key={id}
                            href={`#${id}`}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                                activeId === id
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                        >
                            <Icon size={14} className="shrink-0" />
                            {label}
                        </a>
                    ))}
                </nav>
            </div>
        </aside>
    );
}

/* ─── Reusable section wrapper ──────────────────────────────────── */

function SettingsSection({
    id,
    title,
    description,
    icon: Icon,
    children,
}: {
    id: SectionId;
    title: string;
    description: string;
    icon: React.ElementType;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-28">
            <div className="flex items-start gap-3 mb-5">
                <div className="mt-0.5 flex items-center justify-center size-8 rounded-lg bg-primary/10 shrink-0">
                    <Icon size={15} className="text-primary" />
                </div>
                <div>
                    <h2 className="text-base font-semibold">{title}</h2>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </div>
            <div className="sm:pl-11">{children}</div>
        </section>
    );
}

/* ─── Option card ───────────────────────────────────────────────── */

function OptionCard<T extends string>({
    value,
    selected,
    onSelect,
    title,
    description,
    badge,
}: {
    value: T;
    selected: boolean;
    onSelect: (v: T) => void;
    title: string;
    description: string;
    badge?: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={() => onSelect(value)}
            className={cn(
                "relative w-full text-left rounded-xl border px-4 py-3.5 transition-all duration-150",
                selected
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-border/80 hover:bg-accent/40"
            )}
        >
            {/* Radio dot */}
            <span
                className={cn(
                    "absolute right-4 top-4 size-4 rounded-full border-2 transition-colors",
                    selected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                )}
            >
                {selected && (
                    <span className="absolute inset-[3px] rounded-full bg-primary-foreground" />
                )}
            </span>

            <p className="font-semibold text-sm pr-7">{title}</p>
            <p className="text-sm text-muted-foreground mt-0.5 pr-7">{description}</p>
            {badge && <div className="mt-2.5">{badge}</div>}
        </button>
    );
}

/* ─── Toggle row ────────────────────────────────────────────────── */

function ToggleRow({
    label,
    description,
    checked,
    disabled,
    locked,
    onChange,
    badge,
}: {
    label: string;
    description: string;
    checked: boolean;
    disabled?: boolean;
    locked?: boolean;
    onChange: (v: boolean) => void;
    badge?: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                "flex flex-col gap-3 rounded-xl border px-4 py-3.5 transition-colors sm:flex-row sm:items-start sm:gap-4",
                locked
                    ? "border-border/60 bg-muted/30 opacity-70"
                    : "border-border bg-card"
            )}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{label}</p>
                    {badge}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            </div>

            {locked ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div
                            aria-disabled
                            className="relative inline-flex h-6 w-11 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 cursor-not-allowed sm:mt-1"
                        >
                            <div className="p-1 bg-neutral-500/50 rounded-full">
                                <LockIcon className="text-white size-3" />
                            </div>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Plus-Feature</p>
                    </TooltipContent>
                </Tooltip>
            ) : (
                <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    disabled={disabled}
                    onClick={() => !disabled && onChange(!checked)}
                    className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors sm:mt-1",
                        disabled && "opacity-60 cursor-not-allowed",
                        checked ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                >
                    <span
                        className={cn(
                            "inline-block size-5 rounded-full bg-background shadow transition-transform",
                            checked ? "translate-x-5" : "translate-x-0.5"
                        )}
                    />
                </button>
            )}
        </div>
    );
}

/* ─── Example pills ─────────────────────────────────────────────── */

function ExamplePills({ examples }: { examples: string[] }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {examples.map((ex) => (
                <span
                    key={ex}
                    className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground"
                >
                    {ex}
                </span>
            ))}
        </div>
    );
}

/* ─── Main page ─────────────────────────────────────────────────── */

export default function SettingsPage() {
    const { areaUnit, setAreaUnit, show3DMap, setShow3DMap } = useUserSettings();
    const { data: session } = useSession();
    const roles = session?.user.realm_access?.roles ?? [];
    const canUse3D = hasPermission(roles, PERMISSIONS.MAP_3D_VIEW);
    const privacy = usePrivacy();
    const [activeSection, setActiveSection] = useState<SectionId | null>(SECTIONS[0].id);

    /* Scroll-spy via IntersectionObserver */
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observerRef.current?.disconnect();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id as SectionId);
                    }
                }
            },
            { rootMargin: "-30% 0px -60% 0px" }
        );
        SECTIONS.forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        observerRef.current = observer;
        return () => observer.disconnect();
    }, []);

    return (
        <div className="container mx-auto px-4 md:px-0">
            {/* Page header */}
            <div className="mb-8 flex items-start gap-3 sm:items-center">
                <SettingsIcon size={20} className="text-muted-foreground" />
                <div>
                    <h1 className="text-xl font-bold">Einstellungen</h1>
                    <p className="text-sm text-muted-foreground">
                        Passe die Darstellung und das Verhalten der Karte an.
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
                <TableOfContents activeId={activeSection} />

                {/* Settings content */}
                <div className="flex-1 min-w-0 space-y-12">
                    {/* ── Einheiten ───────────────────────────────── */}
                    <SettingsSection
                        id="einheiten"
                        title="Einheiten"
                        description="Lege fest, in welcher Einheit Flächen angezeigt werden."
                        icon={RulerIcon}
                    >
                        <div className="space-y-2.5">
                            {AREA_UNIT_OPTIONS.map((opt) => (
                                <OptionCard
                                    key={opt.value}
                                    value={opt.value}
                                    selected={areaUnit === opt.value}
                                    onSelect={setAreaUnit}
                                    title={opt.title}
                                    description={opt.description}
                                    badge={<ExamplePills examples={opt.examples} />}
                                />
                            ))}
                        </div>
                    </SettingsSection>

                    {/* ── 3D-Ansicht ──────────────────────────────── */}
                    <SettingsSection
                        id="3d-ansicht"
                        title="3D-Ansicht"
                        description="Zeige zu jeder Region eine fotorealistische 3D-Karte von Google."
                        icon={CuboidIcon}
                    >
                        <ToggleRow
                            label="3D-Karte in der Region-Ansicht anzeigen"
                            description={
                                canUse3D
                                    ? "Lädt eine 3D-Karte mit dem Region-Polygon in jeder Detail-/Seitenansicht."
                                    : "Dieses Feature ist nur mit dem Plus-Rang verfügbar."
                            }
                            checked={canUse3D && show3DMap}
                            locked={!canUse3D}
                            onChange={setShow3DMap}
                            badge={
                                <span
                                    className={cn(
                                        "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                                        canUse3D
                                            ? "text-amber-500 bg-amber-500/15"
                                            : "text-muted-foreground bg-muted"
                                    )}
                                >
                                    {!canUse3D && <LockIcon size={9} />}
                                    Plus
                                </span>
                            }
                        />
                    </SettingsSection>

                    {/* ── Datenschutz ─────────────────────────────── */}
                    <SettingsSection
                        id="datenschutz"
                        title="Datenschutz"
                        description="Lege fest, welche Daten andere Spieler von dir auf der Karte sehen können."
                        icon={ShieldIcon}
                    >
                        <ToggleRow
                            label="Eigene Position auf der Karte verbergen"
                            description="Wenn aktiviert, wird dein Avatar nicht mehr live auf der Karte angezeigt — sinnvoll z. B. wenn du deinen Wohnort baust."
                            checked={!!privacy.data?.hideOnMap}
                            disabled={privacy.isLoading || privacy.isUpdating}
                            onChange={(v) => privacy.setHideOnMap(v)}
                        />
                    </SettingsSection>

                    {/* Future sections slot ── add more <SettingsSection> blocks here */}
                </div>
            </div>
        </div>
    );
}
