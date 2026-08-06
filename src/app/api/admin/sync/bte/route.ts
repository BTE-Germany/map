import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/errors";
import {
    applyPlanDeletion,
    applyPlanEntry,
    clearAllSyncState,
    deleteRemoteClaimSummary,
    isBteConfigured,
    listRemoteClaims,
    planFullSync,
    type PlanAction,
    type SyncPlan,
} from "@/lib/bte/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Manual sync to the main BuildTheEarth map, streamed as SSE so the admin
 * panel can show progress on a run that may take minutes.
 *
 * `mode: "plan"` is a dry run: it fetches the current claims, compares every
 * region against them and reports what *would* happen — in particular which
 * regions already exist upstream in exactly the same shape. `mode: "apply"`
 * recomputes that same plan (so it can never act on a stale one) and executes
 * it, deletions included: a region that no longer exists here must not survive
 * on the BTE map.
 *
 * `mode: "clear"` removes *every* claim of the build team and is gated behind
 * a typed confirmation phrase.
 */

const CLEAR_CONFIRMATION = "ALLE CLAIMS LOESCHEN";

const bodySchema = z.object({
    mode: z.enum(["plan", "apply", "clear"]),
    /** Required for `clear`; must match `CLEAR_CONFIRMATION` exactly. */
    confirm: z.string().optional(),
});

/** Concurrent writes against the BTE API — kept low to stay a polite client. */
const APPLY_CONCURRENCY = 3;

interface PlanSummary {
    localTotal: number;
    remoteTotal: number;
    create: number;
    update: number;
    adopt: number;
    unchanged: number;
    deletions: number;
    foreignClaims: number;
}

type SyncEvent =
    | { type: "start"; total: number; summary: PlanSummary }
    | { type: "item"; regionId: string; label: string; action: PlanAction; reasons: string[] }
    | { type: "deletion"; claimId: string; label: string }
    | {
        type: "progress";
        done: number;
        total: number;
        label: string;
        action: PlanAction | "delete";
        success: boolean;
        error?: string;
    }
    | { type: "done"; done: number; total: number; errors: number; summary: PlanSummary }
    | { type: "error"; message: string };

function sse(event: SyncEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

function summarize(plan: SyncPlan): PlanSummary {
    const counts = { create: 0, update: 0, adopt: 0, unchanged: 0 };
    for (const entry of plan.entries) counts[entry.action]++;

    return {
        localTotal: plan.localTotal,
        remoteTotal: plan.remoteTotal,
        ...counts,
        deletions: plan.deletions.length,
        foreignClaims: plan.foreignClaims,
    };
}

const EMPTY_SUMMARY: PlanSummary = {
    localTotal: 0,
    remoteTotal: 0,
    create: 0,
    update: 0,
    adopt: 0,
    unchanged: 0,
    deletions: 0,
    foreignClaims: 0,
};

type Emit = (event: SyncEvent) => void;

/**
 * Removes every claim the build team has on the BTE map, including ones that
 * were created there directly. Runs sequentially — it's the most destructive
 * thing this route can do, so nothing about it should be racy.
 */
async function runClear(emit: Emit): Promise<void> {
    let claims;
    try {
        claims = await listRemoteClaims();
    } catch (err) {
        emit({ type: "error", message: getErrorMessage(err) });
        return;
    }

    const summary: PlanSummary = {
        ...EMPTY_SUMMARY,
        remoteTotal: claims.length,
        deletions: claims.length,
        foreignClaims: claims.filter((claim) => !claim.ours).length,
    };
    emit({ type: "start", total: claims.length, summary });

    let done = 0;
    let errors = 0;

    for (const claim of claims) {
        try {
            await deleteRemoteClaimSummary(claim);
            done++;
            emit({ type: "progress", done, total: claims.length, label: claim.label, action: "delete", success: true });
        } catch (err) {
            done++;
            errors++;
            const message = getErrorMessage(err);
            console.error(`[bte-sync] clear ${claim.claimId} failed:`, message);
            emit({
                type: "progress",
                done,
                total: claims.length,
                label: claim.label,
                action: "delete",
                success: false,
                error: message,
            });
        }
    }

    // Each successful delete already dropped its own mirror row; on a clean
    // run also discard rows whose claim wasn't in the list any more, so the
    // next sync starts from a blank slate.
    if (errors === 0) {
        await clearAllSyncState().catch((err) =>
            console.error("[bte-sync] clearing sync state failed:", getErrorMessage(err)),
        );
    }

    emit({ type: "done", done, total: claims.length, errors, summary });
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session || !hasPermission(session.user.realm_access?.roles ?? [], PERMISSIONS.SYNC_MANAGE)) {
        return new Response("Forbidden", { status: 403 });
    }

    if (!isBteConfigured()) {
        return new Response("BTE-Sync ist nicht konfiguriert.", { status: 400 });
    }

    let mode: "plan" | "apply" | "clear";
    let confirm: string | undefined;
    try {
        ({ mode, confirm } = bodySchema.parse(await request.json()));
    } catch {
        return new Response("Invalid body", { status: 400 });
    }

    if (mode === "clear" && confirm?.trim() !== CLEAR_CONFIRMATION) {
        return new Response("Bestätigung stimmt nicht.", { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const emit = (event: SyncEvent) => controller.enqueue(encoder.encode(sse(event)));

            try {
                if (mode === "clear") {
                    await runClear(emit);
                    return;
                }

                let plan: SyncPlan;
                try {
                    plan = await planFullSync();
                } catch (err) {
                    emit({ type: "error", message: getErrorMessage(err) });
                    return;
                }

                const summary = summarize(plan);
                const pending = plan.entries.filter((entry) => entry.action !== "unchanged");
                const deletions = plan.deletions;
                const total = pending.length + deletions.length;

                emit({ type: "start", total, summary });

                if (mode === "plan") {
                    for (const entry of pending) {
                        emit({
                            type: "item",
                            regionId: entry.regionId,
                            label: entry.label,
                            action: entry.action,
                            reasons: entry.reasons,
                        });
                    }
                    for (const deletion of deletions) {
                        emit({ type: "deletion", claimId: deletion.claimId, label: deletion.label });
                    }
                    emit({ type: "done", done: 0, total, errors: 0, summary });
                    return;
                }

                // Regions that already match upstream need no request — just
                // refresh their local state so later runs can skip them
                // without re-reading the whole claim list.
                const verified = plan.entries.filter((entry) => entry.action === "unchanged");
                for (const entry of verified) {
                    await applyPlanEntry(entry).catch((err) =>
                        console.error(`[bte-sync] state refresh for ${entry.regionId} failed:`, getErrorMessage(err)),
                    );
                }

                let done = 0;
                let errors = 0;
                let next = 0;

                const worker = async () => {
                    while (true) {
                        const index = next++;
                        if (index >= pending.length) return;
                        const entry = pending[index];

                        try {
                            await applyPlanEntry(entry);
                            done++;
                            emit({
                                type: "progress",
                                done,
                                total,
                                label: entry.label,
                                action: entry.action,
                                success: true,
                            });
                        } catch (err) {
                            done++;
                            errors++;
                            const message = getErrorMessage(err);
                            console.error(`[bte-sync] ${entry.action} ${entry.regionId} failed:`, message);
                            emit({
                                type: "progress",
                                done,
                                total,
                                label: entry.label,
                                action: entry.action,
                                success: false,
                                error: message,
                            });
                        }
                    }
                };

                await Promise.all(
                    Array.from({ length: Math.min(APPLY_CONCURRENCY, pending.length) }, () => worker()),
                );

                // Deletions run last and sequentially — they're the only
                // destructive step, so nothing about them should be racy.
                for (const deletion of deletions) {
                    try {
                        await applyPlanDeletion(deletion);
                        done++;
                        emit({ type: "progress", done, total, label: deletion.label, action: "delete", success: true });
                    } catch (err) {
                        done++;
                        errors++;
                        const message = getErrorMessage(err);
                        console.error(`[bte-sync] delete ${deletion.claimId} failed:`, message);
                        emit({
                            type: "progress",
                            done,
                            total,
                            label: deletion.label,
                            action: "delete",
                            success: false,
                            error: message,
                        });
                    }
                }

                emit({ type: "done", done, total, errors, summary });
            } catch (err) {
                console.error("[bte-sync] run failed:", getErrorMessage(err));
                emit({ type: "error", message: getErrorMessage(err) });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
