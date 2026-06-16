// Sentry edge-runtime initialization (middleware, edge routes).
// Loaded via instrumentation.ts -> register().
// NO-OP when SENTRY_DSN is absent so local/dev/CI builds never crash.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}
