import type { StyleSpecification } from "maplibre-gl";
import type { GoogleMapType } from "@/lib/mapStyles";
import { getPublicRuntimeConfig } from "@/lib/publicRuntimeConfig";

/**
 * Google's satellite and hybrid imagery for maplibre, via the Map Tiles API.
 *
 * Unlike a style.json, Google's 2D tiles cannot simply be pointed at: every
 * tile request needs a session token, minted per map type and valid for about
 * two weeks.
 *
 * The token is minted *in the browser*, not on the server: the Google key this
 * app uses is restricted by HTTP referrer, and a server-side call has no
 * referrer — Google answers `API_KEY_HTTP_REFERRER_BLOCKED`. The browser can
 * mint it (verified: `createSession` answers cross-origin), and because the
 * token outlives a session by two weeks it is cached in localStorage, so this
 * costs roughly one request per visitor per fortnight.
 *
 * The key travels in the tile URL — that is how Google's tile endpoints work.
 * It is the same browser key the Maps JS SDK already uses here and must stay
 * restricted by referrer on the Google side.
 */

const TILES_HOST = "https://tile.googleapis.com";
const SOURCE_ID = "google-tiles";
const STORAGE_PREFIX = "google-tile-session:";

/** Re-mint this long before the token actually expires. */
const EXPIRY_MARGIN_MS = 30 * 60 * 1000;

export interface GoogleTileSession {
    session: string;
    /** Unix milliseconds. */
    expiresAt: number;
    tileSize: number;
}

const pending = new Map<GoogleMapType, Promise<GoogleTileSession>>();
const memory = new Map<GoogleMapType, GoogleTileSession>();

function isUsable(session: GoogleTileSession | undefined | null): session is GoogleTileSession {
    return !!session
        && typeof session.session === "string"
        && session.expiresAt - Date.now() > EXPIRY_MARGIN_MS;
}

function readStoredSession(mapType: GoogleMapType): GoogleTileSession | null {
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${mapType}`);
        return raw ? (JSON.parse(raw) as GoogleTileSession) : null;
    } catch {
        return null;
    }
}

function storeSession(mapType: GoogleMapType, session: GoogleTileSession): void {
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${mapType}`, JSON.stringify(session));
    } catch {
        // A full or blocked storage only costs us the cache, not the feature.
    }
}

async function createSession(mapType: GoogleMapType, apiKey: string): Promise<GoogleTileSession> {
    const response = await fetch(`${TILES_HOST}/v1/createSession?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            mapType: "satellite",
            // Hybrid is the same imagery with Google's road layer on top.
            ...(mapType === "hybrid" ? { layerTypes: ["layerRoadmap"] } : {}),
            language: "de-DE",
            region: "DE",
        }),
    });

    const body = await response.text();
    if (!response.ok) {
        throw new Error(describeSessionError(response.status, body));
    }

    const data = JSON.parse(body) as { session?: string; expiry?: string; tileWidth?: number };
    if (!data.session) {
        throw new Error("Google lieferte kein Session-Token.");
    }

    // `expiry` is Unix *seconds* as a string. Falling back to an hour keeps a
    // changed response shape from pinning a token forever.
    const expirySeconds = Number(data.expiry);
    const expiresAt = Number.isFinite(expirySeconds) && expirySeconds > 0
        ? expirySeconds * 1000
        : Date.now() + 60 * 60 * 1000;

    return { session: data.session, expiresAt, tileSize: data.tileWidth ?? 256 };
}

/** Turns Google's error envelope into something actionable in a toast. */
function describeSessionError(status: number, body: string): string {
    let reason = "";
    try {
        const parsed = JSON.parse(body) as {
            error?: { message?: string; details?: { reason?: string }[] };
        };
        reason = parsed.error?.details?.find((detail) => detail.reason)?.reason
            ?? parsed.error?.message
            ?? "";
    } catch {
        reason = body.slice(0, 200);
    }

    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
        return "Der Google-API-Key erlaubt diese Domain nicht.";
    }
    if (/blocked|SERVICE_DISABLED|API_KEY_SERVICE_BLOCKED/i.test(reason)) {
        return "Die Map Tiles API ist für diesen Google-API-Key nicht freigegeben.";
    }
    return `Google-Kartensitzung fehlgeschlagen (${status}): ${reason}`.trim();
}

export function getGoogleTileSession(
    mapType: GoogleMapType,
    apiKey: string,
): Promise<GoogleTileSession> {
    const cached = memory.get(mapType) ?? readStoredSession(mapType);
    if (isUsable(cached)) {
        memory.set(mapType, cached);
        return Promise.resolve(cached);
    }

    const inFlight = pending.get(mapType);
    if (inFlight) return inFlight;

    const request = createSession(mapType, apiKey)
        .then((session) => {
            memory.set(mapType, session);
            storeSession(mapType, session);
            return session;
        })
        .finally(() => {
            pending.delete(mapType);
        });

    pending.set(mapType, request);
    return request;
}

export function buildGoogleRasterStyle(
    session: GoogleTileSession,
    apiKey: string,
): StyleSpecification {
    const tileUrl =
        `${TILES_HOST}/v1/2dtiles/{z}/{x}/{y}` +
        `?session=${encodeURIComponent(session.session)}&key=${encodeURIComponent(apiKey)}`;

    // No glyphs or sprite: the imagery is a single raster layer, and everything
    // this app draws on top of it (regions, the shape editor, its snapping
    // targets) is fill/line/circle — players are DOM markers. Adding a symbol
    // layer to the map later would mean adding a glyphs URL here.
    return {
        version: 8,
        sources: {
            [SOURCE_ID]: {
                type: "raster",
                tiles: [tileUrl],
                tileSize: session.tileSize,
                minzoom: 0,
                maxzoom: 22,
                attribution: "© Google",
            },
        },
        layers: [
            {
                id: SOURCE_ID,
                type: "raster",
                source: SOURCE_ID,
            },
        ],
    };
}

/** The style for one of the Google map types, ready to hand to maplibre. */
export async function resolveGoogleMapStyle(mapType: GoogleMapType): Promise<StyleSpecification> {
    const { googleMapsApiKey } = await getPublicRuntimeConfig();
    if (!googleMapsApiKey) {
        throw new Error("Google-Maps-API-Key ist nicht konfiguriert.");
    }

    const session = await getGoogleTileSession(mapType, googleMapsApiKey);
    return buildGoogleRasterStyle(session, googleMapsApiKey);
}

export interface ViewportBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

/**
 * The copyright line Google wants displayed for what is currently on screen —
 * it names the imagery owners, which differ per area and zoom.
 *
 * Best effort by design: any failure returns null and the caller keeps showing
 * the static "© Google" attribution rather than an empty credit.
 */
export async function fetchGoogleTileCopyright(
    mapType: GoogleMapType,
    bounds: ViewportBounds,
    zoom: number,
): Promise<string | null> {
    try {
        const { googleMapsApiKey } = await getPublicRuntimeConfig();
        if (!googleMapsApiKey) return null;

        const session = await getGoogleTileSession(mapType, googleMapsApiKey);
        const params = new URLSearchParams({
            session: session.session,
            key: googleMapsApiKey,
            zoom: String(Math.max(0, Math.round(zoom))),
            north: String(bounds.north),
            south: String(bounds.south),
            east: String(bounds.east),
            west: String(bounds.west),
        });

        const response = await fetch(`${TILES_HOST}/tile/v1/viewport?${params.toString()}`);
        if (!response.ok) return null;

        const data = (await response.json()) as { copyright?: string };
        return data.copyright?.trim() || null;
    } catch {
        return null;
    }
}
