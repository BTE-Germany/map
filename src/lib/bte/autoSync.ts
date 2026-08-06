import { after } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import {
    deleteRemoteClaim,
    isAutoSyncEnabled,
    isBteConfigured,
    loadSyncRegion,
    pushRegion,
} from "@/lib/bte/sync";

/**
 * Fire-and-forget hooks that mirror region writes to the main BTE map.
 *
 * Every mutating region path calls one of these *after* its own DB write has
 * committed. They never throw and never block the response: the sync is a
 * side channel, and a BTE outage must not make creating a region fail. Errors
 * are persisted in `bte_sync_state`, so the admin panel shows them and the
 * manual sync picks the region up again on the next run.
 */

/**
 * Runs `task` outside the response path. `after()` keeps the serverless
 * invocation alive until the task settles; outside a request scope (scripts,
 * tests) it throws, so fall back to a detached promise.
 */
function runDetached(label: string, task: () => Promise<void>): void {
    const guarded = () =>
        task().catch((err) => console.error(`[bte-sync] ${label} failed:`, getErrorMessage(err)));

    try {
        after(guarded);
    } catch {
        void guarded();
    }
}

/**
 * Push a created or updated region upstream. Regions whose payload hasn't
 * changed since the last successful push are skipped without a network call.
 */
export function scheduleRegionSync(regionId: string): void {
    if (!isBteConfigured()) return;

    runDetached(`push ${regionId}`, async () => {
        if (!(await isAutoSyncEnabled())) return;

        const regionRow = await loadSyncRegion(regionId);
        if (!regionRow) return; // deleted again before we got here

        await pushRegion(regionRow);
    });
}

/**
 * Remove a deleted region's claim from the BTE map. The caller passes the
 * cached `claimId` because the local sync-state row is gone by then.
 *
 * Unlike creates and updates this does *not* honour the auto-sync toggle: a
 * region that no longer exists here must never keep living on the BTE map.
 * Pausing the sync is about holding back our changes, not about leaking
 * claims nobody can clean up from this side any more.
 */
export function scheduleRegionDeletion(regionId: string, claimId: string | null): void {
    if (!isBteConfigured()) return;

    runDetached(`delete ${regionId}`, async () => {
        await deleteRemoteClaim(regionId, claimId);
    });
}

/** Pushes several regions (transfer/bulk edits) without fanning out requests. */
export function scheduleRegionsSync(regionIds: string[]): void {
    if (!isBteConfigured() || regionIds.length === 0) return;

    runDetached(`push ${regionIds.length} regions`, async () => {
        if (!(await isAutoSyncEnabled())) return;

        for (const regionId of regionIds) {
            const regionRow = await loadSyncRegion(regionId);
            if (!regionRow) continue;
            try {
                await pushRegion(regionRow);
            } catch (err) {
                // Already recorded on the region's sync state — keep going so
                // one bad region can't stall the rest of a transfer.
                console.error(`[bte-sync] push ${regionId} failed:`, getErrorMessage(err));
            }
        }
    });
}
