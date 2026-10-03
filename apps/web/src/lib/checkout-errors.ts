import { ApiError } from "./api";
import { reportError } from "./error-reporter";

/**
 * Report a technical checkout failure (order creation, PaymentIntent, Stripe
 * confirmation) so payment outages are visible, without leaking personal or
 * banking data. Client-side 4xx (validation, stock refused) are expected
 * outcomes, not incidents.
 */
export function reportCheckoutError(error: unknown, step: string, orderId: string) {
  if (error instanceof ApiError && error.status < 500) return;
  reportError({
    message: "Checkout technical failure",
    tags: {
      step,
      orderId: orderId || "uncreated",
      kind: error instanceof ApiError ? `http_${error.status}` : error instanceof Error ? error.name : "unknown",
    },
  });
}
