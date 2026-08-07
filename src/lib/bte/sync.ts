import { eq, inArray } from "drizzle-orm";
import db from "@/db/drizzle";
import { bteSyncState, region as regionTable } from "@/db/schema";
import {
    BteApiError,
    createClaim,
    deleteClaimByExternalId,
    deleteClaimById,
    listClaims,
    updateClaimByExternalId,
    updateClaimById,
    type BteClaim,
    type BteClaimPayload,
} from "@/lib/bte/client";
import { getBteConfig } from "@/lib/bte/config";
import {
    areaCell,
    areaCellNeighbourhood,
    buildClaimPayload,
    claimName,
    describeClaim,
    describePayload,
    diffClaim,
    fingerprintRegion,
    shapesMatch,
    type AreaShape,
    type SyncRegion,
} from "@/lib/bte/mapping";
import { resolveClaimUsers } from "@/lib/bte/users";
import { getErrorMessage } from "@/lib/errors";
import { getSetting, SETTINGS } from "@/lib/settings";

/**
 * One-way sync of our regions to the main BuildTheEarth map.
 *
 * Our region id travels upstream as the claim's `externalId`, which makes the
 * relationship self-describing: every claim we own can be addressed, updated
 * and deleted without a local id mapping, and a claim without a known
 * `externalId` is by definition not ours. `bte_sync_state` only caches the
 * outcome of the last push so the UI can show it and so unchanged regions can
 * be skipped without a network call.
 */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const syncRegionColumns = {
    id: regionTable.id,
    description: regionTable.description,
    city: regionTable.city,
    address: regionTable.address,
    polygon: regionTable.polygon,
    buildings: regionTable.buildings,
    finished: regionTable.finished,
    creatorUUID: regionTable.creatorUUID,
    builders: regionTable.builders,
};

export async function loadSyncRegion(regionId: string): Promise<SyncRegion | null> {
    const row = await db
        .select(syncRegionColumns)
        .from(regionTable)
        .where(eq(regionTable.id, regionId))
        .limit(1)
        .then((r) => r[0]);
    return (row as SyncRegion | undefined) ?? null;
}

export async function loadSyncRegions(): Promise<SyncRegion[]> {
    return (await db.select(syncRegionColumns).from(regionTable)) as SyncRegion[];
}

/* -------------------------------------------------------------------------- */
/*  Sync state bookkeeping                                                    */
/* -------------------------------------------------------------------------- */

export interface SyncStateRow {
    regionId: string;
    claimId: string | null;
    status: "pending" | "synced" | "error";
    fingerprint: string | null;
    lastError: string | null;
    lastAttemptAt: Date | null;
    syncedAt: Date | null;
}

export async function getSyncState(regionId: string): Promise<SyncStateRow | null> {
    const row = await db
        .select()
        .from(bteSyncState)
        .where(eq(bteSyncState.regionId, regionId))
        .limit(1)
        .then((r) => r[0]);
    return (row as SyncStateRow | undefined) ?? null;
}

export async function getSyncStates(regionIds?: string[]): Promise<Map<string, SyncStateRow>> {
    if (regionIds && regionIds.length === 0) return new Map();

    const rows = await (regionIds
        ? db.select().from(bteSyncState).where(inArray(bteSyncState.regionId, regionIds))
        : db.select().from(bteSyncState));

    return new Map((rows as SyncStateRow[]).map((r) => [r.regionId, r]));
}

async function recordSuccess(regionId: string, claimId: string | null, fingerprint: string): Promise<void> {
    const now = new Date();
    await db
        .insert(bteSyncState)
        .values({
            regionId,
            claimId,
            status: "synced",
            fingerprint,
            lastError: null,
            lastAttemptAt: now,
            syncedAt: now,
        })
        .onConflictDoUpdate({
            target: bteSyncState.regionId,
            set: {
                claimId,
                status: "synced",
                fingerprint,
                lastError: null,
                lastAttemptAt: now,
                syncedAt: now,
                updatedAt: now,
            },
        });
}

async function recordFailure(regionId: string, message: string): Promise<void> {
    const now = new Date();
    const lastError = message.slice(0, 1000);
    await db
        .insert(bteSyncState)
        .values({ regionId, status: "error", lastError, lastAttemptAt: now })
        .onConflictDoUpdate({
            target: bteSyncState.regionId,
            set: { status: "error", lastError, lastAttemptAt: now, updatedAt: now },
        });
}

export async function forgetSyncState(regionId: string): Promise<void> {
    await db.delete(bteSyncState).where(eq(bteSyncState.regionId, regionId));
}

/* -------------------------------------------------------------------------- */
/*  Pushing a single region                                                   */
/* -------------------------------------------------------------------------- */

/** Heuristic: did the API reject the request because of owner/builder refs? */
function isAttributionError(err: unknown): boolean {
    return (
        err instanceof BteApiError &&
        (err.status === 400 || err.status === 404) &&
        /owner|builder|user|member/i.test(err.body)
    );
}

function isMissingClaimError(err: unknown): boolean {
    return (
        err instanceof BteApiError &&
        (err.status === 404 || (err.status === 400 && /not found|exist/i.test(err.body)))
    );
}

function isDuplicateClaimError(err: unknown): boolean {
    return (
        err instanceof BteApiError &&
        (err.status === 409 || (err.status === 400 && /already|duplicate|unique/i.test(err.body)))
    );
}

type PushTarget =
    | { kind: "create" }
    | { kind: "update" }
    | { kind: "adopt"; claimId: string };

async function send(payload: BteClaimPayload, target: PushTarget): Promise<BteClaim> {
    switch (target.kind) {
        case "create":
            return createClaim(payload);
        case "update":
            return updateClaimByExternalId(payload.externalId, payload);
        case "adopt":
            return updateClaimById(target.claimId, payload);
    }
}

/**
 * Sends one payload, attaching owner/builder references. If the API rejects
 * those references (a builder that has no BTE account, say), the claim is
 * retried without attribution rather than being dropped from the map.
 *
 * `syncOwner` is the admin toggle: with it off the claim goes up without an
 * owner reference, builders are unaffected.
 */
async function sendWithAttribution(
    regionRow: SyncRegion,
    payload: BteClaimPayload,
    target: PushTarget,
    syncOwner: boolean,
): Promise<BteClaim> {
    const users = await resolveClaimUsers(regionRow.creatorUUID, regionRow.builders, {
        includeOwner: syncOwner,
    });
    const enriched: BteClaimPayload = { ...payload, ...users };
    const hasAttribution = !!users.owner || !!users.builders?.length;

    try {
        return await send(enriched, target);
    } catch (err) {
        if (hasAttribution && isAttributionError(err)) {
            console.warn(
                `[bte-sync] retrying region ${regionRow.id} without owner/builders:`,
                getErrorMessage(err),
            );
            return send(payload, target);
        }
        throw err;
    }
}

/**
 * Whether pushed claims carry the region's owner. Read per push rather than
 * once per process — `getSetting` caches for a few seconds, so a long-running
 * full sync picks the current value up without hitting the DB per region.
 */
export async function isOwnerSyncEnabled(): Promise<boolean> {
    return getSetting<boolean>(SETTINGS.BTE_SYNC_OWNER, true);
}

export type PushOutcome = "created" | "updated" | "adopted" | "unchanged";

export interface PushResult {
    outcome: PushOutcome;
    claimId: string | null;
}

/**
 * Create or update the claim for one region and persist the outcome.
 *
 * `force` bypasses the fingerprint shortcut; `target` lets the manual sync
 * hand in a decision it already made (e.g. adopt an existing claim) instead
 * of having this function re-derive it.
 */
export async function pushRegion(
    regionRow: SyncRegion,
    options: { force?: boolean; target?: PushTarget } = {},
): Promise<PushResult> {
    const syncOwner = await isOwnerSyncEnabled();
    const payload = buildClaimPayload(regionRow);
    const fingerprint = fingerprintRegion(payload, regionRow, { syncOwner });
    const state = await getSyncState(regionRow.id);

    if (
        !options.force &&
        !options.target &&
        state?.status === "synced" &&
        state.fingerprint === fingerprint
    ) {
        return { outcome: "unchanged", claimId: state.claimId };
    }

    const target: PushTarget =
        options.target ?? (state?.status === "synced" ? { kind: "update" } : { kind: "create" });

    try {
        let claim: BteClaim;
        try {
            claim = await sendWithAttribution(regionRow, payload, target, syncOwner);
        } catch (err) {
            // The two ways our assumption about the remote side can be wrong:
            // we thought the claim existed and it doesn't, or vice versa.
            if (target.kind === "update" && isMissingClaimError(err)) {
                claim = await sendWithAttribution(regionRow, payload, { kind: "create" }, syncOwner);
            } else if (target.kind === "create" && isDuplicateClaimError(err)) {
                claim = await sendWithAttribution(regionRow, payload, { kind: "update" }, syncOwner);
            } else {
                throw err;
            }
        }

        const claimId = typeof claim?.id === "string" ? claim.id : (state?.claimId ?? null);
        await recordSuccess(regionRow.id, claimId, fingerprint);

        return {
            outcome:
                target.kind === "adopt" ? "adopted" : target.kind === "update" ? "updated" : "created",
            claimId,
        };
    } catch (err) {
        const message = getErrorMessage(err);
        await recordFailure(regionRow.id, message);
        throw err;
    }
}

/**
 * Remove a region's claim from the BTE map. Called after the local row is
 * gone, so the region id is all we have — which is exactly the `externalId`
 * the API indexes it under.
 */
export async function deleteRemoteClaim(regionId: string, claimId?: string | null): Promise<void> {
    try {
        await deleteClaimByExternalId(regionId);
    } catch (err) {
        if (isMissingClaimError(err) && claimId) {
            await deleteClaimById(claimId);
            return;
        }
        if (isMissingClaimError(err)) return; // already gone upstream
        throw err;
    }
}

/* -------------------------------------------------------------------------- */
/*  Full reconciliation                                                       */
/* -------------------------------------------------------------------------- */

export type PlanAction = "create" | "update" | "adopt" | "unchanged";

export interface PlanEntry {
    regionId: string;
    label: string;
    action: PlanAction;
    claimId: string | null;
    /** Why this region needs a push — empty for `unchanged`. */
    reasons: string[];
    /** Not sent to the browser; consumed by `applyPlanEntry`. */
    payload: BteClaimPayload;
    regionRow: SyncRegion;
}

export interface PlanDeletion {
    claimId: string;
    externalId: string | null;
    label: string;
}

export interface SyncPlan {
    entries: PlanEntry[];
    deletions: PlanDeletion[];
    /** Claims on the BTE map that were not created by us — left untouched. */
    foreignClaims: number;
    remoteTotal: number;
    localTotal: number;
}

/**
 * Compare every local region against the claims that currently exist on the
 * BTE map and derive what would have to change.
 *
 * The comparison is the point: a region that already exists upstream with the
 * same geometry and metadata is reported as `unchanged` and never re-sent, and
 * a claim that matches a region geographically but predates the sync is
 * adopted rather than duplicated.
 */
export async function planFullSync(): Promise<SyncPlan> {
    const [regions, claims, syncOwner] = await Promise.all([
        loadSyncRegions(),
        listClaims(),
        isOwnerSyncEnabled(),
    ]);
    const states = await getSyncStates();

    const byExternalId = new Map<string, BteClaim>();
    const unmatched: BteClaim[] = [];
    for (const claim of claims) {
        const externalId = typeof claim.externalId === "string" ? claim.externalId.trim() : "";
        if (externalId) byExternalId.set(externalId, claim);
        else unmatched.push(claim);
    }

    // Spatial index over the claims that carry no externalId, so looking for
    // a pre-existing duplicate stays a handful of comparisons per region
    // instead of a scan over every claim.
    const unmatchedIndex = new Map<string, { claim: BteClaim; shape: AreaShape }[]>();
    for (const claim of unmatched) {
        const shape = describeClaim(claim);
        if (!shape) continue;
        const key = areaCell(shape);
        const bucket = unmatchedIndex.get(key);
        if (bucket) bucket.push({ claim, shape });
        else unmatchedIndex.set(key, [{ claim, shape }]);
    }

    const entries: PlanEntry[] = [];
    const localIds = new Set<string>();
    const adopted = new Set<string>();

    const findDuplicate = (payload: BteClaimPayload): BteClaim | null => {
        const shape = describePayload(payload);
        if (!shape) return null;

        for (const key of areaCellNeighbourhood(shape)) {
            for (const candidate of unmatchedIndex.get(key) ?? []) {
                if (adopted.has(candidate.claim.id)) continue;
                if (shapesMatch(shape, candidate.shape)) return candidate.claim;
            }
        }
        return null;
    };

    for (const regionRow of regions) {
        localIds.add(regionRow.id);

        const payload = buildClaimPayload(regionRow);
        const fingerprint = fingerprintRegion(payload, regionRow, { syncOwner });
        const state = states.get(regionRow.id);
        const label = claimName(regionRow);

        const existing = byExternalId.get(regionRow.id);
        if (existing) {
            const changed = diffClaim(payload, existing);
            // Fields can match while attribution changed — the stored
            // fingerprint is the only thing that sees owner/builder edits.
            // A region we've never pushed has no fingerprint to compare, and
            // the claim API doesn't echo owners back, so identical fields are
            // taken at face value: it already exists exactly like this.
            const fingerprintStale = !!state && state.fingerprint !== fingerprint;

            if (changed.length === 0 && !fingerprintStale) {
                entries.push({
                    regionId: regionRow.id,
                    label,
                    action: "unchanged",
                    claimId: existing.id ?? null,
                    reasons: [],
                    payload,
                    regionRow,
                });
            } else {
                entries.push({
                    regionId: regionRow.id,
                    label,
                    action: "update",
                    claimId: existing.id ?? null,
                    reasons: changed.length > 0 ? changed : ["Builder/Ersteller"],
                    payload,
                    regionRow,
                });
            }
            continue;
        }

        // No claim carries our id — before creating a second polygon on the
        // same spot, look for a claim that describes the same area already.
        const duplicate = findDuplicate(payload);
        if (duplicate) {
            adopted.add(duplicate.id);
            entries.push({
                regionId: regionRow.id,
                label,
                action: "adopt",
                claimId: duplicate.id,
                reasons: ["Bereits vorhandener Claim ohne Verknüpfung"],
                payload,
                regionRow,
            });
            continue;
        }

        entries.push({
            regionId: regionRow.id,
            label,
            action: "create",
            claimId: null,
            reasons: ["Noch nicht auf der BTE-Karte"],
            payload,
            regionRow,
        });
    }

    // Claims that carry one of our region ids but whose region is gone locally.
    const deletions: PlanDeletion[] = [];
    for (const [externalId, claim] of byExternalId) {
        if (localIds.has(externalId)) continue;
        if (!UUID_RE.test(externalId)) continue; // not one of ours
        deletions.push({
            claimId: claim.id,
            externalId,
            label: claim.name ?? claim.city ?? externalId,
        });
    }

    return {
        entries,
        deletions,
        foreignClaims: unmatched.length - adopted.size,
        remoteTotal: claims.length,
        localTotal: regions.length,
    };
}

/** Executes one planned entry. `unchanged` entries only refresh local state. */
export async function applyPlanEntry(entry: PlanEntry): Promise<PushOutcome> {
    if (entry.action === "unchanged") {
        // Nothing to send, but remember the verified state so the next run can
        // skip the region without asking the API again. Same owner-sync flag as
        // the plan used, or the stored hash would immediately look stale again.
        await recordSuccess(
            entry.regionId,
            entry.claimId,
            fingerprintRegion(entry.payload, entry.regionRow, {
                syncOwner: await isOwnerSyncEnabled(),
            }),
        );
        return "unchanged";
    }

    const target: PushTarget =
        entry.action === "adopt" && entry.claimId
            ? { kind: "adopt", claimId: entry.claimId }
            : entry.action === "update"
                ? { kind: "update" }
                : { kind: "create" };

    const result = await pushRegion(entry.regionRow, { force: true, target });
    return result.outcome;
}

export async function applyPlanDeletion(deletion: PlanDeletion): Promise<void> {
    if (deletion.externalId) {
        await deleteRemoteClaim(deletion.externalId, deletion.claimId);
        await forgetSyncState(deletion.externalId);
        return;
    }
    await deleteClaimById(deletion.claimId);
}

/* -------------------------------------------------------------------------- */
/*  Clearing the build team's claims                                          */
/* -------------------------------------------------------------------------- */

export interface RemoteClaimSummary {
    claimId: string;
    externalId: string | null;
    label: string;
    /** False for claims that were created directly on the BTE side. */
    ours: boolean;
}

/**
 * Every claim the build team currently has on the BTE map — the input for the
 * "clear everything" action in the admin panel.
 */
export async function listRemoteClaims(): Promise<RemoteClaimSummary[]> {
    const claims = await listClaims();
    return claims.map((claim) => {
        const externalId = typeof claim.externalId === "string" ? claim.externalId.trim() : "";
        return {
            claimId: claim.id,
            externalId: externalId || null,
            label: claim.name?.trim() || claim.city?.trim() || claim.id,
            ours: UUID_RE.test(externalId),
        };
    });
}

/** Deletes one claim upstream and drops the local mirror state for it. */
export async function deleteRemoteClaimSummary(claim: RemoteClaimSummary): Promise<void> {
    await deleteClaimById(claim.claimId);
    if (claim.ours && claim.externalId) await forgetSyncState(claim.externalId);
}

/**
 * Forget every local sync record. Called after a full clear so the next sync
 * treats all regions as new rather than trying to update claims that are gone.
 */
export async function clearAllSyncState(): Promise<void> {
    await db.delete(bteSyncState);
}

/* -------------------------------------------------------------------------- */
/*  Toggle                                                                    */
/* -------------------------------------------------------------------------- */

export function isBteConfigured(): boolean {
    return getBteConfig() !== null;
}

/** Whether region writes should be mirrored upstream automatically. */
export async function isAutoSyncEnabled(): Promise<boolean> {
    if (!isBteConfigured()) return false;
    return getSetting<boolean>(SETTINGS.BTE_AUTO_SYNC, false);
}
