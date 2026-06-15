"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import useStreetLevelStore from "@/stores/StreetLevelStore";
import StreetLevelExplorer from "./StreetLevelExplorer";
import StreetLevelPicker from "./StreetLevelPicker";

export default function StreetLevelFeature() {
    const { data: session } = useSession();
    const roles = session?.user?.realm_access?.roles ?? [];
    const canUseStreetLevel = hasPermission(roles, PERMISSIONS.MAP_STREET_LEVEL_VIEW);

    useEffect(() => {
        if (!canUseStreetLevel) {
            const state = useStreetLevelStore.getState();
            state.cancelSelecting();
            state.close();
        }
    }, [canUseStreetLevel]);

    if (!canUseStreetLevel) {
        return null;
    }

    return (
        <>
            <StreetLevelPicker />
            <StreetLevelExplorer />
        </>
    );
}
