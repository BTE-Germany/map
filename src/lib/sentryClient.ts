import * as Sentry from "@sentry/nextjs";

let initialized = false;

/**
 * Initialize the Sentry browser SDK. Deliberately NOT called at module load —
 * only after the user grants consent via the cookie banner — so no Sentry
 * cookies, session replay or tracing happen before opt-in. Idempotent, so it's
 * safe to call from both the instrumentation hook (on load, if already
 * consented) and the banner's accept handler (mid-session).
 */
export function initSentry(): void {
    if (initialized) return;
    initialized = true;

    Sentry.init({
        dsn: "https://0908cbb3c423c306a7bcd2a68bbb306e@errors.dachstein.cloud/8",

        // Add optional integrations for additional features
        integrations: [Sentry.replayIntegration()],

        // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
        tracesSampleRate: 1,

        // Enable logs to be sent to Sentry
        enableLogs: true,

        // Define how likely Replay events are sampled.
        replaysSessionSampleRate: 0.1,

        // Define how likely Replay events are sampled when an error occurs.
        replaysOnErrorSampleRate: 1.0,
    });
}
