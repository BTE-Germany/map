import { useMap } from "@vis.gl/react-maplibre";
import { EyeIcon, EyeOffIcon, InfoIcon, LockIcon, MapIcon, MinusIcon, PersonStanding, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

import defaultImage from "@/components/map/assets/default.png"
import hybridImage from "@/components/map/assets/hybrid.png"
import satelliteImage from "@/components/map/assets/satellite.png"

import Image from "next/image";
import { cn } from "@/lib/utils";
import useMapStyleStore from "@/stores/MapStyleStore";
import useMapOverlayStore from "@/stores/MapOverlayStore";
import {
    getMapAttributionsById,
    getMapStyleFamily,
    getMapStyleVariants,
    PRIMARY_MAP_STYLES,
    type PrimaryMapStyleId,
} from "@/lib/mapStyles";
import type { StaticImageData } from "next/image";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useSession } from "next-auth/react";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import useStreetLevelStore from "@/stores/StreetLevelStore";

const stylePreviewImages: Record<PrimaryMapStyleId, StaticImageData> = {
    default: defaultImage,
    hybrid: hybridImage,
    satellite: satelliteImage
};

/** Mapbox-backed styles send request data to a third party and need Plus. */
const isPlusStyle = (styleId: PrimaryMapStyleId) => styleId === "hybrid" || styleId === "satellite";

export default function MapControls() {
    const { mainMap: map } = useMap();
    const styleId = useMapStyleStore((state) => state.styleId);
    const setStyleId = useMapStyleStore((state) => state.setStyleId);
    const hidePlayers = useMapOverlayStore((state) => state.hidePlayers);
    const togglePlayers = useMapOverlayStore((state) => state.togglePlayers);
    const styleAttributions = getMapAttributionsById(styleId);
    // A variant (e.g. monochrome) keeps its parent's tile selected in the grid
    // and is picked from the smaller control underneath it.
    const activeFamily = getMapStyleFamily(styleId);
    const familyVariants = getMapStyleVariants(activeFamily);
    const isSelectingStreetLevel = useStreetLevelStore((state) => state.isSelecting);
    const startSelectingStreetLevel = useStreetLevelStore((state) => state.startSelecting);
    const cancelSelectingStreetLevel = useStreetLevelStore((state) => state.cancelSelecting);

    const [mapHeading, setMapHeading] = useState<number>(0);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStartX, setDragStartX] = useState<number>(0);
    const [dragStartBearing, setDragStartBearing] = useState<number>(0);

    const session = useSession()

    const roles = session.data?.user?.realm_access?.roles ?? [];
    const canChangeStyle = hasPermission(roles, PERMISSIONS.MAP_STYLES);
    const canUseStreetLevel = hasPermission(roles, PERMISSIONS.MAP_STREET_LEVEL_VIEW);

    useEffect(() => {
        if (!map) return;

        const updateHeading = () => {
            setMapHeading(map.getBearing());
        };

        map.on('rotate', updateHeading);
        map.on('load', updateHeading);

        return () => {
            map.off('rotate', updateHeading);
            map.off('load', updateHeading);
        };
    }, [map]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!map) return;

        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartBearing(map.getBearing());

        // Prevent the click event from firing immediately
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !map) return;

        const deltaX = e.clientX - dragStartX;
        const sensitivity = 0.5; // Adjust rotation sensitivity
        const newBearing = dragStartBearing + (deltaX * sensitivity);

        map.setBearing(newBearing);
    };

    const handleMouseUp = (e: MouseEvent) => {
        if (!isDragging) return;

        setIsDragging(false);

        // If the mouse hasn't moved much, treat it as a click to reset bearing
        const deltaX = Math.abs(e.clientX - dragStartX);
        if (deltaX < 5 && map) {
            map.setBearing(0);
        }
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStartX, dragStartBearing, map]);

    if (!map) {
        return null;
    }

    return (
        // This column is as wide as the attribution line below it — ~300px,
        // which on a phone is most of the screen width and nearly a third of
        // its height. Almost all of that is empty space between the button
        // stacks, so the frame stays transparent to pointer events and only
        // the visible chrome opts back in.
        <div className={"absolute bottom-0 right-0 z-40 m-4 flex flex-col gap-2 items-end text-xs text-neutral-400 pointer-events-none"}>
            <div
                className={"rounded-xl overflow-hidden flex flex-col divide-y divide-neutral-600/30 text-foreground bg-neutral-950/30 backdrop-blur-xl pointer-events-auto"}>
                <Popover >
                    <PopoverTrigger asChild>
                        <div className={" p-2 hover:bg-neutral-950/60 transition-colors group"}>
                            <MapIcon className={"group-active:scale-[95%] transition-transform [animation-duration:0.1s] "} />
                        </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 bg-card/60 backdrop-blur-2xl" side="left" sideOffset={20}>
                        <div className="grid grid-cols-3 gap-4">
                            {PRIMARY_MAP_STYLES.map((style) => {
                                const locked = isPlusStyle(style.id) && !canChangeStyle;

                                return (
                                    <button
                                        type="button"
                                        key={style.id}
                                        className={cn("flex flex-col justify-center items-center cursor-pointer active:ring-0 focus:outline-none relative", {
                                            "cursor-not-allowed opacity-50": locked
                                        })}
                                        // Re-clicking the active tile must not silently drop the
                                        // chosen variant — that's what the control below is for.
                                        onClick={() => {
                                            if (style.id !== activeFamily) setStyleId(style.id);
                                        }}
                                        disabled={locked}
                                    >

                                        <div className="relative mb-2">

                                            {
                                                locked ? (
                                                    <div className="absolute w-full h-full bg-black/50 rounded-lg flex items-center justify-center flex-col">
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <div className="p-2 bg-neutral-500/50 rounded-full">
                                                                    <LockIcon className="text-white size-4" />
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Plus-Feature</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                ) : null
                                            }
                                            <Image
                                                src={stylePreviewImages[style.id]}
                                                alt={style.label}
                                                className={cn("w-full  rounded-lg border-2 border-transparent transition-colors", {
                                                    "border-blue-500": style.id === activeFamily
                                                })}
                                            />
                                        </div>

                                        <p className="text-sm text-muted-foreground">{style.label}</p>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Looks available within the selected map — only rendered
                            for families that actually have more than one. */}
                        {familyVariants.length > 1 && (
                            <div className="mt-4 flex gap-1 rounded-lg bg-neutral-950/40 p-1">
                                {familyVariants.map((variant) => (
                                    <button
                                        type="button"
                                        key={variant.id}
                                        onClick={() => setStyleId(variant.id)}
                                        aria-pressed={variant.id === styleId}
                                        className={cn(
                                            "flex-1 cursor-pointer rounded-md px-2 py-1.5 text-xs transition-colors focus:outline-none",
                                            variant.id === styleId
                                                ? "bg-neutral-100/10 text-foreground"
                                                : "text-muted-foreground hover:text-foreground hover:bg-neutral-100/5",
                                        )}
                                    >
                                        {variant.variantLabel ?? variant.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center mt-4 text-xs text-muted-foreground">
                            <InfoIcon className="inline-block mr-2" /> Bei der Hybrid- und Satellitenansicht werden Daten an Mapbox gesendet.
                        </div>
                    </PopoverContent>
                </Popover>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={togglePlayers}
                            className="p-2 hover:bg-neutral-950/60 transition-colors group cursor-pointer"
                        >
                            {hidePlayers ? (
                                <EyeOffIcon className="group-active:scale-[95%] transition-transform [animation-duration:0.1s]" />
                            ) : (
                                <EyeIcon className="group-active:scale-[95%] transition-transform [animation-duration:0.1s]" />
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <p>{hidePlayers ? "Spieler einblenden" : "Spieler ausblenden"}</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={isSelectingStreetLevel ? cancelSelectingStreetLevel : startSelectingStreetLevel}
                            disabled={!canUseStreetLevel}
                            className={cn(
                                "p-2 transition-colors group cursor-pointer",
                                isSelectingStreetLevel
                                    ? "bg-blue-500/25 text-blue-200 hover:bg-blue-500/35"
                                    : "hover:bg-neutral-950/60",
                                !canUseStreetLevel && "cursor-not-allowed opacity-50 hover:bg-transparent",
                            )}
                            aria-pressed={isSelectingStreetLevel}
                        >
                            {canUseStreetLevel ? (
                                <PersonStanding className="group-active:scale-[95%] transition-transform [animation-duration:0.1s]" />
                            ) : (
                                <LockIcon />
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <p>
                            {!canUseStreetLevel
                                ? "Street View / Look Around - Plus-Feature"
                                : isSelectingStreetLevel
                                    ? "Standortauswahl abbrechen"
                                    : "Street View / Look Around"}
                        </p>
                    </TooltipContent>
                </Tooltip>

            </div>
            <div
                className={"rounded-xl overflow-hidden flex flex-col divide-y divide-neutral-600/30 text-foreground bg-neutral-950/30 backdrop-blur-xl pointer-events-auto"}>

                <div className={" p-2 hover:bg-neutral-950/60 transition-colors group"}
                    onMouseDown={handleMouseDown}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
                    <div
                        className={"group-active:scale-[95%] transition-transform [animation-duration:0.1s] relative flex items-center justify-center size-6 p-1"}>
                        <div className={"w-full h-full border-2 border-foreground rounded-full"}></div>
                        <div className={"absolute top-0 left-1/2 -translate-x-1/2"} style={{
                            transform: `rotate(${-mapHeading}deg)`,
                            transition: isDragging ? "none" : "transform 0.1s",
                            transformOrigin: "50% 12px"
                        }}>
                            <div
                                className={"w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-6 border-b-red-500"}></div>
                        </div>
                    </div>
                </div>

                <div className={" p-2 hover:bg-neutral-950/60 transition-colors group"} onClick={() => map?.zoomIn()}>
                    <PlusIcon className={"group-active:scale-[95%] transition-transform [animation-duration:0.1s]"} />
                </div>

                <div className={" p-2 hover:bg-neutral-950/60 transition-colors group"}>
                    <MinusIcon className={"group-active:scale-[95%] transition-transform [animation-duration:0.1s]"}
                        onClick={() => map?.zoomOut()} />
                </div>
            </div>

            <div className={"rounded-xl overflow-hidden text-neutral-400 bg-neutral-950/30 backdrop-blur-xl px-2 py-1 pointer-events-auto"}>
                <span>
                    {styleAttributions.map((attribution, index) => (
                        <a
                            key={attribution.href}
                            href={attribution.href}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-neutral-200 transition-colors"
                        >
                            {index > 0 ? " | " : ""}
                            {attribution.label}
                        </a>
                    ))}
                </span>
            </div>
        </div>
    )
}
