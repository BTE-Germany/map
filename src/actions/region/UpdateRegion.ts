"use server";

import { region } from "@/db/schema";
import db from "@/db/drizzle";
import { eq } from "drizzle-orm";
import { assertUuid, requireRegionAccess } from "@/lib/guards";
import { PERMISSIONS } from "@/lib/permissions";

const MAX_BUILDERS = 50;

export async function updateRegion({
    regionId,
    description,
    finished,
    builders,
}: {
    regionId: string;
    description: string;
    finished: boolean;
    builders: string[];
}) {
    // Creator or any user with REGIONS_EDIT may update the region.
    await requireRegionAccess(regionId, PERMISSIONS.REGIONS_EDIT);

    if (builders.length > MAX_BUILDERS) {
        throw new Error(`Maximal ${MAX_BUILDERS} Builder pro Region.`);
    }
    const normalizedBuilders = Array.from(
        new Set(builders.map((b) => assertUuid(b, "Builder-UUID"))),
    );

    await db
        .update(region)
        .set({ description, finished, builders: normalizedBuilders })
        .where(eq(region.id, regionId));
    return { success: true };
}
