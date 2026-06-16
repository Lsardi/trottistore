/**
 * Shared Sentry initialization for backend Fastify services.
 *
 * No-op when SENTRY_DSN is unset (dev/test), so services run unchanged
 * without observability credentials. Call initSentry() once at process
 * start, before building the Fastify app.
 *
 * @module @trottistore/shared/observability/sentry
 */
import * as Sentry from "@sentry/node";

let initialized = false;

/**
 * Initialize Sentry for a backend service. Safe no-op if SENTRY_DSN is absent.
 *
 * @param serviceName - logical service name, tagged on every event
 * @returns true if Sentry was actually initialized
 */
export function initSentry(serviceName: string): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || initialized) return false;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA,
    // Conservative perf sampling for a small team — tune via env.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    initialScope: { tags: { service: serviceName } },
  });
  initialized = true;
  return true;
}

/** True if Sentry was initialized this process. */
export function sentryEnabled(): boolean {
  return initialized;
}

/**
 * Report a server-side error to Sentry (no-op if not initialized).
 * Attaches request correlation tags when provided.
 */
export function captureError(
  error: unknown,
  context?: { requestId?: string; method?: string; url?: string; userId?: string },
): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context?.requestId) scope.setTag("request_id", context.requestId);
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.method || context?.url) {
      scope.setContext("request", { method: context.method, url: context.url });
    }
    Sentry.captureException(error);
  });
}

export { Sentry };
