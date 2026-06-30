import { eq } from "drizzle-orm";
import db from "@/db/drizzle";
import { region } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";

/**
 * Centralised authentication / authorization guards for server actions.
 *
 * Every mutating action previously repeated the same session lookup,
 * `(session.user as any).realm_access` cast and ownership check. Those casts
 * were unnecessary (the fields are declared in `next-auth.d.ts`) and the
 * duplicated logic drifted between call sites. Keeping the rules here means
 * they live in exactly one place.
 */

const UUID_RE =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Throws unless `value` is a syntactically valid UUID. Returns it otherwise. */
export function assertUuid(value: string | null | undefined, label = "ID"): string {
    if (!value || !UUID_RE.test(value)) {
        throw new Error(`Ungültige ${label}.`);
    }
    return value;
}

export interface SessionContext {
    roles: string[];
    userUuid?: string;
    username?: string;
}

/** Requires an authenticated session and returns a normalised context. */
export async function requireSession(): Promise<SessionContext> {
    const session = await getSession();
    if (!session?.user) throw new Error("Nicht angemeldet");
    return {
        roles: session.user.realm_access?.roles ?? [],
        userUuid: session.user.minecraft_uuid,
        username: session.user.preferred_username,
    };
}

/** Requires an authenticated session that holds `permission`. */
export async function requirePermission(permission: Permission): Promise<SessionContext> {
    const ctx = await requireSession();
    if (!hasPermission(ctx.roles, permission)) {
        throw new Error("Keine Berechtigung");
    }
    return ctx;
}

/** Requires a logged-in user with a linked, valid Minecraft UUID. */
export async function requireLinkedUuid(): Promise<string> {
    const ctx = await requireSession();
    return assertUuid(ctx.userUuid, "Minecraft-UUID");
}

export interface RegionAccess {
    userUuid?: string;
    isAdmin: boolean;
    isCreator: boolean;
}

/**
 * Authorizes access to a single region: allowed for the region's creator and
 * for any user holding `permission` (defaults to REGIONS_EDIT semantics passed
 * by the caller). Validates the region id and confirms the region exists.
 */
export async function requireRegionAccess(
    regionId: string,
    permission: Permission,
): Promise<RegionAccess> {
    assertUuid(regionId, "Region-ID");
    const ctx = await requireSession();
    const isAdmin = hasPermission(ctx.roles, permission);

    const existing = await db
        .select({ creatorUUID: region.creatorUUID })
        .from(region)
        .where(eq(region.id, regionId))
        .limit(1)
        .then((r) => r[0]);
    if (!existing) throw new Error("Region nicht gefunden");

    const isCreator = !!ctx.userUuid && existing.creatorUUID === ctx.userUuid;
    if (!isCreator && !isAdmin) throw new Error("Keine Berechtigung");

    return { userUuid: ctx.userUuid, isAdmin, isCreator };
}
