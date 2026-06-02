"use server";

import { randomUUID } from "crypto";
import { and, asc, eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { region, regionImage } from "@/db/schema";
import { getSession } from "@/lib/auth";
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

async function assertCanManageRegion(regionId: string) {
    const session = await getSession();
    if (!session?.user) throw new Error("Not authenticated");

    const roles = (session.user as any)?.realm_access?.roles ?? [];
    const isAdmin = hasPermission(roles, PERMISSIONS.REGIONS_EDIT);
    const userUuid = (session.user as any)?.minecraft_uuid as string | undefined;

    const existing = await db
        ?.select({ creatorUUID: region.creatorUUID })
        .from(region)
        .where(eq(region.id, regionId))
        .limit(1)
        .then((r) => r[0]);
    if (!existing) throw new Error("Region not found");

    const isCreator = !!userUuid && existing.creatorUUID === userUuid;
    if (!isCreator && !isAdmin) throw new Error("Not authorized");

    return { userUuid: userUuid ?? "", isAdmin, isCreator };
}

export async function listRegionImages(regionId: string): Promise<RegionImageDTO[]> {
    if (!regionId) return [];
    const rows = await db!
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

    await assertCanManageRegion(input.regionId);

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

    const existingCount = await db!
        .select({ count: regionImage.id })
        .from(regionImage)
        .where(eq(regionImage.regionId, input.regionId))
        .then((r) => r.length);
    if (existingCount >= MAX_IMAGES_PER_REGION) {
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
    const { userUuid } = await assertCanManageRegion(input.regionId);

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

    const inserted = await db!
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
    const session = await getSession();
    if (!session?.user) throw new Error("Not authenticated");
    const roles = (session.user as any)?.realm_access?.roles ?? [];
    const isAdmin = hasPermission(roles, PERMISSIONS.REGIONS_EDIT);
    const userUuid = (session.user as any)?.minecraft_uuid as string | undefined;

    const row = await db!
        .select()
        .from(regionImage)
        .where(eq(regionImage.id, imageId))
        .limit(1)
        .then((r) => r[0]);
    if (!row) throw new Error("Bild nicht gefunden");

    const creatorUUID = await db!
        .select({ creatorUUID: region.creatorUUID })
        .from(region)
        .where(eq(region.id, row.regionId))
        .limit(1)
        .then((r) => r[0]?.creatorUUID);

    const isCreator = !!userUuid && creatorUUID === userUuid;
    const isUploader = !!userUuid && row.uploaderUUID === userUuid;
    if (!isCreator && !isAdmin && !isUploader) throw new Error("Not authorized");

    await db!.delete(regionImage).where(eq(regionImage.id, imageId));
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
