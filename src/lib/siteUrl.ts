/**
 * Canonical public base URL of the app.
 *
 * Used as Next.js's `metadataBase` so file-based/relative metadata URLs — most
 * importantly the region `opengraph-image` route — resolve to ABSOLUTE URLs on
 * the deployed domain instead of defaulting to `http://localhost:3000`.
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_SITE_URL   — explicit override (set this in deployment)
 *  2. NEXTAUTH_URL           — NextAuth already requires this to be the site's
 *                              canonical URL in production, so it's a safe default
 *  3. http://localhost:3000  — local dev fallback
 */
export function getSiteUrl(): string {
    const raw =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXTAUTH_URL ||
        "http://localhost:3000";
    return raw.replace(/\/+$/, "");
}
