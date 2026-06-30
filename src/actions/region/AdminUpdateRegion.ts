"use server";

import { region } from "@/db/schema";
import db from "@/db/drizzle";
import { eq } from "drizzle-orm";
import { assertUuid, requirePermission } from "@/lib/guards";
import { PERMISSIONS } from "@/lib/permissions";

const MAX_BUILDERS = 50;

export interface AdminUpdateRegionInput {
    regionId: string;
    description: string;
    finished: boolean;
    type: "default" | "plot" | "event";
    city: string;
    state: string;
    address: string;
    buildings: number;
    area: string;
    creatorUUID: string;
    builders: string[];
}

export async function adminUpdateRegion(input: AdminUpdateRegionInput) {
    await requirePermission(PERMISSIONS.REGIONS_EDIT);

    const regionId = assertUuid(input.regionId, "Region-ID");
    const creatorUUID = assertUuid(input.creatorUUID, "Creator-UUID");
    if (input.builders.length > MAX_BUILDERS) {
        throw new Error(`Maximal ${MAX_BUILDERS} Builder pro Region.`);
    }
    const builders = Array.from(
        new Set(input.builders.map((b) => assertUuid(b, "Builder-UUID"))),
    );

    await db.update(region).set({
        description: input.description,
        finished: input.finished,
        type: input.type,
        city: input.city,
        state: input.state,
        address: input.address,
        buildings: input.buildings,
        area: input.area,
        creatorUUID,
        builders,
    }).where(eq(region.id, regionId));

    return { success: true };
}
