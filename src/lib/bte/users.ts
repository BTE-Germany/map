import getUser from "@/actions/minecraft/user";
import type { BteUserRef } from "@/lib/bte/client";
import { isAttributableUuid } from "@/lib/bte/mapping";

/**
 * The BTE API identifies claim owners and builders by `id`, `ssoId`,
 * `discordId` or Minecraft name. We only ever store Minecraft UUIDs, so the
 * name is the one identifier we can produce — resolved through playerdb,
 * which `getUser` already caches for 24h in the Next data cache.
 *
 * Lookups that fail simply yield no reference: attribution is nice to have,
 * but it must never block a claim from reaching the map.
 */

const lookupCache = new Map<string, string | null>();

async function resolveName(uuid: string): Promise<string | null> {
    if (lookupCache.has(uuid)) return lookupCache.get(uuid)!;

    const player = await getUser(uuid).catch(() => null);
    const name = player?.username ?? null;
    lookupCache.set(uuid, name);
    return name;
}

export interface ResolvedClaimUsers {
    owner?: BteUserRef;
    builders?: BteUserRef[];
}

export async function resolveClaimUsers(
    creatorUUID: string,
    builderUUIDs: string[] | null,
    options: { includeOwner?: boolean } = {},
): Promise<ResolvedClaimUsers> {
    const resolved: ResolvedClaimUsers = {};
    // Owner sync off: skip the lookup entirely rather than resolving a name and
    // dropping it afterwards.
    const includeOwner = options.includeOwner ?? true;

    if (includeOwner && isAttributableUuid(creatorUUID)) {
        const name = await resolveName(creatorUUID);
        if (name) resolved.owner = { name };
    }

    const builders = (builderUUIDs ?? []).filter(isAttributableUuid);
    if (builders.length > 0) {
        const names = await Promise.all(builders.map(resolveName));
        const refs = names.filter((n): n is string => !!n).map((name) => ({ name }));
        if (refs.length > 0) resolved.builders = refs;
    }

    return resolved;
}
