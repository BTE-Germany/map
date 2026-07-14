"use client"

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MapPinIcon, LandmarkIcon, Loader2 } from "lucide-react";

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import useSearchStore from "@/stores/SearchStore";
import useRegionPane from "@/stores/RegionPaneStore";
import { useRegionsForSearch } from "@/dataHooks/regions/useAllRegions";
import { usePhotonSearch, formatPhotonLabel, type PhotonFeature } from "@/dataHooks/search/usePhotonSearch";
import { stateCodeToName } from "@/lib/federalStates";

type Region = {
    id: string;
    city: string;
    state: string;
    address: string;
    description: string | null;
    type: string;
    finished: boolean;
};

function useDebounced<T>(value: T, delay = 250): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const h = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(h);
    }, [value, delay]);
    return debounced;
}

function scoreRegion(region: Region, needle: string): number {
    const q = needle.toLowerCase();
    const address = (region.address ?? "").toLowerCase();
    const city = (region.city ?? "").toLowerCase();
    const description = (region.description ?? "").toLowerCase();
    const state = stateCodeToName(region.state ?? "").toLowerCase();

    if (address.startsWith(q)) return 100;
    if (city.startsWith(q)) return 90;
    if (address.includes(q)) return 70;
    if (city.includes(q)) return 60;
    if (state.includes(q)) return 40;
    if (description.includes(q)) return 30;
    return 0;
}

export default function SearchDialog() {
    const pathname = usePathname();
    const router = useRouter();
    const open = useSearchStore((s) => s.open);
    const setOpen = useSearchStore((s) => s.setOpen);
    const setMapTarget = useSearchStore((s) => s.setMapTarget);
    const clearMapTarget = useSearchStore((s) => s.clearMapTarget);
    const openRegion = useRegionPane((s) => s.openRegion);
    const setRegionPaneOpen = useRegionPane((s) => s.setOpen);

    const [query, setQuery] = useState("");
    const debouncedQuery = useDebounced(query, 250);

    const { data: regions } = useRegionsForSearch(open);
    const { data: photonResults, isFetching: isPhotonLoading } = usePhotonSearch(debouncedQuery, open);

    // Reset query when dialog closes
    useEffect(() => {
        if (!open) {
            const t = setTimeout(() => setQuery(""), 150);
            return () => clearTimeout(t);
        }
    }, [open]);

    const filteredRegions = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle || !regions) return [] as Region[];
        return (regions as unknown as Region[])
            .map((r) => ({ region: r, score: scoreRegion(r, needle) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
            .map((x) => x.region);
    }, [query, regions]);

    const handleSelectRegion = (region: Region) => {
        clearMapTarget();
        setOpen(false);

        if (pathname === "/") {
            openRegion(region.id);
            return;
        }

        router.push(`/?region=${encodeURIComponent(region.id)}`);
    };

    const handleSelectPhoton = (feature: PhotonFeature) => {
        const [lon, lat] = feature.geometry.coordinates;
        setRegionPaneOpen(false);
        setMapTarget({
            longitude: lon,
            latitude: lat,
            zoom: 14,
        });
        setOpen(false);

        if (pathname !== "/") {
            router.push("/");
        }
    };

    return (
        <CommandDialog
            open={open}
            onOpenChange={setOpen}
            title="Suche"
            description="Suche nach Regionen oder Orten"
            className="sm:max-w-2xl"
            showCloseButton={false}
        >
            <CommandInput
                placeholder="Nach Regionen, Städten oder Adressen suchen..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList className="max-h-[480px]">
                {query.trim().length === 0 && (
                    <div className="py-10 text-center text-sm text-neutral-500">
                        Tippe, um zu suchen
                    </div>
                )}

                {query.trim().length > 0 && (
                    <CommandEmpty>
                        {isPhotonLoading && filteredRegions.length === 0 ? (
                            <span className="inline-flex items-center gap-2 text-neutral-500">
                                <Loader2 className="size-4 animate-spin" />
                                Suche läuft...
                            </span>
                        ) : (
                            "Keine Ergebnisse gefunden."
                        )}
                    </CommandEmpty>
                )}

                {filteredRegions.length > 0 && (
                    <CommandGroup heading="Regionen">
                        {filteredRegions.map((region) => (
                            <CommandItem
                                key={`region-${region.id}`}
                                value={`region-${region.id}-${region.address}-${region.city}`}
                                onSelect={() => handleSelectRegion(region)}
                                className="cursor-pointer"
                            >
                                <LandmarkIcon className="text-sky-400" />
                                <div className="flex flex-col min-w-0">
                                    <span className="truncate text-sm font-medium">
                                        {region.address || region.city || "Region"}
                                    </span>
                                    <span className="truncate text-xs text-neutral-500">
                                        {[region.city, region.state ? stateCodeToName(region.state) : null]
                                            .filter(Boolean)
                                            .join(", ")}
                                    </span>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {filteredRegions.length > 0 && (photonResults?.length ?? 0) > 0 && (
                    <CommandSeparator />
                )}

                {(photonResults?.length ?? 0) > 0 && (
                    <CommandGroup heading="Orte">
                        {photonResults!.map((feature, idx) => {
                            const key = `${feature.properties.osm_type ?? "x"}-${feature.properties.osm_id ?? idx}-${idx}`;
                            const primary =
                                feature.properties.name ??
                                [feature.properties.street, feature.properties.housenumber]
                                    .filter(Boolean)
                                    .join(" ") ??
                                "Ort";
                            const secondary = formatPhotonLabel(feature);
                            return (
                                <CommandItem
                                    key={key}
                                    value={`photon-${key}-${secondary}`}
                                    onSelect={() => handleSelectPhoton(feature)}
                                    className="cursor-pointer"
                                >
                                    <MapPinIcon className="text-emerald-400" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="truncate text-sm font-medium">{primary}</span>
                                        <span className="truncate text-xs text-neutral-500">
                                            {secondary}
                                        </span>
                                    </div>
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                )}
            </CommandList>
        </CommandDialog>
    );
}
