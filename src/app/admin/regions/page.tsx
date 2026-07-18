import Link from "next/link";
import { LandPlot, PlusIcon } from "lucide-react";
import { getAllRegions } from "@/actions/region/GetRegions";
import getUser from "@/actions/minecraft/user";
import RegionsTable, { type CreatorProfile } from "@/components/admin/regions/RegionsTable";
import { getSession } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

const CREATOR_RESOLVE_CONCURRENCY = 8;

/**
 * Resolve the Minecraft profile (username + avatar) for each distinct creator
 * UUID. Deduplicated and batched so a page full of regions never fans out into
 * hundreds of simultaneous upstream requests; `getUser` caches each profile for
 * 24h, so warm loads resolve instantly.
 */
async function resolveCreatorProfiles(uuids: string[]): Promise<Record<string, CreatorProfile | null>> {
    const unique = [...new Set(uuids.filter(Boolean))];
    const result: Record<string, CreatorProfile | null> = {};

    for (let i = 0; i < unique.length; i += CREATOR_RESOLVE_CONCURRENCY) {
        const batch = unique.slice(i, i + CREATOR_RESOLVE_CONCURRENCY);
        const players = await Promise.all(batch.map((uuid) => getUser(uuid)));
        batch.forEach((uuid, idx) => {
            const player = players[idx];
            result[uuid] = player ? { username: player.username, avatar: player.avatar } : null;
        });
    }

    return result;
}

export default async function AdminRegionsListPage() {
    const [regions, session] = await Promise.all([getAllRegions(), getSession()]);
    const rows = regions ?? [];
    const canEdit = hasPermission(session?.user.realm_access?.roles ?? [], PERMISSIONS.REGIONS_EDIT);
    const creatorProfiles = await resolveCreatorProfiles(rows.map((r) => r.creatorUUID));

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <LandPlot className="size-5 text-primary" />
                        <h1 className="text-2xl font-bold">Regionen</h1>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Alle {rows.length} Regionen verwalten, suchen und bearbeiten.
                    </p>
                </div>
                {canEdit && (
                    <Link
                        href="/admin/regions/create"
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <PlusIcon className="size-4" />
                        Region erstellen
                    </Link>
                )}
            </div>

            <RegionsTable regions={rows} creatorProfiles={creatorProfiles} canEdit={canEdit} />
        </div>
    );
}
