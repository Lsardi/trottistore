/**
 * Unified email & SMS transport layer.
 *
 * Provides SMTP (Mailpit in dev, any relay in prod) and Brevo API
 * transports. All services use this instead of duplicating transport logic.
 *
 * Priority: SMTP first → Brevo API fallback → log warning.
 *
 * @module @trottistore/shared/notifications/transport
 */
import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}

export interface BrevoEmailPayload {
  sender: { name: string; email: string };
  to: Array<{ email: string; name?: string }>;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, string>;
}

export interface BrevoSmsPayload {
  sender: string;
  recipient: string;
  content: string;
  type: "transactional";
}

// ---------------------------------------------------------------------------
// SMTP transport (Mailpit in dev, any relay in prod)
// ---------------------------------------------------------------------------

/**
 * Build a nodemailer SMTP transport from environment variables.
 * Returns null if SMTP_HOST is not configured.
 */
export function createSmtpTransport(): ReturnType<typeof nodemailer.createTransport> | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || "1025"),
    secure: false,
    ...(process.env.SMTP_USER
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } }
      : {}),
  });
}

/**
 * Send an email via SMTP.
 * Returns true on success, false on failure (logged, never throws).
 */
export async function sendViaSmtp(
  from: string,
  to: string,
  subject: string,
  content: { html?: string; text?: string },
): Promise<boolean> {
  const transport = createSmtpTransport();
  if (!transport) return false;

  try {
    await transport.sendMail({
      from,
      to,
      subject,
      ...(content.html ? { html: content.html } : {}),
      ...(content.text ? { text: content.text } : {}),
    });
    return true;
  } catch (err) {
    console.error("[notifications] SMTP send failed:", (err as Error).message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Brevo API transport
// ---------------------------------------------------------------------------

const BREVO_API_URL = "https://api.brevo.com/v3";

/**
 * Low-level Brevo API call.
 * Returns true on success, false on failure (logged, never throws).
 */
export async function brevoFetch(path: string, body: unknown): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[notifications] BREVO_API_KEY not set, skipping");
    return false;
  }

  try {
    const res = await fetch(`${BREVO_API_URL}${path}`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[notifications] Brevo ${path} failed: ${res.status} ${text}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[notifications] Brevo request error:", (err as Error).message);
    return false;
  }
}

/**
 * Send an email via Brevo API (HTML content mode).
 */
export async function sendViaBrevo(payload: BrevoEmailPayload): Promise<boolean> {
  return brevoFetch("/smtp/email", payload);
}

/**
 * Send an SMS via Brevo transactional SMS API.
 */
export async function sendSmsViaBrevo(payload: BrevoSmsPayload): Promise<boolean> {
  return brevoFetch("/transactionalSMS/sms", payload);
}
