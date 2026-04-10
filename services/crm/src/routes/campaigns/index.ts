/**
 * Campaign routes — email marketing campaigns with segment targeting.
 *
 * CRUD: GET /campaigns, GET /:id, POST, PUT /:id, DELETE /:id
 * Actions: POST /:id/send, POST /:id/preview, GET /:id/stats
 *
 * Status machine: DRAFT → SENDING → SENT (or CANCELLED at any point)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseIdParam } from "@trottistore/shared";
import { sendEmail } from "@trottistore/shared/notifications";

// ─── Validation schemas ──────────────────────────────────

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  segmentId: z.string().uuid().optional(),
  content: z.string().optional(),
  templateId: z.string().optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(500).optional(),
  segmentId: z.string().uuid().optional().nullable(),
  content: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
});

const EMPTY_STATS = {
  sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0,
} as const;

// ─── Segment resolution ─────────────────────────────────

type SegmentCriteria = {
  loyaltyTier?: string;
  minSpent?: number;
  maxSpent?: number;
  minOrders?: number;
  tags?: string[];
  lastOrderDaysAgo?: number;
};

function buildProfileWhere(criteria: SegmentCriteria) {
  const where: Record<string, unknown> = {};

  if (criteria.loyaltyTier) where.loyaltyTier = criteria.loyaltyTier;
  if (criteria.minSpent !== undefined || criteria.maxSpent !== undefined) {
    const totalSpent: Record<string, number> = {};
    if (criteria.minSpent !== undefined) totalSpent.gte = criteria.minSpent;
    if (criteria.maxSpent !== undefined) totalSpent.lte = criteria.maxSpent;
    where.totalSpent = totalSpent;
  }
  if (criteria.minOrders !== undefined) where.totalOrders = { gte: criteria.minOrders };
  if (Array.isArray(criteria.tags) && criteria.tags.length > 0) where.tags = { hasSome: criteria.tags };
  if (criteria.lastOrderDaysAgo !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - criteria.lastOrderDaysAgo);
    where.lastOrderAt = { gte: cutoff };
  }

  return where;
}

// ─── Routes ──────────────────────────────────────────────

export async function campaignRoutes(app: FastifyInstance) {

  // GET /campaigns — List all campaigns
  app.get("/campaigns", async () => {
    const campaigns = await app.prisma.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: campaigns };
  });

  // GET /campaigns/:id — Single campaign detail
  app.get("/campaigns/:id", async (request, reply) => {
    const id = parseIdParam(request.params);
    const campaign = await app.prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Campagne introuvable" },
      });
    }
    return { success: true, data: campaign };
  });

  // POST /campaigns — Create draft campaign
  app.post("/campaigns", async (request, reply) => {
    const body = createCampaignSchema.parse(request.body);

    if (body.segmentId) {
      const segment = await app.prisma.customerSegment.findUnique({
        where: { id: body.segmentId },
        select: { id: true },
      });
      if (!segment) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_SEGMENT", message: `Segment '${body.segmentId}' introuvable` },
        });
      }
    }

    const campaign = await app.prisma.emailCampaign.create({
      data: {
        name: body.name,
        subject: body.subject,
        segmentId: body.segmentId ?? null,
        content: body.content ?? null,
        templateId: body.templateId ?? null,
        status: "DRAFT",
        stats: EMPTY_STATS as unknown as Record<string, number>,
      },
    });

    return reply.status(201).send({ success: true, data: campaign });
  });

  // PUT /campaigns/:id — Update a DRAFT campaign
  app.put("/campaigns/:id", async (request, reply) => {
    const id = parseIdParam(request.params);
    const body = updateCampaignSchema.parse(request.body);

    const existing = await app.prisma.emailCampaign.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Campagne introuvable" },
      });
    }
    if (existing.status !== "DRAFT") {
      return reply.status(400).send({
        success: false,
        error: { code: "NOT_EDITABLE", message: "Seules les campagnes DRAFT peuvent être modifiées" },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.subject !== undefined) updateData.subject = body.subject;
    if (body.segmentId !== undefined) updateData.segmentId = body.segmentId;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.templateId !== undefined) updateData.templateId = body.templateId;

    const campaign = await app.prisma.emailCampaign.update({
      where: { id },
      data: updateData,
    });

    return { success: true, data: campaign };
  });

  // DELETE /campaigns/:id — Delete a campaign
  app.delete("/campaigns/:id", async (request, reply) => {
    const id = parseIdParam(request.params);

    const existing = await app.prisma.emailCampaign.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Campagne introuvable" },
      });
    }

    if (existing.status === "SENDING") {
      return reply.status(400).send({
        success: false,
        error: { code: "CANNOT_DELETE", message: "Impossible de supprimer une campagne en cours d'envoi" },
      });
    }

    await app.prisma.emailCampaign.delete({ where: { id } });
    return { success: true, data: { message: "Campagne supprimée" } };
  });

  // GET /campaigns/:id/stats — Campaign statistics
  app.get("/campaigns/:id/stats", async (request, reply) => {
    const id = parseIdParam(request.params);
    const campaign = await app.prisma.emailCampaign.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, sentAt: true, stats: true },
    });

    if (!campaign) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Campagne introuvable" },
      });
    }

    // Count actual sends
    const sendCounts = await app.prisma.campaignSend.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const row of sendCounts) {
      counts[row.status.toLowerCase()] = row._count.id;
    }

    return {
      success: true,
      data: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        sentAt: campaign.sentAt,
        stats: {
          ...EMPTY_STATS,
          sent: counts.sent ?? 0,
          delivered: counts.delivered ?? 0,
          bounced: counts.bounced ?? 0,
          ...(campaign.stats as Record<string, number> ?? {}),
        },
      },
    };
  });

  // POST /campaigns/:id/preview — Send a test email to the requester
  app.post("/campaigns/:id/preview", async (request, reply) => {
    const id = parseIdParam(request.params);
    const { email } = (request.body as { email?: string }) || {};

    if (!email) {
      return reply.status(400).send({
        success: false,
        error: { code: "MISSING_EMAIL", message: "Email de test requis" },
      });
    }

    const campaign = await app.prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Campagne introuvable" },
      });
    }

    if (!campaign.content) {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_CONTENT", message: "La campagne n'a pas de contenu HTML" },
      });
    }

    const sent = await sendEmail(email, `[PREVIEW] ${campaign.subject}`, campaign.content, {
      senderName: "TrottiStore Marketing",
      senderEmail: "marketing@trottistore.fr",
    });

    return {
      success: true,
      data: { sent, message: sent ? `Preview envoyé à ${email}` : "Échec de l'envoi" },
    };
  });

  // POST /campaigns/:id/send — Execute campaign: resolve segment → send to each customer
  app.post("/campaigns/:id/send", async (request, reply) => {
    const id = parseIdParam(request.params);

    const campaign = await app.prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Campagne introuvable" },
      });
    }

    if (campaign.status !== "DRAFT" && campaign.status !== "SENDING") {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_STATUS", message: `Campagne en status '${campaign.status}', attendu 'DRAFT' ou 'SENDING' (recovery)` },
      });
    }

    if (!campaign.content) {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_CONTENT", message: "La campagne n'a pas de contenu" },
      });
    }

    // Resolve recipients from segment
    let profileWhere: Record<string, unknown> = {};
    if (campaign.segmentId) {
      const segment = await app.prisma.customerSegment.findUnique({
        where: { id: campaign.segmentId },
      });
      if (segment) {
        profileWhere = buildProfileWhere(segment.criteria as SegmentCriteria);
      }
    }

    const profiles = await app.prisma.customerProfile.findMany({
      where: profileWhere,
      select: {
        id: true,
        userId: true,
        user: { select: { email: true, firstName: true } },
      },
    });

    if (profiles.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: "EMPTY_SEGMENT", message: "Aucun destinataire dans ce segment" },
      });
    }

    // Transition to SENDING
    await app.prisma.emailCampaign.update({
      where: { id },
      data: { status: "SENDING" },
    });

    // Send emails (non-blocking batch)
    let sent = 0;
    let failed = 0;

    for (const profile of profiles) {
      // Idempotence: skip if already sent
      const existing = await app.prisma.campaignSend.findUnique({
        where: { campaignId_customerId: { campaignId: id, customerId: profile.userId } },
      });
      if (existing) {
        sent++;
        continue;
      }

      const success = await sendEmail(
        profile.user.email,
        campaign.subject,
        campaign.content,
        { senderName: "TrottiStore", senderEmail: "marketing@trottistore.fr" },
      );

      await app.prisma.campaignSend.create({
        data: {
          campaignId: id,
          customerId: profile.userId,
          email: profile.user.email,
          status: success ? "SENT" : "FAILED",
          errorMessage: success ? null : "Email delivery failed",
        },
      });

      if (success) sent++;
      else failed++;
    }

    // Transition to SENT
    await app.prisma.emailCampaign.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        stats: { sent, delivered: sent, bounced: failed, opened: 0, clicked: 0, unsubscribed: 0 },
      },
    });

    return {
      success: true,
      data: {
        campaignId: id,
        recipients: profiles.length,
        sent,
        failed,
      },
    };
  });
}
