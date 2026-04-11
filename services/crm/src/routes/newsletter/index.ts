import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { sendEmail } from "@trottistore/shared/notifications";

const subscribeSchema = z.object({
  email: z
    .string()
    .max(320)
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email()),
  consent: z.literal(true),
  source: z.string().max(50).optional(),
});

const tokenQuerySchema = z.object({
  token: z.string().min(32).max(64),
});

function genToken(): string {
  return randomBytes(24).toString("hex"); // 48 chars
}

function publicBaseUrl(): string {
  return process.env.PUBLIC_WEB_URL || "https://trottistore.fr";
}

async function trySendConfirmEmail(email: string, token: string): Promise<boolean> {
  const confirmUrl = `${publicBaseUrl()}/newsletter/confirm?token=${token}`;
  const html = `
    <p>Bonjour,</p>
    <p>Merci de vouloir vous inscrire à la newsletter TrottiStore.</p>
    <p>Pour confirmer votre inscription, cliquez sur le lien ci-dessous :</p>
    <p><a href="${confirmUrl}">Confirmer mon inscription</a></p>
    <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
  `;
  return sendEmail(email, "Confirmez votre inscription à la newsletter TrottiStore", html);
}

export async function newsletterRoutes(app: FastifyInstance) {
  // POST /api/v1/newsletter/subscribe — public
  app.post(
    "/newsletter/subscribe",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = subscribeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Email ou consentement invalide" },
        });
      }
      const { email, source } = parsed.data;

      const existing = await app.prisma.newsletterSubscriber.findUnique({
        where: { email },
      });

      if (existing && existing.status === "CONFIRMED") {
        // Don't reveal whether the email exists; behave the same as a fresh subscribe.
        return reply.status(200).send({ success: true, data: { status: "ok" } });
      }

      const confirmToken = genToken();
      const unsubscribeToken = existing?.unsubscribeToken ?? genToken();

      // Try to send the double opt-in email. If transport is unavailable
      // (no SMTP, no Brevo), auto-confirm so the feature works in dev/staging.
      const emailSent = await trySendConfirmEmail(email, confirmToken);
      const status = emailSent ? "PENDING" : "CONFIRMED";

      await app.prisma.newsletterSubscriber.upsert({
        where: { email },
        create: {
          email,
          status,
          confirmToken: emailSent ? confirmToken : null,
          unsubscribeToken,
          source: source ?? null,
          confirmedAt: emailSent ? null : new Date(),
        },
        update: {
          status,
          confirmToken: emailSent ? confirmToken : null,
          confirmedAt: emailSent ? null : new Date(),
          unsubscribedAt: null,
        },
      });

      return reply.status(200).send({ success: true, data: { status: "ok" } });
    },
  );

  // GET /api/v1/newsletter/confirm — public
  app.get(
    "/newsletter/confirm",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = tokenQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Token manquant ou invalide" },
        });
      }
      const sub = await app.prisma.newsletterSubscriber.findUnique({
        where: { confirmToken: parsed.data.token },
      });
      if (!sub) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Token inconnu ou déjà utilisé" },
        });
      }
      if (sub.status === "CONFIRMED") {
        return reply.status(200).send({ success: true, data: { status: "already_confirmed" } });
      }
      await app.prisma.newsletterSubscriber.update({
        where: { id: sub.id },
        data: { status: "CONFIRMED", confirmedAt: new Date(), confirmToken: null },
      });
      return reply.status(200).send({ success: true, data: { status: "confirmed" } });
    },
  );

  // GET /api/v1/newsletter/unsubscribe — public
  app.get(
    "/newsletter/unsubscribe",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = tokenQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Token manquant ou invalide" },
        });
      }
      const sub = await app.prisma.newsletterSubscriber.findUnique({
        where: { unsubscribeToken: parsed.data.token },
      });
      if (!sub) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Token inconnu" },
        });
      }
      if (sub.status === "UNSUBSCRIBED") {
        return reply.status(200).send({ success: true, data: { status: "already_unsubscribed" } });
      }
      await app.prisma.newsletterSubscriber.update({
        where: { id: sub.id },
        data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
      });
      return reply.status(200).send({ success: true, data: { status: "unsubscribed" } });
    },
  );
}
