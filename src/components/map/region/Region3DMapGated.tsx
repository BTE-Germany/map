"use client";

import { useSession } from "next-auth/react";
import useUserSettings from "@/stores/UserSettingsStore";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import Region3DMap from "@/components/map/region/Region3DMap";

/**
 * Client wrapper that only renders <Region3DMap> when the current user has
 * MAP_3D_VIEW (plus rank) and has the `show3DMap` setting enabled.
 */
export default function Region3DMapGated({
    polygon,
    className,
}: {
    polygon: [number, number][];
    className?: string;
}) {
    const { data: session } = useSession();
    const { show3DMap } = useUserSettings();
    const roles = (session?.user as any)?.realm_access?.roles ?? [];
    const can3D = hasPermission(roles, PERMISSIONS.MAP_3D_VIEW);
    if (!can3D || !show3DMap) return null;
    return <Region3DMap polygon={polygon} className={className} />;
}
