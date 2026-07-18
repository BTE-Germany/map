// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// Sentry is only initialized once the user has granted consent via the cookie
// banner (src/components/common/CookieBanner.tsx). Until then no Sentry
// cookies, session replay or tracing run. When the user accepts mid-session,
// the banner calls initSentry() directly — no reload needed.

import * as Sentry from "@sentry/nextjs";
import { hasAnalyticsConsent } from "@/lib/consent";
import { initSentry } from "@/lib/sentryClient";

if (hasAnalyticsConsent()) {
  initSentry();
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
