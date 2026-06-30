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

const UUID_RE =
    /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;

export default async function getUser(uuid: string): Promise<Player | null> {
    // Validate before interpolating into the upstream URL (prevents path
    // injection / SSRF via a crafted "uuid").
    if (!uuid || !UUID_RE.test(uuid)) return null;

    try {
        // Minecraft profiles change rarely, so cache for 24h in the Next Data
        // Cache (server) — this collapses the per-builder N+1 to ~1 upstream
        // request per UUID per day instead of K+1 on every region page view.
        // NOTE: deliberately no AbortSignal here — passing a signal makes Next
        // treat the fetch as uncacheable. Responsiveness is bounded with a race
        // that degrades to null instead, so a hung upstream can't stall a render.
        const res = await Promise.race([
            fetch(
                `https://playerdb.co/api/player/minecraft/${encodeURIComponent(uuid)}`,
                { next: { revalidate: 86400 } },
            ),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (!res || !res.ok) return null;
        const data = await res.json();
        if (data?.code === "player.found") return data.data.player as Player;
        return null;
    } catch {
        return null;
    }
}
