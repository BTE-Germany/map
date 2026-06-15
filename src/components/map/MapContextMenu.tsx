"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, LockIcon, MapPin, NavigationIcon, PersonStanding } from "lucide-react";
import { teleportToCoordinates } from "@/actions/teleport/Teleport";
import useStreetLevelStore from "@/stores/StreetLevelStore";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

interface MenuState {
    lng: number;
    lat: number;
    screenX: number;
    screenY: number;
}

function formatCoord(value: number): string {
    return value.toFixed(6);
}

export default function MapContextMenu() {
    const { mainMap: map } = useMap();
    const session = useSession();
    const hasMcLink = !!session.data?.user?.minecraft_uuid;
    const roles = session.data?.user?.realm_access?.roles ?? [];
    const canUseStreetLevel = hasPermission(roles, PERMISSIONS.MAP_STREET_LEVEL_VIEW);

    const [menu, setMenu] = useState<MenuState | null>(null);
    const [isTeleporting, setIsTeleporting] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const openStreetLevel = useStreetLevelStore((state) => state.openAt);

    useEffect(() => {
        if (!map) return;

        const open = (e: any) => {
            e.preventDefault?.();
            const { x: screenX, y: screenY } = e.point;
            setMenu({
                lng: e.lngLat.lng,
                lat: e.lngLat.lat,
                screenX,
                screenY,
            });
        };

        const close = () => setMenu(null);

        map.on("contextmenu", open);
        map.on("movestart", close);
        map.on("zoomstart", close);

        return () => {
            map.off("contextmenu", open);
            map.off("movestart", close);
            map.off("zoomstart", close);
        };
    }, [map]);

    useEffect(() => {
        if (!menu) return;

        const handleClick = (event: MouseEvent) => {
            if (menuRef.current?.contains(event.target as Node)) return;
            setMenu(null);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenu(null);
        };

        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [menu]);

    if (!menu) return null;

    const { lat, lng } = menu;
    const formatted = `${formatCoord(lat)}, ${formatCoord(lng)}`;

    const handleTeleport = async () => {
        if (!hasMcLink) return;
        setIsTeleporting(true);
        try {
            await teleportToCoordinates(lat, lng);
            toast.success("Teleport-Anfrage gesendet.");
            setMenu(null);
        } catch (e: any) {
            toast.error(e?.message ?? "Teleport fehlgeschlagen");
        } finally {
            setIsTeleporting(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(formatted);
            toast.success("Koordinaten kopiert.");
        } catch {
            toast.error("Konnte Koordinaten nicht kopieren.");
        }
        setMenu(null);
    };

    const openExternal = (url: string) => {
        window.open(url, "_blank", "noopener,noreferrer");
        setMenu(null);
    };

    const gmaps = `https://www.google.com/maps?q=${lat},${lng}`;
    const amaps = `https://maps.apple.com/?q=${lat},${lng}`;
    const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

    return (
        <div
            ref={menuRef}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute z-50 min-w-[240px] rounded-xl bg-neutral-950/90 backdrop-blur-xl border border-white/[0.07] shadow-2xl overflow-hidden text-sm"
            style={{ left: menu.screenX, top: menu.screenY }}
        >
            <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2 text-neutral-400">
                <MapPin size={13} />
                <span className="tabular-nums text-[11px]">{formatted}</span>
            </div>

            <button
                onClick={handleTeleport}
                disabled={!hasMcLink || isTeleporting}
                title={hasMcLink ? undefined : "Minecraft-Account erforderlich"}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-emerald-500/10 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
                {isTeleporting ? (
                    <Loader2 size={14} className="animate-spin text-emerald-400" />
                ) : (
                    <NavigationIcon size={14} className="text-emerald-400" />
                )}
                <span className="text-neutral-200">Zu dieser Stelle teleportieren</span>
            </button>

            <button
                onClick={handleCopy}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
            >
                <Copy size={14} className="text-neutral-400" />
                <span className="text-neutral-200">Koordinaten kopieren</span>
            </button>

            <button
                onClick={() => {
                    if (!canUseStreetLevel) return;
                    openStreetLevel({ lat, lng });
                    setMenu(null);
                }}
                disabled={!canUseStreetLevel}
                title={canUseStreetLevel ? undefined : "Plus-Rang erforderlich"}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-blue-500/10 transition-colors text-left disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
                {canUseStreetLevel ? (
                    <PersonStanding size={14} className="text-blue-400" />
                ) : (
                    <LockIcon size={14} className="text-neutral-500" />
                )}
                <span className="text-neutral-200">
                    Street View / Look Around{canUseStreetLevel ? "" : " (Plus)"}
                </span>
            </button>

            <div className="border-t border-white/[0.06]">
                <button
                    onClick={() => openExternal(gmaps)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
                >
                    <ExternalLink size={14} className="text-neutral-400" />
                    <span className="text-neutral-200">In Google Maps öffnen</span>
                </button>
                <button
                    onClick={() => openExternal(amaps)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
                >
                    <ExternalLink size={14} className="text-neutral-400" />
                    <span className="text-neutral-200">In Apple Maps öffnen</span>
                </button>
                <button
                    onClick={() => openExternal(osm)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
                >
                    <ExternalLink size={14} className="text-neutral-400" />
                    <span className="text-neutral-200">In OpenStreetMap öffnen</span>
                </button>
            </div>
        </div>
    );
}
