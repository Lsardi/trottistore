// Next.js instrumentation hook — runs once per server runtime at startup.
// Registers the appropriate Sentry config for the active runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures errors from nested React Server Components.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
