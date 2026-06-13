/**
 * Centralized Sentry error tracking for the backend services.
 *
 * Entirely gated on SENTRY_DSN: when the env var is unset (local dev, CI,
 * any environment without a configured project) every export is a no-op, so
 * there is no behavioral change and no network traffic. The DSN is a secret
 * and must be provided via GitHub Secrets / Railway env, never committed.
 */
import * as Sentry from "@sentry/node";

let enabled = false;

/**
 * Initialize Sentry for a service. Safe to call once at startup; subsequent
 * calls are ignored. No-op when SENTRY_DSN is not set.
 */
export function initSentry(serviceName: string): void {
  if (enabled) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || undefined,
    // Errors only by default — opt into tracing via env to control cost.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    serverName: serviceName,
    initialScope: { tags: { service: serviceName } },
  });
  enabled = true;
}

/**
 * Report an exception to Sentry with optional structured context.
 * No-op when Sentry is not initialized.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Whether Sentry is active (DSN configured and initialized). */
export function isSentryEnabled(): boolean {
  return enabled;
}
