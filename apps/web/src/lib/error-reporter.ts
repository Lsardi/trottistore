/**
 * Minimal pluggable error reporter.
 *
 * Business code reports technical failures through `reportError()` without
 * depending on a vendor SDK. The default sink is `console.error`; when the
 * Sentry integration lands (branch claude/sentry), `instrumentation-client.ts`
 * registers Sentry here with `setErrorReporter()` and nothing else changes.
 */
export interface ErrorReport {
  /** Short, stable message — never user data, API bodies or secrets. */
  message: string;
  tags: Record<string, string>;
}

type Reporter = (report: ErrorReport) => void;

let reporter: Reporter = (report) => {
  console.error(`[report] ${report.message}`, report.tags);
};

export function setErrorReporter(next: Reporter): void {
  reporter = next;
}

export function reportError(report: ErrorReport): void {
  try {
    reporter(report);
  } catch {
    // Reporting must never break the flow it observes.
  }
}
