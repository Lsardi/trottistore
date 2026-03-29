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
  try {
    await analyticsApi.trackFunnel(type, properties);
  } catch {
    // Tracking must never break UX
  }
}
