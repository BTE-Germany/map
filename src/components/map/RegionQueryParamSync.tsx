"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useRegionPane from "@/stores/RegionPaneStore";

/**
 * Two-way bind between the {@code ?region=<id>} query param and the
 * RegionPane store. Lets users deep-link to a specific region and keeps the
 * URL shareable while they pan around.
 */
export default function RegionQueryParamSync() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const open = useRegionPane((s) => s.open);
    const regionId = useRegionPane((s) => s.region);
    const openRegion = useRegionPane((s) => s.openRegion);

    const lastSyncedFromUrl = useRef<string | null>(null);
    const lastSyncedToUrl = useRef<string | null>(null);

    // URL → store
    useEffect(() => {
        const param = searchParams.get("region");
        if (!param) {
            lastSyncedFromUrl.current = null;
            return;
        }
        if (param === lastSyncedFromUrl.current) return;
        lastSyncedFromUrl.current = param;
        if (param !== regionId || !open) {
            openRegion(param);
        }
    }, [searchParams, regionId, open, openRegion]);

    // Store → URL
    useEffect(() => {
        const current = searchParams.get("region");
        const desired = open && regionId ? String(regionId) : null;

        if (current === desired) return;
        if (desired === lastSyncedToUrl.current && current === lastSyncedToUrl.current) return;
        lastSyncedToUrl.current = desired;

        const next = new URLSearchParams(searchParams.toString());
        if (desired) next.set("region", desired);
        else next.delete("region");

        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [open, regionId, pathname, router, searchParams]);

    return null;
}
