"use server";

import { eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { region, regionImage } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { deleteObject } from "@/lib/s3";

/**
 * Delete a region. Allowed for the region's creator and for users with the
 * REGIONS_EDIT permission. Associated images (DB rows + S3 objects) are
 * removed too; S3 failures are logged but don't abort the delete.
 */
export async function deleteRegion(regionId: string): Promise<{ success: true }> {
    const session = await getSession();
    if (!session?.user) throw new Error("Nicht angemeldet");

    const roles = (session.user as any)?.realm_access?.roles ?? [];
    const isAdmin = hasPermission(roles, PERMISSIONS.REGIONS_EDIT);
    const userUuid = (session.user as any)?.minecraft_uuid as string | undefined;

    const existing = await db!
        .select({ creatorUUID: region.creatorUUID })
        .from(region)
        .where(eq(region.id, regionId))
        .limit(1)
        .then((r) => r[0]);
    if (!existing) throw new Error("Region nicht gefunden");

    const isCreator = !!userUuid && existing.creatorUUID === userUuid;
    if (!isCreator && !isAdmin) throw new Error("Keine Berechtigung");

    const images = await db!
        .select({ id: regionImage.id, s3Key: regionImage.s3Key })
        .from(regionImage)
        .where(eq(regionImage.regionId, regionId));

    await db!.delete(regionImage).where(eq(regionImage.regionId, regionId));
    await db!.delete(region).where(eq(region.id, regionId));

    await Promise.allSettled(
        images.map((img) =>
            deleteObject(img.s3Key).catch((err) =>
                console.error(`[deleteRegion] S3 delete failed for ${img.s3Key}:`, err?.message ?? err),
            ),
        ),
    );

    return { success: true };
}
