import { eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { appSetting } from "@/db/schema";
import { getErrorMessage } from "@/lib/errors";

/**
 * Tiny wrapper around the `app_settings` key/value table.
 *
 * Reads are cached in-process for a few seconds: settings are consulted on
 * hot paths (every region write asks whether auto-sync is on) but change
 * maybe once a month, so a short TTL keeps the DB out of the request path
 * without making the admin toggle feel laggy.
 */

const CACHE_TTL_MS = 10_000;

const cache = new Map<string, { value: unknown; readAt: number }>();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.readAt < CACHE_TTL_MS) {
        return (cached.value ?? fallback) as T;
    }

    try {
        const row = await db
            .select({ value: appSetting.value })
            .from(appSetting)
            .where(eq(appSetting.key, key))
            .limit(1)
            .then((r) => r[0]);

        const value = row ? row.value : undefined;
        cache.set(key, { value, readAt: Date.now() });
        return (value ?? fallback) as T;
    } catch (err) {
        // A settings lookup must never take down the caller — fall back to the
        // default (which is always the conservative option).
        console.error(`[settings] read failed for "${key}":`, getErrorMessage(err));
        return fallback;
    }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
    await db
        .insert(appSetting)
        .values({ key, value: value as never })
        .onConflictDoUpdate({
            target: appSetting.key,
            set: { value: value as never, updatedAt: new Date() },
        });

    cache.set(key, { value, readAt: Date.now() });
}

/** Drops the cached copy of `key` (or the whole cache when omitted). */
export function invalidateSetting(key?: string): void {
    if (key) cache.delete(key);
    else cache.clear();
}

export const SETTINGS = {
    /** Whether region writes are pushed to the main BTE map automatically. */
    BTE_AUTO_SYNC: "bte_sync.auto_enabled",
    /** Whether pushed claims carry the region's owner (creator) reference. */
    BTE_SYNC_OWNER: "bte_sync.owner_enabled",
} as const;
