import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison between the inbound x-internal-cron header and the
 * per-process secret nonce generated at service boot. Fails closed on any
 * mismatch (missing header, missing secret, type mismatch, or length mismatch).
 *
 * Used both by:
 *   - services/crm/src/index.ts       (onRequest hook — skips authenticate)
 *   - services/crm/src/routes/triggers/index.ts (route — skips role check)
 *
 * The dual check is defense in depth: even if the hook were misconfigured or
 * bypassed, the route still verifies the secret independently.
 */
export function isInternalCronCall(
  headerValue: unknown,
  secret: string | undefined,
): boolean {
  if (typeof headerValue !== "string" || !secret) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
