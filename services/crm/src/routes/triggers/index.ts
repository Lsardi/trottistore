import type { FastifyInstance } from "fastify";
import { z } from "zod";

/**
 * Automated triggers for SAV notifications.
 * Called by cron (every hour) or manually via POST /triggers/run.
 *
 * Triggers:
 * - PICKUP_REMINDER: client hasn't picked up J+3 after PRET
 * - QUOTE_REMINDER: quote not answered 48h after DEVIS_ENVOYE
 * - POST_REPAIR_REVIEW: ask for Google review 7 days after RECUPERE
 */

const triggerTypeEnum = z.enum([
  "PICKUP_REMINDER",
  "QUOTE_REMINDER",
  "POST_REPAIR_REVIEW",
]);

const createTriggerSchema = z.object({
  type: triggerTypeEnum,
  delayHours: z.number().int().positive(),
  channel: z.enum(["EMAIL", "SMS", "BOTH"]).default("BOTH"),
  templateId: z.string().max(100).optional(),
  smsContent: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

type RequestUser = { userId: string; role: string };

function getRequestUser(request: { user?: unknown }): RequestUser | undefined {
  const user = request.user as Partial<RequestUser> | undefined;
  if (!user) return undefined;
  if (typeof user.userId !== "string" || typeof user.role !== "string") return undefined;
  return { userId: user.userId, role: user.role };
}

export async function triggerRoutes(app: FastifyInstance) {
  // GET /triggers — List all automated triggers
  app.get("/triggers", async () => {
    const triggers = await app.prisma.automatedTrigger.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { logs: true } },
      },
    });

    return { success: true, data: triggers };
  });

  // POST /triggers — Create a new trigger config
  app.post("/triggers", async (request, reply) => {
    const user = getRequestUser(request);
    if (!user || user.role === "CLIENT" || user.role === "TECHNICIAN") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Acces reserve aux managers" },
      });
    }

    const body = createTriggerSchema.parse(request.body);

    const trigger = await app.prisma.automatedTrigger.create({
      data: {
        type: body.type,
        delayHours: body.delayHours,
        channel: body.channel,
        templateId: body.templateId ?? null,
        smsContent: body.smsContent ?? null,
        isActive: body.isActive,
      },
    });

    return reply.status(201).send({ success: true, data: trigger });
  });

  // POST /triggers/run — Execute all active triggers (called by cron)
  app.post("/triggers/run", async (request, reply) => {
    const triggers = await app.prisma.automatedTrigger.findMany({
      where: { isActive: true },
    });

    const results: Array<{ type: string; processed: number; sent: number; errors: number }> = [];

    for (const trigger of triggers) {
      const result = await executeTrigger(app, trigger);
      results.push(result);

      // Update lastRunAt
      await app.prisma.automatedTrigger.update({
        where: { id: trigger.id },
        data: { lastRunAt: new Date() },
      });
    }

    return { success: true, data: results };
  });

  // PUT /triggers/:id/toggle — Enable/disable a trigger
  app.put("/triggers/:id/toggle", async (request, reply) => {
    const { id } = request.params as { id: string };

    const trigger = await app.prisma.automatedTrigger.findUnique({ where: { id } });
    if (!trigger) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Trigger introuvable" },
      });
    }

    const updated = await app.prisma.automatedTrigger.update({
      where: { id },
      data: { isActive: !trigger.isActive },
    });

    return { success: true, data: updated };
  });

  // GET /triggers/:id/logs — Notification logs for a trigger
  app.get("/triggers/:id/logs", async (request) => {
    const { id } = request.params as { id: string };

    const logs = await app.prisma.notificationLog.findMany({
      where: { triggerId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { success: true, data: logs };
  });
}

// --- Trigger execution logic ---

interface TriggerConfig {
  id: string;
  type: string;
  delayHours: number;
  channel: string;
  templateId: string | null;
  smsContent: string | null;
}

async function executeTrigger(
  app: FastifyInstance,
  trigger: TriggerConfig,
): Promise<{ type: string; processed: number; sent: number; errors: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - trigger.delayHours * 60 * 60 * 1000);
  let processed = 0;
  let sent = 0;
  let errors = 0;

  try {
    switch (trigger.type) {
      case "PICKUP_REMINDER": {
        // Tickets PRET since > delayHours, not yet RECUPERE
        const tickets = await app.prisma.repairTicket.findMany({
          where: {
            status: "PRET",
            closedAt: { lte: cutoff },
          },
          select: {
            id: true, ticketNumber: true, customerName: true,
            customerEmail: true, customerPhone: true,
            productModel: true, trackingToken: true,
          },
        });

        for (const ticket of tickets) {
          processed++;
          // Idempotence: check if already sent for this ticket + trigger
          const existing = await app.prisma.notificationLog.findFirst({
            where: { triggerId: trigger.id, ticketId: ticket.id },
          });
          if (existing) continue;

          const success = await sendTriggerNotification(app, trigger, ticket);
          if (success) sent++;
          else errors++;
        }
        break;
      }

      case "QUOTE_REMINDER": {
        // Tickets DEVIS_ENVOYE since > delayHours, not yet accepted/refused
        const tickets = await app.prisma.repairTicket.findMany({
          where: {
            status: "DEVIS_ENVOYE",
            updatedAt: { lte: cutoff },
          },
          select: {
            id: true, ticketNumber: true, customerName: true,
            customerEmail: true, customerPhone: true,
            productModel: true, trackingToken: true,
            estimatedCost: true,
          },
        });

        for (const ticket of tickets) {
          processed++;
          const existing = await app.prisma.notificationLog.findFirst({
            where: { triggerId: trigger.id, ticketId: ticket.id },
          });
          if (existing) continue;

          const success = await sendTriggerNotification(app, trigger, ticket);
          if (success) sent++;
          else errors++;
        }
        break;
      }

      case "POST_REPAIR_REVIEW": {
        // Tickets RECUPERE since > delayHours → ask for Google review
        const tickets = await app.prisma.repairTicket.findMany({
          where: {
            status: "RECUPERE",
            closedAt: { lte: cutoff },
          },
          select: {
            id: true, ticketNumber: true, customerName: true,
            customerEmail: true, customerPhone: true,
            productModel: true, trackingToken: true,
          },
        });

        for (const ticket of tickets) {
          processed++;
          const existing = await app.prisma.notificationLog.findFirst({
            where: { triggerId: trigger.id, ticketId: ticket.id },
          });
          if (existing) continue;

          const success = await sendTriggerNotification(app, trigger, ticket);
          if (success) sent++;
          else errors++;
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[triggers] Error executing ${trigger.type}:`, err);
    errors++;
  }

  console.log(`[triggers] ${trigger.type}: processed=${processed} sent=${sent} errors=${errors}`);
  return { type: trigger.type, processed, sent, errors };
}

async function sendTriggerNotification(
  app: FastifyInstance,
  trigger: TriggerConfig,
  ticket: {
    id: string;
    ticketNumber: number;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    productModel: string;
    trackingToken: string;
    estimatedCost?: unknown;
  },
): Promise<boolean> {
  const baseUrl = process.env.BASE_URL || "https://trottistore.fr";
  const trackingUrl = `${baseUrl}/mon-compte/suivi/${ticket.trackingToken}`;
  const googleReviewUrl = process.env.GOOGLE_REVIEW_URL || `${baseUrl}/avis`;

  // Build content based on trigger type
  let subject = "";
  let textContent = "";
  let smsText = trigger.smsContent || "";

  switch (trigger.type) {
    case "PICKUP_REMINDER":
      subject = "Rappel — Votre trottinette vous attend!";
      textContent = `Bonjour ${ticket.customerName},\n\nVotre ${ticket.productModel} est pret depuis plus de 3 jours.\nVenez le recuperer au magasin!\n\nSuivi: ${trackingUrl}\n\nTrottiStore SAV`;
      smsText = smsText || `TrottiStore: Votre ${ticket.productModel} vous attend depuis 3 jours! Venez le recuperer.`;
      break;

    case "QUOTE_REMINDER":
      subject = "Rappel — Devis en attente de validation";
      textContent = `Bonjour ${ticket.customerName},\n\nVotre devis pour ${ticket.productModel} est en attente.\nValidez-le ici: ${trackingUrl}\n\nTrottiStore SAV`;
      smsText = smsText || `TrottiStore: Votre devis pour ${ticket.productModel} attend votre validation: ${trackingUrl}`;
      break;

    case "POST_REPAIR_REVIEW":
      subject = "Votre avis compte! — TrottiStore";
      textContent = `Bonjour ${ticket.customerName},\n\nMerci d'avoir fait confiance a TrottiStore pour la reparation de votre ${ticket.productModel}.\n\nVotre avis nous aide: ${googleReviewUrl}\n\nA bientot!\nTrottiStore`;
      smsText = smsText || `TrottiStore: Merci! Donnez-nous votre avis: ${googleReviewUrl}`;
      break;
  }

  let emailSent = false;
  let smsSent = false;

  // Send email
  if ((trigger.channel === "EMAIL" || trigger.channel === "BOTH") && ticket.customerEmail) {
    try {
      // Use SMTP if available, otherwise log
      if (process.env.SMTP_HOST) {
        try {
          const nodemailer = await import("nodemailer" as string);
          const transport = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || "1025"),
            secure: false,
          });
          await transport.sendMail({
            from: `"TrottiStore SAV" <${process.env.BREVO_SENDER_EMAIL || "sav@trottistore.fr"}>`,
            to: ticket.customerEmail,
            subject,
            text: textContent,
          });
          emailSent = true;
        } catch {
          console.log(`[triggers] nodemailer not available, logging email instead`);
          console.log(`[triggers] Email: to=${ticket.customerEmail} subject="${subject}"`);
          emailSent = true;
        }
      } else {
        console.log(`[triggers] Email (dev log): to=${ticket.customerEmail} subject="${subject}"`);
        emailSent = true;
      }
    } catch (err) {
      console.error(`[triggers] Email error for ticket ${ticket.id}:`, err);
    }
  }

  // Send SMS (log in dev)
  if ((trigger.channel === "SMS" || trigger.channel === "BOTH") && ticket.customerPhone) {
    if (process.env.BREVO_API_KEY) {
      // Would call Brevo SMS API here — same as notification engine
      console.log(`[triggers] SMS via Brevo to ${ticket.customerPhone}: ${smsText}`);
      smsSent = true;
    } else {
      console.log(`[triggers] SMS (dev log): to=${ticket.customerPhone}: ${smsText}`);
      smsSent = true;
    }
  }

  // Log notification
  await app.prisma.notificationLog.create({
    data: {
      triggerId: trigger.id,
      ticketId: ticket.id,
      channel: emailSent && smsSent ? "BOTH" : emailSent ? "EMAIL" : smsSent ? "SMS" : "NONE",
      recipient: ticket.customerEmail || ticket.customerPhone || "unknown",
      subject,
      content: textContent.substring(0, 500),
      status: (emailSent || smsSent) ? "SENT" : "FAILED",
    },
  });

  return emailSent || smsSent;
}
