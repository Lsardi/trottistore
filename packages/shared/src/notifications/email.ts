/**
 * Simple email sending — used by services that just need to send HTML emails
 * (e.g., ecommerce: order confirmation, welcome, password reset).
 *
 * For template-based notifications with status tracking, use the SAV
 * notification engine which builds on the shared transport layer.
 *
 * @module @trottistore/shared/notifications/email
 */
import { sendViaSmtp, sendViaBrevo } from "./transport.js";

const DEFAULT_SENDER_NAME = "TrottiStore";
const DEFAULT_SENDER_EMAIL = "commandes@trottistore.fr";

/**
 * Send an HTML email with SMTP → Brevo fallback.
 *
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param html - HTML email body
 * @param options - Optional sender override
 * @returns true if sent successfully via any transport
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options?: { senderName?: string; senderEmail?: string },
): Promise<boolean> {
  const senderName = options?.senderName ?? process.env.MAIL_SENDER_NAME ?? DEFAULT_SENDER_NAME;
  const senderEmail = options?.senderEmail ?? process.env.MAIL_FROM ?? DEFAULT_SENDER_EMAIL;
  const from = `${senderName} <${senderEmail}>`;

  // Route 1: SMTP (Mailpit in dev, any SMTP relay in prod)
  const smtpResult = await sendViaSmtp(from, to, subject, { html });
  if (smtpResult) return true;

  // Route 2: Brevo API fallback
  const brevoResult = await sendViaBrevo({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });
  if (brevoResult) return true;

  console.warn(`[email] Could not send "${subject}" to ${to} — no SMTP or Brevo configured`);
  return false;
}
