import { normalizeMinecraftUuid } from "@/lib/minecraftUuid";

export interface Player {
    meta:         Meta;
    username:     string;
    id:           string;
    raw_id:       string;
    avatar:       string;
    skin_texture: string;
    properties:   Property[];
    name_history: unknown[];
}

export interface Meta {
    cached_at: number;
}

export interface Property {
    name:      string;
    value:     string;
    signature: string;
}

// Minecraft usernames: 1–16 characters, letters/digits/underscore only. Used
// to allow name lookups while still restricting what gets interpolated into the
// upstream URL (path injection / SSRF guard).
const MINECRAFT_USERNAME_RE = /^[a-zA-Z0-9_]{1,16}$/;

export default async function getUser(identifier: string): Promise<Player | null> {
    // Accept either a Minecraft UUID (any representation) or a plain username.
    // Validate before interpolating into the upstream URL (prevents path
    // injection / SSRF via a crafted identifier). playerdb resolves both forms
    // at the same endpoint.
    const trimmed = identifier?.trim() ?? "";
    const normalizedUuid = normalizeMinecraftUuid(trimmed);
    const lookup = normalizedUuid ?? (MINECRAFT_USERNAME_RE.test(trimmed) ? trimmed : null);
    if (!lookup) return null;

    try {
        // Minecraft profiles change rarely, so cache for 24h in the Next Data
        // Cache (server) — this collapses the per-builder N+1 to ~1 upstream
        // request per UUID per day instead of K+1 on every region page view.
        // NOTE: deliberately no AbortSignal here — passing a signal makes Next
        // treat the fetch as uncacheable. Responsiveness is bounded with a race
        // that degrades to null instead, so a hung upstream can't stall a render.
        const res = await Promise.race([
            fetch(
                `https://playerdb.co/api/player/minecraft/${encodeURIComponent(lookup)}`,
                { next: { revalidate: 86400 } },
            ),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (!res || !res.ok) return null;
        const data = await res.json();
        if (data?.code !== "player.found") return null;

        const player = data.data.player as Player;
        // playerdb returns `raw_id` without dashes, but the rest of the app —
        // the Postgres `uuid` columns, `assertUuid` and the builder lookups —
        // uses the canonical dashed form. Normalize it here so a searched
        // creator/builder can be saved without failing UUID validation.
        const canonical = normalizeMinecraftUuid(player.raw_id);
        if (canonical) player.raw_id = canonical;
        return player;
    } catch {
        return null;
    }
}
