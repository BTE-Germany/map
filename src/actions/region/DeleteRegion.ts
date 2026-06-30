"use server";

import { eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { region, regionImage } from "@/db/schema";
import { requireRegionAccess } from "@/lib/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteObject } from "@/lib/s3";

/**
 * Delete a region. Allowed for the region's creator and for users with the
 * REGIONS_EDIT permission. The DB rows (region + its image rows) are removed
 * atomically; the S3 objects are deleted afterwards on a best-effort basis so
 * a storage hiccup never leaves the database inconsistent.
 */
export async function deleteRegion(regionId: string): Promise<{ success: true }> {
    await requireRegionAccess(regionId, PERMISSIONS.REGIONS_EDIT);

    const images = await db
        .select({ id: regionImage.id, s3Key: regionImage.s3Key })
        .from(regionImage)
        .where(eq(regionImage.regionId, regionId));

    await db.transaction(async (tx) => {
        await tx.delete(regionImage).where(eq(regionImage.regionId, regionId));
        await tx.delete(region).where(eq(region.id, regionId));
    });

    await Promise.allSettled(
        images.map((img) =>
            deleteObject(img.s3Key).catch((err) =>
                console.error(`[deleteRegion] S3 delete failed for ${img.s3Key}:`, err?.message ?? err),
            ),
        ),
    );

    return { success: true };
}
