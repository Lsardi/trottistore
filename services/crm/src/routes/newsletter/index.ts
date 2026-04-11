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

  // ── Admin endpoints (auth required, scoped to ADMIN+ via the global hook) ──

  const listQuerySchema = z.object({
    status: z.enum(["PENDING", "CONFIRMED", "UNSUBSCRIBED", "ALL"]).optional().default("ALL"),
    search: z.string().max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  });

  // GET /api/v1/newsletter/admin/subscribers — paginated list, filterable
  app.get("/newsletter/admin/subscribers", async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Paramètres invalides" },
      });
    }
    const { status, search, page, limit } = parsed.data;

    const where: { status?: string; email?: { contains: string; mode: "insensitive" } } = {};
    if (status !== "ALL") where.status = status;
    if (search) where.email = { contains: search, mode: "insensitive" };

    const [items, total, statusCounts] = await Promise.all([
      app.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          status: true,
          source: true,
          createdAt: true,
          confirmedAt: true,
          unsubscribedAt: true,
        },
      }),
      app.prisma.newsletterSubscriber.count({ where }),
      app.prisma.newsletterSubscriber.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const counts: Record<string, number> = { PENDING: 0, CONFIRMED: 0, UNSUBSCRIBED: 0 };
    for (const c of statusCounts) {
      counts[c.status] = c._count._all;
    }

    return reply.send({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      counts,
    });
  });

  // GET /api/v1/newsletter/admin/export.csv — full CSV export for RGPD/marketing
  app.get("/newsletter/admin/export.csv", async (request, reply) => {
    const parsed = z
      .object({ status: z.enum(["PENDING", "CONFIRMED", "UNSUBSCRIBED", "ALL"]).optional().default("CONFIRMED") })
      .safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Paramètres invalides" },
      });
    }
    const { status } = parsed.data;
    const where = status === "ALL" ? {} : { status };

    const subs = await app.prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        email: true,
        status: true,
        source: true,
        createdAt: true,
        confirmedAt: true,
        unsubscribedAt: true,
      },
    });

    // Minimal CSV escaping (RFC 4180): wrap in quotes if contains comma/quote/newline,
    // and escape inner quotes by doubling them.
    function csvCell(v: string | Date | null): string {
      if (v === null || v === undefined) return "";
      const s = v instanceof Date ? v.toISOString() : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }

    const header = "email,status,source,created_at,confirmed_at,unsubscribed_at";
    const rows = subs.map((s) =>
      [s.email, s.status, s.source, s.createdAt, s.confirmedAt, s.unsubscribedAt].map(csvCell).join(","),
    );
    const csv = [header, ...rows].join("\n") + "\n";

    const filename = `newsletter-${status.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`);
    return reply.send(csv);
  });
}
