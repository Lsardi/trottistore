import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  segmentId: z.string().uuid().optional(),
  content: z.string().optional(),
  templateId: z.string().optional(),
});

export async function campaignRoutes(app: FastifyInstance) {
  // ───────────────────────────────────────────────────────────
  // GET /campaigns — List all campaigns, sorted by newest
  // ───────────────────────────────────────────────────────────
  app.get("/campaigns", async (_request, _reply) => {
    const campaigns = await app.prisma.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        subject: true,
        status: true,
        segmentId: true,
        templateId: true,
        scheduledAt: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, data: campaigns };
  });

  // ───────────────────────────────────────────────────────────
  // POST /campaigns — Create a new campaign in DRAFT status
  // ───────────────────────────────────────────────────────────
  app.post("/campaigns", async (request, reply) => {
    const body = createCampaignSchema.parse(request.body);

    // Validate segment exists if provided
    if (body.segmentId) {
      const segment = await app.prisma.customerSegment.findUnique({
        where: { id: body.segmentId },
        select: { id: true },
      });
      if (!segment) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_SEGMENT",
            message: `Segment '${body.segmentId}' introuvable`,
          },
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
        stats: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0,
        } as Prisma.JsonObject,
      },
    });

    return { success: true, data: campaign };
  });

  // ───────────────────────────────────────────────────────────
  // GET /campaigns/:id/stats — Get campaign statistics
  // ───────────────────────────────────────────────────────────
  app.get("/campaigns/:id/stats", async (request, reply) => {
    const { id } = request.params as { id: string };

    const campaign = await app.prisma.emailCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        sentAt: true,
        stats: true,
      },
    });

    if (!campaign) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Campagne '${id}' introuvable` },
      });
    }

    const stats = (campaign.stats as Record<string, number>) ?? {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
    };

    return {
      success: true,
      data: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        sentAt: campaign.sentAt,
        stats,
      },
    };
  });
}
