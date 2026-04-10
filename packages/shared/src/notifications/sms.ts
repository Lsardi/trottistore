/**
 * SMS sending via Brevo transactional SMS API.
 *
 * In dev (no BREVO_API_KEY), SMS content is logged to console.
 *
 * @module @trottistore/shared/notifications/sms
 */
import { sendSmsViaBrevo } from "./transport.js";

const DEFAULT_SMS_SENDER = "TrottiStore";

/**
 * Normalize a French phone number to E.164 format.
 *
 * @example
 * normalizePhone("06 12 34 56 78") // "+33612345678"
 * normalizePhone("+33612345678")   // "+33612345678"
 * normalizePhone("invalid")        // null
 */
export function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-.()]/g, "");

  if (cleaned.startsWith("+") && cleaned.length >= 10) return cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return `+33${cleaned.substring(1)}`;
  if (cleaned.startsWith("33") && cleaned.length === 11) return `+${cleaned}`;

  console.warn(`[sms] Invalid phone format: ${phone}`);
  return null;
}

/**
 * Send an SMS via Brevo. In dev mode (no API key), logs content to console.
 *
 * @param recipient - Phone number (will be normalized to E.164)
 * @param content - SMS text content
 * @param sender - Sender name (max 11 chars for Brevo)
 * @returns true if sent successfully
 */
export async function sendSms(
  recipient: string,
  content: string,
  sender: string = DEFAULT_SMS_SENDER,
): Promise<boolean> {
  const normalized = normalizePhone(recipient);
  if (!normalized) return false;

  if (!process.env.BREVO_API_KEY) {
    console.log(`[sms] Dev log (not sent) to ${normalized}: ${content}`);
    return false;
  }

  const success = await sendSmsViaBrevo({
    sender,
    recipient: normalized,
    content,
    type: "transactional",
  });

  if (success) {
    console.log(`[sms] Sent to ${normalized}`);
  }

  return success;
}
