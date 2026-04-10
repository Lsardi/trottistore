/**
 * Notification engine for SAV status changes.
 *
 * Uses the shared transport layer (@trottistore/shared/notifications)
 * for email (SMTP/Brevo) and SMS (Brevo) delivery.
 *
 * This module owns:
 * - SAV-specific templates (per repair status)
 * - Notification dispatch logic (which status triggers what)
 * - The notifyStatusChange() entry point
 *
 * Feature flag: FEATURE_AUTO_NOTIFICATIONS (default: false)
 */
import {
  sendViaSmtp,
  sendViaBrevo,
  sendSms,
  normalizePhone,
} from "@trottistore/shared/notifications";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPayload {
  ticketId: string;
  ticketNumber: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  productModel: string;
  trackingToken: string;
  fromStatus: string;
  toStatus: string;
  estimatedCost?: number | null;
  estimatedDays?: number | null;
  performedBy?: string | null;
}

export interface NotificationTemplate {
  emailTemplateId: string | null;
  smsContent: string | null;
  subject: string;
}

export interface NotificationResult {
  email: boolean;
  sms: boolean;
  status: string;
  ticketId: string;
  customerEmail: string | null;
  customerPhone: string | null;
}

// ---------------------------------------------------------------------------
// Template mapping per status transition
// ---------------------------------------------------------------------------

const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  RECU: {
    emailTemplateId: process.env.BREVO_TPL_RECEPTION ?? null,
    smsContent: "TrottiStore: Votre {productModel} a ete receptionne. Suivez votre reparation: {trackingUrl}",
    subject: "Confirmation de reception — TrottiStore SAV",
  },
  DIAGNOSTIC: {
    emailTemplateId: process.env.BREVO_TPL_DIAGNOSTIC ?? null,
    smsContent: "TrottiStore: Le diagnostic de votre {productModel} est en cours. Suivi: {trackingUrl}",
    subject: "Diagnostic en cours — TrottiStore SAV",
  },
  DEVIS_ENVOYE: {
    emailTemplateId: process.env.BREVO_TPL_DEVIS ?? null,
    smsContent: "TrottiStore: Un devis de {estimatedCost}EUR est disponible pour votre {productModel}. Validez ici: {trackingUrl}",
    subject: "Devis disponible — TrottiStore SAV",
  },
  DEVIS_ACCEPTE: {
    emailTemplateId: process.env.BREVO_TPL_DEVIS_OK ?? null,
    smsContent: null,
    subject: "Devis accepte — TrottiStore SAV",
  },
  EN_REPARATION: {
    emailTemplateId: process.env.BREVO_TPL_REPARATION ?? null,
    smsContent: "TrottiStore: Votre {productModel} est en cours de reparation. Suivi: {trackingUrl}",
    subject: "Reparation en cours — TrottiStore SAV",
  },
  PRET: {
    emailTemplateId: process.env.BREVO_TPL_PRET ?? null,
    smsContent: "TrottiStore: Votre {productModel} est pret! Venez le recuperer au magasin. {trackingUrl}",
    subject: "Reparation terminee — Votre trottinette vous attend!",
  },
  RECUPERE: {
    emailTemplateId: process.env.BREVO_TPL_RECUPERE ?? null,
    smsContent: null,
    subject: "Merci — TrottiStore SAV",
  },
};

/** Status transitions that should NOT trigger notifications. */
const SILENT_TRANSITIONS = new Set(["EN_ATTENTE_PIECE", "REFUS_CLIENT", "IRREPARABLE"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function buildTrackingUrl(token: string): string {
  const base = process.env.BASE_URL || "https://trottistore.fr";
  return `${base}/mon-compte/suivi/${token}`;
}

export function shouldNotify(toStatus: string): boolean {
  if (process.env.FEATURE_AUTO_NOTIFICATIONS !== "true") return false;
  if (SILENT_TRANSITIONS.has(toStatus)) return false;
  return toStatus in NOTIFICATION_TEMPLATES;
}

export function getTemplate(toStatus: string): NotificationTemplate | null {
  return NOTIFICATION_TEMPLATES[toStatus] ?? null;
}

// ---------------------------------------------------------------------------
// Email dispatch (uses shared transport)
// ---------------------------------------------------------------------------

const SAV_SENDER_NAME = "TrottiStore SAV";
const SAV_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "sav@trottistore.fr";

/**
 * Send a SAV notification email.
 * Routes: SMTP → Brevo template → Brevo plain text.
 */
export async function sendEmail(payload: NotificationPayload): Promise<boolean> {
  const template = getTemplate(payload.toStatus);
  if (!template || !payload.customerEmail) return false;

  const trackingUrl = buildTrackingUrl(payload.trackingToken);
  const textContent = interpolate(
    "Bonjour {customerName},\n\n{subject}\n\nSuivez votre reparation: {trackingUrl}\n\nTrottiStore SAV",
    {
      customerName: payload.customerName,
      subject: template.subject,
      trackingUrl,
    },
  );

  // Route 1: SMTP (Mailpit in dev, any SMTP relay)
  if (process.env.SMTP_HOST) {
    const from = `"${SAV_SENDER_NAME}" <${SAV_SENDER_EMAIL}>`;
    const to = `"${payload.customerName}" <${payload.customerEmail}>`;
    return sendViaSmtp(from, to, template.subject, { text: textContent });
  }

  // Route 2: Brevo API with template
  if (process.env.BREVO_API_KEY && template.emailTemplateId) {
    return sendViaBrevo({
      sender: { name: SAV_SENDER_NAME, email: SAV_SENDER_EMAIL },
      to: [{ email: payload.customerEmail, name: payload.customerName }],
      templateId: Number(template.emailTemplateId),
      params: {
        CUSTOMER_NAME: payload.customerName,
        PRODUCT_MODEL: payload.productModel,
        TICKET_NUMBER: String(payload.ticketNumber),
        TRACKING_URL: trackingUrl,
        ESTIMATED_COST: payload.estimatedCost ? `${payload.estimatedCost}€` : "",
        ESTIMATED_DAYS: payload.estimatedDays ? `${payload.estimatedDays} jours` : "",
        STATUS: payload.toStatus,
      },
    });
  }

  // Route 3: Brevo API plain text fallback
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevo({
      sender: { name: SAV_SENDER_NAME, email: SAV_SENDER_EMAIL },
      to: [{ email: payload.customerEmail, name: payload.customerName }],
      subject: template.subject,
      textContent,
    });
  }

  console.warn("[notifications] No email transport configured (set SMTP_HOST or BREVO_API_KEY)");
  return false;
}

// ---------------------------------------------------------------------------
// SMS dispatch (uses shared transport)
// ---------------------------------------------------------------------------

/**
 * Send a SAV notification SMS via the shared SMS transport.
 */
export async function sendSMS(payload: NotificationPayload): Promise<boolean> {
  const template = getTemplate(payload.toStatus);
  if (!template?.smsContent || !payload.customerPhone) return false;

  const trackingUrl = buildTrackingUrl(payload.trackingToken);
  const content = interpolate(template.smsContent, {
    productModel: payload.productModel,
    estimatedCost: payload.estimatedCost ? String(payload.estimatedCost) : "",
    trackingUrl,
  });

  return sendSms(payload.customerPhone, content);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Dispatch notifications on repair ticket status change.
 * Sends email + SMS in parallel. Returns structured result for audit logging.
 */
export async function notifyStatusChange(payload: NotificationPayload): Promise<NotificationResult> {
  const base = {
    status: payload.toStatus,
    ticketId: payload.ticketId,
    customerEmail: payload.customerEmail,
    customerPhone: payload.customerPhone,
  };

  if (!shouldNotify(payload.toStatus)) {
    return { email: false, sms: false, ...base };
  }

  const [email, sms] = await Promise.all([
    sendEmail(payload),
    sendSMS(payload),
  ]);

  const result = { email, sms, ...base };
  console.log(`[notifications] Result: ${JSON.stringify(result)}`);
  return result;
}
