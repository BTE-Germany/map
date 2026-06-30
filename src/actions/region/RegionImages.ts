"use server";

import { randomUUID } from "crypto";
import { asc, count, eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { region, regionImage } from "@/db/schema";
import { assertUuid, requireRegionAccess, requireSession } from "@/lib/guards";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_IMAGES_PER_REGION,
    MAX_IMAGE_SIZE_BYTES,
    createUploadPresignedUrl,
    deleteObject,
    getPublicUrl,
    headObject,
    s3Bucket,
    type AllowedImageMime,
} from "@/lib/s3";

export interface RegionImageDTO {
    id: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    originalName: string | null;
    uploaderUUID: string;
    createdAt: Date;
}

function toDTO(row: typeof regionImage.$inferSelect): RegionImageDTO {
    return {
        id: row.id,
        url: getPublicUrl(row.s3Key),
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        originalName: row.originalName,
        uploaderUUID: row.uploaderUUID,
        createdAt: row.createdAt,
    };
}

async function countRegionImages(regionId: string): Promise<number> {
    return db
        .select({ value: count() })
        .from(regionImage)
        .where(eq(regionImage.regionId, regionId))
        .then((r) => r[0]?.value ?? 0);
}

export async function listRegionImages(regionId: string): Promise<RegionImageDTO[]> {
    if (!regionId) return [];
    const rows = await db
        .select()
        .from(regionImage)
        .where(eq(regionImage.regionId, regionId))
        .orderBy(asc(regionImage.createdAt));
    return rows.map(toDTO);
}

export interface PresignedUploadResponse {
    uploadUrl: string;
    key: string;
    expiresInSeconds: number;
}

export async function createRegionImageUpload(input: {
    regionId: string;
    mimeType: string;
    sizeBytes: number;
    originalName?: string;
}): Promise<PresignedUploadResponse> {
    if (!s3Bucket) {
        throw new Error("S3 ist auf dem Server nicht konfiguriert.");
    }

    await requireRegionAccess(input.regionId, PERMISSIONS.REGIONS_EDIT);

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(input.mimeType as AllowedImageMime)) {
        throw new Error(
            `Nicht unterstützter Dateityp. Erlaubt: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`
        );
    }
    if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
        throw new Error("Ungültige Dateigröße.");
    }
    if (input.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
        throw new Error(
            `Datei zu groß. Maximal erlaubt sind ${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)} MB.`
        );
    }

    if (await countRegionImages(input.regionId) >= MAX_IMAGES_PER_REGION) {
        throw new Error(
            `Maximal ${MAX_IMAGES_PER_REGION} Bilder pro Region. Bitte vorher alte Bilder löschen.`
        );
    }

    const ext = EXT_BY_MIME[input.mimeType as AllowedImageMime];
    const key = `regions/${input.regionId}/${randomUUID()}.${ext}`;

    const uploadUrl = await createUploadPresignedUrl({
        key,
        contentType: input.mimeType as AllowedImageMime,
        contentLength: input.sizeBytes,
    });

    return { uploadUrl, key, expiresInSeconds: 300 };
}

export async function finalizeRegionImageUpload(input: {
    regionId: string;
    key: string;
    originalName?: string;
}): Promise<RegionImageDTO> {
    const { userUuid } = await requireRegionAccess(input.regionId, PERMISSIONS.REGIONS_EDIT);
    if (!userUuid) {
        throw new Error("Zum Hochladen muss ein Minecraft-Account verknüpft sein.");
    }

    // Schlüssel muss im Region-Namespace liegen (defensive Check).
    const expectedPrefix = `regions/${input.regionId}/`;
    if (!input.key.startsWith(expectedPrefix)) {
        throw new Error("Ungültiger Upload-Schlüssel.");
    }

    // Objekt muss tatsächlich hochgeladen worden sein und Größen/Typ passen.
    const head = await headObject(input.key);
    if (!head) throw new Error("Upload konnte nicht verifiziert werden.");

    const contentLength = head.ContentLength ?? 0;
    const contentType = head.ContentType ?? "";

    if (contentLength <= 0 || contentLength > MAX_IMAGE_SIZE_BYTES) {
        await deleteObject(input.key).catch(() => {});
        throw new Error("Hochgeladene Datei ist zu groß oder leer.");
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(contentType as AllowedImageMime)) {
        await deleteObject(input.key).catch(() => {});
        throw new Error("Hochgeladene Datei hat einen ungültigen Typ.");
    }

    // Re-check the per-region cap now that the object exists, deleting the
    // orphaned upload if a concurrent finalize already filled the quota.
    if (await countRegionImages(input.regionId) >= MAX_IMAGES_PER_REGION) {
        await deleteObject(input.key).catch(() => {});
        throw new Error(`Maximal ${MAX_IMAGES_PER_REGION} Bilder pro Region.`);
    }

    const inserted = await db
        .insert(regionImage)
        .values({
            regionId: input.regionId,
            uploaderUUID: userUuid,
            s3Key: input.key,
            mimeType: contentType,
            sizeBytes: contentLength,
            originalName: (input.originalName ?? "").slice(0, 256) || null,
        })
        .returning();

    return toDTO(inserted[0]);
}

export async function deleteRegionImage(imageId: string): Promise<{ success: true }> {
    assertUuid(imageId, "Bild-ID");
    const { roles, userUuid } = await requireSession();
    const isAdmin = hasPermission(roles, PERMISSIONS.REGIONS_EDIT);

    const row = await db
        .select()
        .from(regionImage)
        .where(eq(regionImage.id, imageId))
        .limit(1)
        .then((r) => r[0]);
    if (!row) throw new Error("Bild nicht gefunden");

    const creatorUUID = await db
        .select({ creatorUUID: region.creatorUUID })
        .from(region)
        .where(eq(region.id, row.regionId))
        .limit(1)
        .then((r) => r[0]?.creatorUUID);

    const isCreator = !!userUuid && creatorUUID === userUuid;
    const isUploader = !!userUuid && row.uploaderUUID === userUuid;
    if (!isCreator && !isAdmin && !isUploader) throw new Error("Keine Berechtigung");

    await db.delete(regionImage).where(eq(regionImage.id, imageId));
    await deleteObject(row.s3Key).catch((err) =>
        console.error(`[regionImages] S3 delete failed for ${row.s3Key}:`, err?.message ?? err)
    );

    return { success: true };
}

const EXT_BY_MIME: Record<AllowedImageMime, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};
