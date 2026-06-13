// Client-side Sentry init. Gated on the public DSN — no-op when unset.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    tracesSampleRate: 0,
  });
}

// Surfaces client-side navigation errors to Sentry when enabled.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
