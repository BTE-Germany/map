import { requireBteConfig } from "@/lib/bte/config";

/**
 * Thin client for the "Token based" claim endpoints of the BuildTheEarth
 * website backend (https://buildtheearth.github.io/website-node-backend/).
 *
 * All routes live under `/public/buildteams/{team}/claims` and authenticate
 * with the team token. Coordinates are exchanged as `stringarray`, i.e.
 * `["lng, lat", ...]` — the format the API returns natively.
 */

const TIMEOUT_MS = 20_000;

/** A claim as returned by the API. Only the fields we actually rely on. */
export interface BteClaim {
    id: string;
    externalId?: string | null;
    ownerId?: string | null;
    /** `["lng, lat", ...]` */
    area?: string[] | null;
    center?: string | null;
    size?: number | null;
    buildings?: number | null;
    active?: boolean | null;
    finished?: boolean | null;
    name?: string | null;
    description?: string | null;
    city?: string | null;
    osmName?: string | null;
    buildTeamId?: string | null;
    createdAt?: string | null;
}

export interface BteUserRef {
    id?: string;
    ssoId?: string;
    discordId?: string;
    name?: string;
}

export interface BteClaimPayload {
    externalId: string;
    name: string;
    area: string[];
    active: boolean;
    finished: boolean;
    description?: string;
    city?: string;
    buildings?: number;
    owner?: BteUserRef;
    builders?: BteUserRef[];
}

export class BteApiError extends Error {
    readonly status: number;
    readonly body: string;

    constructor(status: number, message: string, body: string) {
        super(message);
        this.name = "BteApiError";
        this.status = status;
        this.body = body;
    }
}

/** Pulls a human-readable message out of the API's `Error` response shape. */
function describeError(status: number, raw: string): string {
    try {
        const parsed = JSON.parse(raw);
        const fieldErrors: string | undefined = Array.isArray(parsed?.errors)
            ? parsed.errors
                .map((e: { msg?: string; path?: string }) => [e.path, e.msg].filter(Boolean).join(": "))
                .filter(Boolean)
                .join(", ")
            : undefined;

        const message = [parsed?.message, fieldErrors].filter(Boolean).join(" — ");
        if (message) return `HTTP ${status}: ${message}`;
    } catch {
        // fall through to the raw body
    }
    const trimmed = raw.trim().slice(0, 300);
    return trimmed ? `HTTP ${status}: ${trimmed}` : `HTTP ${status}`;
}

async function bteFetch<T>(
    path: string,
    init: RequestInit & { query?: Record<string, string> } = {},
): Promise<T> {
    const config = requireBteConfig();
    const { query, ...requestInit } = init;

    const url = new URL(`${config.baseUrl}${path}`);
    if (config.useSlug) url.searchParams.set("slug", "true");
    for (const [key, value] of Object.entries(query ?? {})) {
        url.searchParams.set(key, value);
    }

    const res = await fetch(url, {
        ...requestInit,
        headers: {
            authorization: `Bearer ${config.token}`,
            accept: "application/json",
            ...(requestInit.body ? { "content-type": "application/json" } : {}),
            ...requestInit.headers,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) {
        throw new BteApiError(res.status, describeError(res.status, text), text);
    }

    if (!text.trim()) return undefined as T;
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new BteApiError(res.status, "Antwort der BTE-API ist kein gültiges JSON.", text);
    }
}

function claimsPath(): string {
    const { team } = requireBteConfig();
    return `/public/buildteams/${encodeURIComponent(team)}/claims`;
}

/**
 * All claims of our build team. The endpoint has been observed to answer with
 * a bare array; wrapper shapes are tolerated so a backend change doesn't turn
 * a full sync into a "delete everything" plan.
 */
export async function listClaims(): Promise<BteClaim[]> {
    const data = await bteFetch<unknown>(claimsPath(), { query: { withBuilders: "true" } });

    if (Array.isArray(data)) return data as BteClaim[];
    for (const key of ["claims", "data", "results"] as const) {
        const nested = (data as Record<string, unknown> | null)?.[key];
        if (Array.isArray(nested)) return nested as BteClaim[];
    }
    throw new BteApiError(200, "Unerwartete Antwort beim Laden der Claims.", JSON.stringify(data).slice(0, 300));
}

export async function createClaim(payload: BteClaimPayload): Promise<BteClaim> {
    return bteFetch<BteClaim>(`${claimsPath()}?skipOSM=true`, {
        method: "POST",
        query: { coordType: "stringarray" },
        body: JSON.stringify(payload),
    });
}

/** Update the claim whose `externalId` equals our region id. */
export async function updateClaimByExternalId(externalId: string, payload: BteClaimPayload): Promise<BteClaim> {
    return bteFetch<BteClaim>(`${claimsPath()}/${encodeURIComponent(externalId)}`, {
        method: "PUT",
        query: { external: "true", coordType: "stringarray" },
        body: JSON.stringify(payload),
    });
}

/**
 * Update a claim by its BTE-side id. Used to adopt a claim that already
 * exists upstream but doesn't carry our `externalId` yet.
 */
export async function updateClaimById(claimId: string, payload: BteClaimPayload): Promise<BteClaim> {
    return bteFetch<BteClaim>(`${claimsPath()}/${encodeURIComponent(claimId)}`, {
        method: "PUT",
        query: { coordType: "stringarray" },
        body: JSON.stringify(payload),
    });
}

export async function deleteClaimByExternalId(externalId: string): Promise<void> {
    await bteFetch<unknown>(`${claimsPath()}/${encodeURIComponent(externalId)}`, {
        method: "DELETE",
        query: { external: "true" },
    });
}

export async function deleteClaimById(claimId: string): Promise<void> {
    await bteFetch<unknown>(`${claimsPath()}/${encodeURIComponent(claimId)}`, { method: "DELETE" });
}
