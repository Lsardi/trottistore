/**
 * Email sending for ecommerce service.
 * Uses SMTP (Mailpit dev) or Brevo API (prod).
 */
import nodemailer from "nodemailer";

const FROM_NAME = "TrottiStore";
const FROM_EMAIL = process.env.MAIL_FROM || "commandes@trottistore.fr";

function getSmtpTransport() {
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

async function sendViaBrevo(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // Try SMTP first (Mailpit in dev)
  const transport = getSmtpTransport();
  if (transport) {
    try {
      await transport.sendMail({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject,
        html,
      });
      return true;
    } catch (err) {
      console.error("[email] SMTP failed:", (err as Error).message);
    }
  }

  // Fallback to Brevo
  const brevoResult = await sendViaBrevo(to, subject, html);
  if (brevoResult) return true;

  console.warn(`[email] Could not send "${subject}" to ${to} — no SMTP or Brevo configured`);
  return false;
}
