import { analyticsApi } from "@/lib/api";

export type FunnelEventType =
  | "diagnostic_category_selected"
  | "diagnostic_result_viewed"
  | "diagnostic_ticket_cta_clicked"
  | "urgence_slots_loaded"
  | "urgence_ticket_created"
  | "repair_tracking_viewed";

export async function trackFunnelEvent(
  type: FunnelEventType,
  properties?: Record<string, string | number | boolean | null>,
) {
  if (typeof window === "undefined") return;
  // GDPR: Only track if user consented to analytics cookies
  try {
    const consent = JSON.parse(localStorage.getItem("cookie-consent") || "{}");
    if (!consent.analytics) return;
  } catch {
    return; // No consent or invalid consent — don't track
  }
  try {
    await analyticsApi.trackFunnel(type, properties);
  } catch {
    // Tracking must never break UX
  }
}
