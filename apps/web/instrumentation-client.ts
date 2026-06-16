// Sentry client-side initialization (browser).
// Loaded automatically by Next.js on the client.
// NO-OP when NEXT_PUBLIC_SENTRY_DSN is absent so the app never crashes.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}

// Required by Next.js App Router to instrument client-side navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
