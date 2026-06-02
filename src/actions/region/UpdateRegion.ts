"use server"

import { getSession } from "@/lib/auth";
import { region } from "@/db/schema";
import db from "@/db/drizzle";
import { eq } from "drizzle-orm";

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
    const session = await getSession();
    if (!session?.user?.minecraft_uuid) {
        throw new Error("Not authenticated");
    }

    const existing = await db
        ?.select({ creatorUUID: region.creatorUUID })
        .from(region)
        .where(eq(region.id, regionId))
        .limit(1)
        .then((r) => r[0]);

    if (!existing) throw new Error("Region not found");
    if (existing.creatorUUID !== session.user.minecraft_uuid) {
        throw new Error("Not authorized");
    }

    await db?.update(region).set({ description, finished, builders }).where(eq(region.id, regionId));
    return { success: true };
}
