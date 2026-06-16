/**
 * Simple email sending — used by services that just need to send HTML emails
 * (e.g., ecommerce: order confirmation, welcome, password reset).
 *
 * For template-based notifications with status tracking, use the SAV
 * notification engine which builds on the shared transport layer.
 *
 * Deliverability tracking: when a service registers an EmailLog store via
 * {@link setEmailLogStore} at boot, every send persists a row (PENDING →
 * SENT/FAILED) and records which provider delivered it. Bounce/complaint
 * status is later updated by the provider webhook. Logging never blocks or
 * fails a send.
 *
 * @module @trottistore/shared/notifications/email
 */
import { sendViaSmtp, sendViaBrevo } from "./transport.js";

const DEFAULT_SENDER_NAME = process.env.MAIL_SENDER_NAME || "TrottiStore";
const DEFAULT_SENDER_EMAIL = process.env.MAIL_FROM || "lyes.sardi@gmail.com";

/**
 * Minimal structural type of a Prisma `emailLog` delegate — kept structural
 * so @trottistore/shared stays decoupled from @trottistore/database.
 */
export interface EmailLogStore {
  emailLog: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
}

let logStore: EmailLogStore | null = null;

/**
 * Register (or clear) the EmailLog persistence store for this process.
 * Call once at service boot after the Prisma client is ready:
 *   setEmailLogStore(app.prisma)
 */
export function setEmailLogStore(store: EmailLogStore | null): void {
  logStore = store;
}

async function createLog(to: string, subject: string): Promise<string | null> {
  if (!logStore) return null;
  try {
    const row = await logStore.emailLog.create({
      data: { toEmail: to, subject, status: "PENDING" },
    });
    return row.id;
  } catch {
    return null; // never block a send on logging
  }
}

async function finalizeLog(
  id: string | null,
  status: "SENT" | "FAILED",
  provider: string | null,
  error?: string,
): Promise<void> {
  if (!id || !logStore) return;
  try {
    await logStore.emailLog.update({
      where: { id },
      data: { status, provider, ...(error ? { error } : {}) },
    });
  } catch {
    /* swallow — logging must never affect send outcome */
  }
}

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

  const logId = await createLog(to, subject);

  // Route 1: SMTP (Mailpit in dev, any SMTP relay in prod)
  const smtpResult = await sendViaSmtp(from, to, subject, { html });
  if (smtpResult) {
    await finalizeLog(logId, "SENT", "smtp");
    return true;
  }

  // Route 2: Brevo API fallback
  const brevoResult = await sendViaBrevo({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });
  if (brevoResult) {
    await finalizeLog(logId, "SENT", "brevo");
    return true;
  }

  await finalizeLog(logId, "FAILED", null, "no SMTP or Brevo transport configured");
  console.warn(`[email] Could not send "${subject}" to ${to} — no SMTP or Brevo configured`);
  return false;
}
