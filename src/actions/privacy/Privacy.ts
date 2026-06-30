"use server";

import { eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { playerPrivacy } from "@/db/schema";
import { requireLinkedUuid } from "@/lib/guards";

export interface PrivacyState {
    hideOnMap: boolean;
}

export async function getPrivacy(): Promise<PrivacyState> {
    const uuid = await requireLinkedUuid();
    const row = await db
        .select()
        .from(playerPrivacy)
        .where(eq(playerPrivacy.minecraftUUID, uuid))
        .limit(1)
        .then((r) => r[0]);
    return { hideOnMap: !!row?.hideOnMap };
}

export async function setHideOnMap(hide: boolean): Promise<PrivacyState> {
    const uuid = await requireLinkedUuid();
    await db
        .insert(playerPrivacy)
        .values({ minecraftUUID: uuid, hideOnMap: hide })
        .onConflictDoUpdate({
            target: playerPrivacy.minecraftUUID,
            set: { hideOnMap: hide, updatedAt: new Date() },
        });
    return { hideOnMap: hide };
}
