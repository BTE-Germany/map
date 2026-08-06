/**
 * Deploy-time configuration for the sync to the main BuildTheEarth map.
 *
 *   BTE_TEAM_TOKEN   Team token (Bearer). Handed out to team owners via Discord.
 *   BTE_TEAM_SLUG    Build team slug, e.g. "de" — used with `?slug=true`.
 *   BTE_TEAM_ID      Build team UUID. Takes precedence over the slug.
 *   BTE_API_URL      API root, defaults to the production instance.
 *
 * The runtime on/off switch lives in the DB (see `SETTINGS.BTE_AUTO_SYNC`) so
 * admins can pause the sync without a redeploy; this module only answers
 * "do we have credentials at all".
 */

const DEFAULT_BASE_URL = "https://api.buildtheearth.net/api/v1";

export interface BteConfig {
    baseUrl: string;
    /** Either the team UUID or its slug, depending on `useSlug`. */
    team: string;
    useSlug: boolean;
    token: string;
}

export interface BteConfigStatus {
    configured: boolean;
    baseUrl: string;
    team: string | null;
    useSlug: boolean;
    hasToken: boolean;
}

function readBaseUrl(): string {
    const raw = process.env.BTE_API_URL?.trim();
    return (raw && raw.length > 0 ? raw : DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function readTeam(): { team: string; useSlug: boolean } | null {
    const id = process.env.BTE_TEAM_ID?.trim();
    if (id) return { team: id, useSlug: false };

    const slug = process.env.BTE_TEAM_SLUG?.trim();
    if (slug) return { team: slug, useSlug: true };

    return null;
}

export function getBteConfig(): BteConfig | null {
    const token = process.env.BTE_TEAM_TOKEN?.trim();
    const team = readTeam();
    if (!token || !team) return null;

    return { baseUrl: readBaseUrl(), token, ...team };
}

export function requireBteConfig(): BteConfig {
    const config = getBteConfig();
    if (!config) {
        throw new Error(
            "BTE-Sync ist nicht konfiguriert — BTE_TEAM_TOKEN und BTE_TEAM_SLUG (oder BTE_TEAM_ID) fehlen.",
        );
    }
    return config;
}

/** Credential-free view of the configuration, safe to send to the admin UI. */
export function getBteConfigStatus(): BteConfigStatus {
    const team = readTeam();
    return {
        configured: !!process.env.BTE_TEAM_TOKEN?.trim() && !!team,
        baseUrl: readBaseUrl(),
        team: team?.team ?? null,
        useSlug: team?.useSlug ?? false,
        hasToken: !!process.env.BTE_TEAM_TOKEN?.trim(),
    };
}
