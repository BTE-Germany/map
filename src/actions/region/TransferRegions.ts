"use server";

import { region as regionTable } from "@/db/schema";
import db from "@/db/drizzle";
import { eq } from "drizzle-orm";
import { assertUuid, requirePermission } from "@/lib/guards";
import { PERMISSIONS } from "@/lib/permissions";

// Placeholder UUID for plot/event regions that lose their creator attribution
const SYSTEM_UUID = "00000000-0000-0000-0000-000000000000";

export interface TransferPreview {
    defaultAsCreator: number;   // default regions where source = creator → transfer to target
    plotEventAsCreator: number; // plot/event regions where source = creator → clear attribution
    asBuilder: number;          // regions where source is builder (not creator) → replace/remove
    total: number;
}

export async function previewTransfer(sourceUUID: string, targetUUID: string): Promise<TransferPreview> {
    await requirePermission(PERMISSIONS.REGIONS_EDIT);
    assertUuid(sourceUUID, "Quell-UUID");
    assertUuid(targetUUID, "Ziel-UUID");

    const regions = await db.select({
        id: regionTable.id,
        type: regionTable.type,
        creatorUUID: regionTable.creatorUUID,
        builders: regionTable.builders,
    }).from(regionTable);

    let defaultAsCreator = 0;
    let plotEventAsCreator = 0;
    let asBuilder = 0;

    for (const r of regions) {
        if (r.creatorUUID === sourceUUID) {
            if (r.type === "default") defaultAsCreator++;
            else plotEventAsCreator++;
        } else if ((r.builders ?? []).includes(sourceUUID)) {
            asBuilder++;
        }
    }

    return {
        defaultAsCreator,
        plotEventAsCreator,
        asBuilder,
        total: defaultAsCreator + plotEventAsCreator + asBuilder,
    };
}

export async function executeTransfer(sourceUUID: string, targetUUID: string): Promise<{ transferred: number }> {
    await requirePermission(PERMISSIONS.REGIONS_EDIT);
    assertUuid(sourceUUID, "Quell-UUID");
    assertUuid(targetUUID, "Ziel-UUID");

    // Run the whole reassignment atomically so a mid-loop failure can't leave
    // attribution half-transferred.
    return db.transaction(async (tx) => {
        const regions = await tx.select().from(regionTable);
        let transferred = 0;

        for (const r of regions) {
            if (r.creatorUUID === sourceUUID) {
                if (r.type === "default") {
                    // Transfer to target: update creator, clean up builders
                    const newBuilders = (r.builders ?? [])
                        .filter((u) => u !== sourceUUID && u !== targetUUID);
                    await tx.update(regionTable)
                        .set({ creatorUUID: targetUUID, builders: newBuilders })
                        .where(eq(regionTable.id, r.id));
                } else {
                    // Plot/Event: clear attribution
                    await tx.update(regionTable)
                        .set({ creatorUUID: SYSTEM_UUID, builders: [] })
                        .where(eq(regionTable.id, r.id));
                }
                transferred++;
            } else if ((r.builders ?? []).includes(sourceUUID)) {
                const newBuilders = r.type === "default"
                    ? [...(r.builders ?? []).filter((u) => u !== sourceUUID && u !== targetUUID), targetUUID]
                    : (r.builders ?? []).filter((u) => u !== sourceUUID);
                await tx.update(regionTable)
                    .set({ builders: newBuilders })
                    .where(eq(regionTable.id, r.id));
                transferred++;
            }
        }

        return { transferred };
    });
}
