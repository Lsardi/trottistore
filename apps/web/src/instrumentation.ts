// Next.js server/edge instrumentation. Sentry is gated on SENTRY_DSN — when
// unset (local dev, CI, unconfigured environments) this is a no-op. The DSN is
// a secret and must come from the environment, never committed.

export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    });
  }
}

// Captures errors thrown in nested React Server Components.
export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  // @ts-expect-error — forwarding Next's onRequestError tuple to Sentry.
  Sentry.captureRequestError(...args);
}
