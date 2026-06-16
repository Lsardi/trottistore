/**
 * Brevo (Sendinblue) transactional email webhook.
 *
 * Receives delivery/bounce/complaint events and updates the matching
 * EmailLog row so deliverability can be monitored. Protected by a shared
 * secret: Brevo does not sign webhooks, so we require BREVO_WEBHOOK_SECRET
 * passed as `?token=` (configured in the Brevo webhook URL).
 *
 * Configure in Brevo → Transactional → Settings → Webhook:
 *   https://<api-host>/api/v1/webhooks/brevo?token=<BREVO_WEBHOOK_SECRET>
 *   events: delivered, hard_bounce, soft_bounce, blocked, spam, opened
 */
import type { FastifyInstance } from "fastify";

/** Map a Brevo event name to our EmailLog status. */
function mapEvent(event: string): string | null {
  switch (event) {
    case "delivered":
      return "DELIVERED";
    case "hard_bounce":
    case "soft_bounce":
    case "blocked":
    case "invalid_email":
    case "error":
      return "BOUNCED";
    case "spam":
    case "unsubscribed":
      return "COMPLAINED";
    case "opened":
    case "unique_opened":
      return "OPENED";
    default:
      return null;
  }
}

interface BrevoEvent {
  event?: string;
  email?: string;
  "message-id"?: string;
  reason?: string;
}

export async function emailWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post("/webhooks/brevo", async (request, reply) => {
    const secret = process.env.BREVO_WEBHOOK_SECRET;
    const token = (request.query as { token?: string } | undefined)?.token;

    // If a secret is configured, enforce it. If not, refuse in production
    // (no open webhook in prod) but allow in dev for local testing.
    if (secret) {
      if (token !== secret) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid webhook token" },
        });
      }
    } else if (process.env.NODE_ENV === "production") {
      return reply.status(503).send({
        success: false,
        error: { code: "WEBHOOK_DISABLED", message: "BREVO_WEBHOOK_SECRET not configured" },
      });
    }

    const body = request.body as BrevoEvent | BrevoEvent[] | undefined;
    const events = Array.isArray(body) ? body : body ? [body] : [];

    let updated = 0;
    for (const ev of events) {
      const status = ev.event ? mapEvent(ev.event) : null;
      const email = ev.email?.toLowerCase();
      if (!status || !email) continue;

      // Match the most recent log for this recipient (Brevo message-id is not
      // stored on send, so we correlate by email + recency — best effort).
      const existing = await app.prisma.emailLog.findFirst({
        where: { toEmail: email },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        await app.prisma.emailLog.update({
          where: { id: existing.id },
          data: {
            status,
            ...(ev["message-id"] ? { providerMessageId: ev["message-id"] } : {}),
            ...(ev.reason ? { error: ev.reason } : {}),
          },
        });
      } else {
        await app.prisma.emailLog.create({
          data: {
            toEmail: email,
            subject: "(webhook-only event)",
            status,
            provider: "brevo",
            providerMessageId: ev["message-id"] ?? null,
            error: ev.reason ?? null,
          },
        });
      }
      updated++;
    }

    return reply.send({ success: true, data: { received: events.length, updated } });
  });
}
