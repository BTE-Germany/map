import { S3Client, DeleteObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * S3 / kompatibles Object Storage Backend. Unterstützt AWS, R2, MinIO, etc.
 * Benötigte Env-Vars:
 *  - S3_REGION                (z.B. "auto" für R2, "eu-central-1" für AWS)
 *  - S3_BUCKET                (Bucket-Name)
 *  - S3_ACCESS_KEY_ID
 *  - S3_SECRET_ACCESS_KEY
 *  - S3_ENDPOINT              (optional, für R2/MinIO)
 *  - S3_FORCE_PATH_STYLE      (optional, "true" für MinIO/R2)
 *  - S3_PUBLIC_URL            (optional, Basis für public URLs; sonst presigned GETs)
 */

const endpoint = process.env.S3_ENDPOINT;
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

export const s3Bucket = process.env.S3_BUCKET ?? "";
export const s3PublicUrl = process.env.S3_PUBLIC_URL?.replace(/\/$/, "") ?? "";

export const s3 = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
});

export const ALLOWED_IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** 10 MiB maximale Datei-Größe. */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
/** Harter Cap pro Region, damit der Storage nicht überläuft. */
export const MAX_IMAGES_PER_REGION = 20;

export function getPublicUrl(key: string): string {
    if (s3PublicUrl) return `${s3PublicUrl}/${key}`;
    // Fallback: AWS-Standard-URL
    if (endpoint) {
        const base = endpoint.replace(/\/$/, "");
        return forcePathStyle ? `${base}/${s3Bucket}/${key}` : `${base}/${key}`;
    }
    return `https://${s3Bucket}.s3.amazonaws.com/${key}`;
}

export async function createUploadPresignedUrl(params: {
    key: string;
    contentType: AllowedImageMime;
    contentLength: number;
}): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: params.key,
        ContentType: params.contentType,
        ContentLength: params.contentLength,
    });
    return getSignedUrl(s3, command, { expiresIn: 60 * 5 }); // 5 min
}

export async function headObject(key: string) {
    try {
        return await s3.send(new HeadObjectCommand({ Bucket: s3Bucket, Key: key }));
    } catch {
        return null;
    }
}

export async function deleteObject(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }));
}
