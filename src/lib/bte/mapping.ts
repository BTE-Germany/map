import { createHash } from "crypto";
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import type { BteClaim, BteClaimPayload, BteUserRef } from "@/lib/bte/client";

/**
 * Translation between our `regions` rows and BTE "claims".
 *
 * Two coordinate conventions meet here: the DB stores closed rings of
 * `[lat, lng]`, the BTE API speaks `stringarray`, i.e. `["lng, lat", ...]`.
 * Everything that crosses the boundary goes through `ringToArea` /
 * `parseArea` so the flip happens in exactly one place.
 */

/** Decimal places kept when serialising coordinates (~1 cm). */
const COORD_PRECISION = 7;

/** Two vertices count as identical below this angular distance (~0.1 m). */
const COORD_EPSILON = 1e-6;

/** Claims whose centroids are closer than this may be the same area. */
const DUPLICATE_CENTER_METERS = 25;

/** …provided their sizes don't differ by more than this ratio. */
const DUPLICATE_AREA_TOLERANCE = 0.1;

/**
 * Grid size for the duplicate lookup index (~110 m at the equator, i.e.
 * comfortably wider than `DUPLICATE_CENTER_METERS`, so a match can never sit
 * further away than the neighbouring cell).
 */
const DUPLICATE_CELL_DEG = 0.001;

const MAX_BUILDER_REFS = 50;

const SYSTEM_UUID = "00000000-0000-0000-0000-000000000000";

/** The subset of a region row the sync needs. */
export interface SyncRegion {
    id: string;
    description: string | null;
    city: string;
    address: string;
    /** Closed ring of `[lat, lng]`. */
    polygon: [number, number][];
    buildings: number;
    finished: boolean;
    creatorUUID: string;
    builders: string[] | null;
}

function round(value: number): number {
    return Number(value.toFixed(COORD_PRECISION));
}

/** Drops a repeated closing vertex so both sides compare ring-for-ring. */
function openRing(ring: [number, number][]): [number, number][] {
    if (ring.length < 2) return ring;
    const [fa, fb] = ring[0];
    const [la, lb] = ring[ring.length - 1];
    return Math.abs(fa - la) < COORD_EPSILON && Math.abs(fb - lb) < COORD_EPSILON
        ? ring.slice(0, -1)
        : ring;
}

/** `[lat, lng][]` (DB) → `["lng, lat", ...]` (BTE). */
export function ringToArea(polygon: [number, number][]): string[] {
    return openRing(polygon).map(([lat, lng]) => `${round(lng)}, ${round(lat)}`);
}

/** `["lng, lat", ...]` (BTE) → `[lng, lat][]`. Unparsable entries are dropped. */
export function parseArea(area: string[] | null | undefined): [number, number][] {
    if (!Array.isArray(area)) return [];

    const parsed: [number, number][] = [];
    for (const entry of area) {
        if (typeof entry !== "string") continue;
        const parts = entry.split(",").map((p) => Number(p.trim()));
        if (parts.length !== 2 || !parts.every(Number.isFinite)) continue;
        parsed.push([parts[0], parts[1]]);
    }
    return openRing(parsed);
}

/** `["lng, lat", ...]` as produced by `ringToArea`, back to `[lng, lat][]`. */
function payloadRing(area: string[]): [number, number][] {
    return parseArea(area);
}

/**
 * The claim name. Our regions have no name column, so the reverse-geocoded
 * address is the closest equivalent; `city` is the fallback for rows whose
 * geocode never resolved.
 */
export function claimName(region: SyncRegion): string {
    const address = region.address?.trim();
    if (address) return address.slice(0, 255);

    const city = region.city?.trim();
    if (city) return city.slice(0, 255);

    return `Region ${region.id.slice(0, 8)}`;
}

export function buildClaimPayload(
    region: SyncRegion,
    users: { owner?: BteUserRef; builders?: BteUserRef[] } = {},
): BteClaimPayload {
    const payload: BteClaimPayload = {
        externalId: region.id,
        name: claimName(region),
        area: ringToArea(region.polygon),
        active: true,
        finished: region.finished,
        description: region.description?.trim() ?? "",
        city: region.city?.trim() ?? "",
        buildings: region.buildings ?? 0,
    };

    if (users.owner) payload.owner = users.owner;
    if (users.builders?.length) payload.builders = users.builders.slice(0, MAX_BUILDER_REFS);

    return payload;
}

/** Minecraft UUIDs whose claims should not carry an owner reference. */
export function isAttributableUuid(uuid: string | null | undefined): boolean {
    return !!uuid && uuid !== SYSTEM_UUID;
}

/**
 * Stable hash of everything we push upstream. Attribution is hashed from the
 * raw Minecraft UUIDs rather than the resolved player names, so deciding
 * whether a region changed never requires a playerdb round-trip — the names
 * are only looked up when a push actually happens.
 *
 * Comparing the stored hash against a freshly built payload answers "has this
 * region changed since the last successful push" offline.
 */
export function fingerprintRegion(payload: BteClaimPayload, region: SyncRegion): string {
    const canonical = JSON.stringify([
        payload.externalId,
        payload.name,
        payload.description ?? "",
        payload.city ?? "",
        payload.buildings ?? 0,
        payload.active,
        payload.finished,
        payload.area,
        region.creatorUUID,
        [...(region.builders ?? [])].sort(),
    ]);
    return createHash("sha256").update(canonical).digest("hex");
}

function sameRing(a: [number, number][], b: [number, number][]): boolean {
    if (a.length !== b.length) return false;
    return a.every(
        ([ax, ay], i) => Math.abs(ax - b[i][0]) < COORD_EPSILON && Math.abs(ay - b[i][1]) < COORD_EPSILON,
    );
}

/** True when the payload's ring and the claim's area describe the same shape. */
export function isSameGeometry(payload: BteClaimPayload, claim: BteClaim): boolean {
    return sameRing(payloadRing(payload.area), parseArea(claim.area));
}

/**
 * Field-by-field comparison against a claim that already exists upstream.
 * An empty result means "the region is already on the BTE map exactly like
 * this" — the check the manual sync runs before touching anything.
 *
 * Only fields the API documents as part of a claim are compared; owner and
 * builders are covered by the fingerprint instead.
 */
export function diffClaim(payload: BteClaimPayload, claim: BteClaim): string[] {
    const changed: string[] = [];

    if ((claim.name ?? "") !== payload.name) changed.push("Name");
    if ((claim.city ?? "") !== (payload.city ?? "")) changed.push("Stadt");
    if ((claim.description ?? "") !== (payload.description ?? "")) changed.push("Beschreibung");
    if ((claim.buildings ?? 0) !== (payload.buildings ?? 0)) changed.push("Gebäude");
    if (Boolean(claim.finished) !== payload.finished) changed.push("Fertig");
    if (claim.active != null && Boolean(claim.active) !== payload.active) changed.push("Aktiv");
    if (!isSameGeometry(payload, claim)) changed.push("Polygon");

    return changed;
}

function ringToTurfPolygon(ring: [number, number][]): Feature<Polygon> | null {
    if (ring.length < 3) return null;
    try {
        return turf.polygon([[...ring, ring[0]]]);
    } catch {
        return null;
    }
}

/**
 * Pre-computed geometry of one area, so the duplicate search can compare
 * thousands of pairs without re-running turf for each of them.
 */
export interface AreaShape {
    /** `[lng, lat]` */
    centroid: [number, number];
    /** Square metres. */
    size: number;
    ring: [number, number][];
}

export function describeRing(ring: [number, number][]): AreaShape | null {
    const polygon = ringToTurfPolygon(ring);
    if (!polygon) return null;

    const size = turf.area(polygon);
    if (size <= 0) return null;

    const center = turf.centroid(polygon).geometry.coordinates;
    return { centroid: [center[0], center[1]], size, ring };
}

export function describePayload(payload: BteClaimPayload): AreaShape | null {
    return describeRing(payloadRing(payload.area));
}

export function describeClaim(claim: BteClaim): AreaShape | null {
    return describeRing(parseArea(claim.area));
}

/** Grid cell of a shape's centroid — the key for the duplicate lookup index. */
export function areaCell(shape: AreaShape, cellDegrees = DUPLICATE_CELL_DEG): string {
    return `${Math.floor(shape.centroid[0] / cellDegrees)}:${Math.floor(shape.centroid[1] / cellDegrees)}`;
}

/** All grid keys that could hold a match for `shape` (its cell plus neighbours). */
export function areaCellNeighbourhood(shape: AreaShape, cellDegrees = DUPLICATE_CELL_DEG): string[] {
    const x = Math.floor(shape.centroid[0] / cellDegrees);
    const y = Math.floor(shape.centroid[1] / cellDegrees);

    const keys: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) keys.push(`${x + dx}:${y + dy}`);
    }
    return keys;
}

/**
 * Heuristic duplicate check for claims that predate the sync (or were created
 * by hand on the BTE side) and therefore carry no `externalId`: same spot,
 * same rough size. Used to adopt such a claim instead of creating a second one
 * on top of it.
 */
export function shapesMatch(a: AreaShape, b: AreaShape): boolean {
    if (sameRing(a.ring, b.ring)) return true;

    const distance = turf.distance(turf.point(a.centroid), turf.point(b.centroid), { units: "meters" });
    if (distance > DUPLICATE_CENTER_METERS) return false;

    return Math.abs(a.size - b.size) / Math.max(a.size, b.size) <= DUPLICATE_AREA_TOLERANCE;
}

/** Convenience wrapper over `shapesMatch` for one-off comparisons. */
export function looksLikeSameArea(payload: BteClaimPayload, claim: BteClaim): boolean {
    const ours = describePayload(payload);
    const theirs = describeClaim(claim);
    return !!ours && !!theirs && shapesMatch(ours, theirs);
}
