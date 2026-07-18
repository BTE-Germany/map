/**
 * Client-side cookie/analytics consent, persisted in localStorage.
 *
 * Consent is opt-in: until the user explicitly accepts via the cookie banner,
 * `getConsent()` returns null and no monitoring (Sentry) is initialized, so no
 * Sentry cookies, session replay or tracing run.
 */

export const CONSENT_STORAGE_KEY = "cookie-consent-v1";
export const CONSENT_EVENT = "cookie-consent-change";

export type ConsentValue = "accepted" | "declined";

/** The stored consent choice, or null if the user hasn't decided yet. */
export function getConsent(): ConsentValue | null {
    if (typeof window === "undefined") return null;
    try {
        const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
        return value === "accepted" || value === "declined" ? value : null;
    } catch {
        return null;
    }
}

/** Whether the user has opted in to analytics/monitoring (Sentry). */
export function hasAnalyticsConsent(): boolean {
    return getConsent() === "accepted";
}

/**
 * Persist the user's choice and notify listeners (e.g. the banner) in the same
 * tab via a custom window event. Fails silently when storage is unavailable
 * (private mode, disabled cookies) — the banner simply reappears next load.
 */
export function setConsent(value: ConsentValue): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    } catch {
        // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}
