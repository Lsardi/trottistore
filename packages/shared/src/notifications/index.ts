/**
 * Unified notification package for TrottiStore services.
 *
 * Usage:
 *   import { sendEmail } from "@trottistore/shared/notifications";
 *   import { sendSms, normalizePhone } from "@trottistore/shared/notifications";
 *   import { sendViaSmtp, brevoFetch } from "@trottistore/shared/notifications";
 *
 * @module @trottistore/shared/notifications
 */
export { sendEmail } from "./email.js";
export { sendSms, normalizePhone } from "./sms.js";
export {
  createSmtpTransport,
  sendViaSmtp,
  sendViaBrevo,
  sendSmsViaBrevo,
  brevoFetch,
} from "./transport.js";
export type {
  SmtpConfig,
  BrevoEmailPayload,
  BrevoSmsPayload,
} from "./transport.js";
