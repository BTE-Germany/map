"use server";

import { desc, eq, sql } from "drizzle-orm";
import db from "@/db/drizzle";
import { bteSyncState, region as regionTable } from "@/db/schema";
import { getBteConfigStatus, type BteConfigStatus } from "@/lib/bte/config";
import { loadSyncRegion, pushRegion } from "@/lib/bte/sync";
import { getErrorMessage } from "@/lib/errors";
import { assertUuid, requirePermission } from "@/lib/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { getSetting, invalidateSetting, setSetting, SETTINGS } from "@/lib/settings";

/** Server actions backing the "BTE-Sync" page of the admin panel. */

export interface BteSyncOverview {
    config: BteConfigStatus;
    autoSyncEnabled: boolean;
    regionCount: number;
    syncedCount: number;
    errorCount: number;
    pendingCount: number;
    /** Regions that were never pushed (no state row at all). */
    neverSyncedCount: number;
    lastSyncedAt: string | null;
    failures: BteSyncFailure[];
}

export interface BteSyncFailure {
    regionId: string;
    label: string;
    error: string;
    lastAttemptAt: string | null;
}

const MAX_FAILURES = 25;

export async function getBteSyncOverview(): Promise<BteSyncOverview> {
    await requirePermission(PERMISSIONS.SYNC_MANAGE);

    const [regionCountRow, stateCounts, lastSynced, failureRows, autoSyncEnabled] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(regionTable).then((r) => r[0]?.count ?? 0),
        db
            .select({ status: bteSyncState.status, count: sql<number>`count(*)::int` })
            .from(bteSyncState)
            .groupBy(bteSyncState.status),
        db
            .select({ syncedAt: bteSyncState.syncedAt })
            .from(bteSyncState)
            .orderBy(desc(bteSyncState.syncedAt))
            .limit(1)
            .then((r) => r[0]?.syncedAt ?? null),
        db
            .select({
                regionId: bteSyncState.regionId,
                error: bteSyncState.lastError,
                lastAttemptAt: bteSyncState.lastAttemptAt,
                city: regionTable.city,
                address: regionTable.address,
            })
            .from(bteSyncState)
            .leftJoin(regionTable, eq(regionTable.id, bteSyncState.regionId))
            .where(eq(bteSyncState.status, "error"))
            .orderBy(desc(bteSyncState.lastAttemptAt))
            .limit(MAX_FAILURES),
        getSetting<boolean>(SETTINGS.BTE_AUTO_SYNC, false),
    ]);

    const byStatus = new Map(stateCounts.map((row) => [row.status, row.count]));
    const syncedCount = byStatus.get("synced") ?? 0;
    const errorCount = byStatus.get("error") ?? 0;
    const pendingCount = byStatus.get("pending") ?? 0;
    const tracked = syncedCount + errorCount + pendingCount;

    return {
        config: getBteConfigStatus(),
        autoSyncEnabled,
        regionCount: regionCountRow,
        syncedCount,
        errorCount,
        pendingCount,
        neverSyncedCount: Math.max(0, regionCountRow - tracked),
        lastSyncedAt: lastSynced?.toISOString() ?? null,
        failures: failureRows.map((row) => ({
            regionId: row.regionId,
            label: row.address?.trim() || row.city?.trim() || row.regionId.slice(0, 8),
            error: row.error ?? "Unbekannter Fehler",
            lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
        })),
    };
}

export async function setBteAutoSync(enabled: boolean): Promise<{ enabled: boolean }> {
    await requirePermission(PERMISSIONS.SYNC_MANAGE);

    await setSetting(SETTINGS.BTE_AUTO_SYNC, enabled);
    invalidateSetting(SETTINGS.BTE_AUTO_SYNC);

    return { enabled };
}

/** Re-pushes a single region — the "retry" next to a failed entry. */
export async function retryRegionSync(regionId: string): Promise<{ outcome: string }> {
    await requirePermission(PERMISSIONS.SYNC_MANAGE);
    assertUuid(regionId, "Region-ID");

    const regionRow = await loadSyncRegion(regionId);
    if (!regionRow) throw new Error("Region nicht gefunden");

    try {
        const result = await pushRegion(regionRow, { force: true });
        return { outcome: result.outcome };
    } catch (err) {
        throw new Error(getErrorMessage(err));
    }
}
