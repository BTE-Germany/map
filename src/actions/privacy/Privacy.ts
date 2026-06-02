"use server";

import { eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { playerPrivacy } from "@/db/schema";
import { getSession } from "@/lib/auth";

export interface PrivacyState {
    hideOnMap: boolean;
}

async function currentUUID(): Promise<string> {
    const session = await getSession();
    const uuid = (session?.user as any)?.minecraft_uuid as string | undefined;
    if (!uuid) throw new Error("Not authenticated or no Minecraft account linked");
    return uuid;
}

export async function getPrivacy(): Promise<PrivacyState> {
    const uuid = await currentUUID();
    const row = await db!
        .select()
        .from(playerPrivacy)
        .where(eq(playerPrivacy.minecraftUUID, uuid))
        .limit(1)
        .then((r) => r[0]);
    return { hideOnMap: !!row?.hideOnMap };
}

export async function setHideOnMap(hide: boolean): Promise<PrivacyState> {
    const uuid = await currentUUID();
    await db!
        .insert(playerPrivacy)
        .values({ minecraftUUID: uuid, hideOnMap: hide })
        .onConflictDoUpdate({
            target: playerPrivacy.minecraftUUID,
            set: { hideOnMap: hide, updatedAt: new Date() },
        });
    return { hideOnMap: hide };
}
