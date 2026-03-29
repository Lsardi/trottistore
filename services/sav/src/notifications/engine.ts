/**
 * Notification engine for SAV status changes.
 * Sends email via SMTP (Mailpit in dev) or Brevo API (prod).
 * Sends SMS via Brevo transactional SMS API.
 *
 * Email routing:
 *   - If SMTP_HOST is set → nodemailer SMTP (Mailpit in dev, any SMTP in prod)
 *   - Else if BREVO_API_KEY is set → Brevo API
 *   - Else → skip (logged)
 *
 * Feature flag: FEATURE_AUTO_NOTIFICATIONS (default: false)
 */
import nodemailer from "nodemailer";

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
  emailTemplateId: string | null; // Brevo template ID
  smsContent: string | null;
  subject: string;
}

// Template mapping per status transition
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
    smsContent: null, // Pas de SMS pour validation interne
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
    smsContent: null, // Pas de SMS quand récupéré (le client est là)
    subject: "Merci — TrottiStore SAV",
  },
};

// Status transitions that should NOT trigger notifications
const SILENT_TRANSITIONS = new Set(["EN_ATTENTE_PIECE", "REFUS_CLIENT", "IRREPARABLE"]);

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

// --- Brevo API integration ---

const BREVO_API_URL = "https://api.brevo.com/v3";

async function brevoFetch(path: string, body: unknown): Promise<boolean> {
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
    console.error("[notifications] Brevo request error:", err);
    return false;
  }
}

// --- SMTP transport (Mailpit in dev, any SMTP relay in prod) ---

function getSmtpTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || "1025"),
    secure: false, // Mailpit doesn't use TLS
    ...(process.env.SMTP_USER ? {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || "",
      },
    } : {}),
  });
}

async function sendEmailSmtp(
  to: string,
  toName: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const transport = getSmtpTransport();
  if (!transport) return false;

  try {
    await transport.sendMail({
      from: `"TrottiStore SAV" <${process.env.BREVO_SENDER_EMAIL || "sav@trottistore.fr"}>`,
      to: `"${toName}" <${to}>`,
      subject,
      text,
    });
    console.log(`[notifications] Email sent via SMTP to ${to}`);
    return true;
  } catch (err) {
    console.error("[notifications] SMTP send error:", err);
    return false;
  }
}

// --- Email dispatch (SMTP first, then Brevo API fallback) ---

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
    return sendEmailSmtp(
      payload.customerEmail,
      payload.customerName,
      template.subject,
      textContent,
    );
  }

  // Route 2: Brevo API with template
  if (process.env.BREVO_API_KEY && template.emailTemplateId) {
    return brevoFetch("/smtp/email", {
      templateId: Number(template.emailTemplateId),
      to: [{ email: payload.customerEmail, name: payload.customerName }],
      params: {
        CUSTOMER_NAME: payload.customerName,
        PRODUCT_MODEL: payload.productModel,
        TICKET_NUMBER: payload.ticketNumber,
        TRACKING_URL: trackingUrl,
        ESTIMATED_COST: payload.estimatedCost ? `${payload.estimatedCost}€` : "",
        ESTIMATED_DAYS: payload.estimatedDays ? `${payload.estimatedDays} jours` : "",
        STATUS: payload.toStatus,
      },
    });
  }

  // Route 3: Brevo API plain text fallback
  if (process.env.BREVO_API_KEY) {
    return brevoFetch("/smtp/email", {
      sender: { name: "TrottiStore SAV", email: process.env.BREVO_SENDER_EMAIL || "sav@trottistore.fr" },
      to: [{ email: payload.customerEmail, name: payload.customerName }],
      subject: template.subject,
      textContent,
    });
  }

  console.warn("[notifications] No email transport configured (set SMTP_HOST or BREVO_API_KEY)");
  return false;
}

export async function sendSMS(payload: NotificationPayload): Promise<boolean> {
  const template = getTemplate(payload.toStatus);
  if (!template?.smsContent || !payload.customerPhone) return false;

  const trackingUrl = buildTrackingUrl(payload.trackingToken);
  const content = interpolate(template.smsContent, {
    productModel: payload.productModel,
    estimatedCost: payload.estimatedCost ? String(payload.estimatedCost) : "",
    trackingUrl,
  });

  return brevoFetch("/transactionalSMS/sms", {
    sender: "TrottiStore",
    recipient: payload.customerPhone,
    content,
    type: "transactional",
  });
}

/**
 * Main notification dispatch — call this on every status change.
 * Returns { email: boolean, sms: boolean } indicating success.
 */
export async function notifyStatusChange(payload: NotificationPayload): Promise<{ email: boolean; sms: boolean }> {
  if (!shouldNotify(payload.toStatus)) {
    return { email: false, sms: false };
  }

  const [email, sms] = await Promise.all([
    sendEmail(payload),
    sendSMS(payload),
  ]);

  return { email, sms };
}
