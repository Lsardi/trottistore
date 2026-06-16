"use client";

import { useReportWebVitals } from "next/web-vitals";
import * as Sentry from "@sentry/nextjs";

/**
 * Reports Core Web Vitals (LCP, CLS, INP, FCP, TTFB, ...).
 * - When Sentry is active, metrics are sent as distribution measurements.
 * - Otherwise, in development, they are logged via console.debug.
 * Renders nothing.
 */
export default function WebVitals() {
  useReportWebVitals((metric) => {
    const client = Sentry.getClient();

    if (client) {
      // Sentry distributions: milliseconds for timing metrics, unitless for CLS.
      const unit = metric.name === "CLS" ? "none" : "millisecond";
      Sentry.metrics.distribution(`web-vitals.${metric.name.toLowerCase()}`, metric.value, {
        unit,
        attributes: { rating: metric.rating, navigationType: metric.navigationType },
      });
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.debug("[web-vitals]", metric.name, metric.value, metric.rating);
    }
  });

  return null;
}
