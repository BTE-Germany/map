"use server";

import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { region } from "@/db/schema";
import db from "@/db/drizzle";
import { eq } from "drizzle-orm";

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
    const session = await getSession();
    if (!session?.user) throw new Error("Not authenticated");

    const roles = session.user.realm_access?.roles ?? [];
    if (!hasPermission(roles, PERMISSIONS.REGIONS_EDIT)) {
        throw new Error("Not authorized");
    }

    const { regionId, ...fields } = input;

    await db?.update(region).set({
        description: fields.description,
        finished: fields.finished,
        type: fields.type,
        city: fields.city,
        state: fields.state,
        address: fields.address,
        buildings: fields.buildings,
        area: fields.area,
        creatorUUID: fields.creatorUUID,
        builders: fields.builders,
    }).where(eq(region.id, regionId));

    return { success: true };
}
