/**
 * Integration tests for campaign routes.
 *
 * Covers: CRUD (create, read, update, delete), send (segment resolution,
 * idempotence, status transitions), preview, and validation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { campaignRoutes } from "./index.js";

// Mock email sending
vi.mock("@trottistore/shared/notifications", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CAMPAIGN_DRAFT = {
  id: "camp-1",
  name: "Promo été",
  subject: "Soldes trottinettes -20%",
  content: "<h1>Promo</h1><p>Profitez des soldes !</p>",
  segmentId: "seg-1",
  templateId: null,
  status: "DRAFT",
  scheduledAt: null,
  sentAt: null,
  stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    emailCampaign: {
      findMany: vi.fn().mockResolvedValue([CAMPAIGN_DRAFT]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(CAMPAIGN_DRAFT),
      update: vi.fn().mockResolvedValue(CAMPAIGN_DRAFT),
      delete: vi.fn().mockResolvedValue(CAMPAIGN_DRAFT),
    },
    customerSegment: {
      findUnique: vi.fn().mockResolvedValue({
        id: "seg-1",
        criteria: { loyaltyTier: "GOLD" },
      }),
    },
    customerProfile: {
      findMany: vi.fn().mockResolvedValue([
        { id: "prof-1", userId: "user-1", user: { email: "alice@test.com", firstName: "Alice" } },
        { id: "prof-2", userId: "user-2", user: { email: "bob@test.com", firstName: "Bob" } },
      ]),
    },
    campaignSend: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    const statusCode = isZodError ? 400 : error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: { code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR", message: error.message },
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Campaign routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(campaignRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => app.close());

  beforeEach(() => vi.clearAllMocks());

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  describe("GET /campaigns", () => {
    it("lists all campaigns", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/campaigns" });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  describe("POST /campaigns", () => {
    it("creates a draft campaign", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/campaigns",
        payload: { name: "Test", subject: "Hello", content: "<p>Hi</p>" },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  describe("PUT /campaigns/:id", () => {
    it("updates a DRAFT campaign", async () => {
      (app.prisma.emailCampaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(CAMPAIGN_DRAFT);

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/campaigns/camp-1",
        payload: { subject: "New subject" },
      });
      expect(res.statusCode).toBe(200);
    });

    it("rejects update on non-DRAFT campaign", async () => {
      (app.prisma.emailCampaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...CAMPAIGN_DRAFT,
        status: "SENT",
      });

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/campaigns/camp-1",
        payload: { subject: "Updated" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("NOT_EDITABLE");
    });
  });

  describe("DELETE /campaigns/:id", () => {
    it("deletes a campaign", async () => {
      (app.prisma.emailCampaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(CAMPAIGN_DRAFT);

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/campaigns/camp-1",
      });
      expect(res.statusCode).toBe(200);
    });

    it("rejects delete on SENDING campaign", async () => {
      (app.prisma.emailCampaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...CAMPAIGN_DRAFT,
        status: "SENDING",
      });

      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/campaigns/camp-1",
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Send
  // -----------------------------------------------------------------------

  describe("POST /campaigns/:id/send", () => {
    it("sends a campaign to segment recipients", async () => {
      (app.prisma.emailCampaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(CAMPAIGN_DRAFT);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/campaigns/camp-1/send",
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.recipients).toBe(2);
      expect(json.data.sent).toBe(2);
      // Should have created 2 send records
      expect(app.prisma.campaignSend.create).toHaveBeenCalledTimes(2);
      // Should have transitioned to SENT
      expect(app.prisma.emailCampaign.update).toHaveBeenCalledTimes(2); // SENDING + SENT
    });

    it("rejects send on non-DRAFT campaign", async () => {
      (app.prisma.emailCampaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...CAMPAIGN_DRAFT,
        status: "SENT",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/campaigns/camp-1/send",
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("INVALID_STATUS");
    });

    it("rejects send with no content", async () => {
      (app.prisma.emailCampaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...CAMPAIGN_DRAFT,
        content: null,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/campaigns/camp-1/send",
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("NO_CONTENT");
    });
  });

  // -----------------------------------------------------------------------
  // Preview
  // -----------------------------------------------------------------------

  describe("POST /campaigns/:id/preview", () => {
    it("sends preview email", async () => {
      (app.prisma.emailCampaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(CAMPAIGN_DRAFT);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/campaigns/camp-1/preview",
        payload: { email: "admin@trottistore.fr" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.sent).toBe(true);
    });

    it("rejects preview without email", async () => {
      (app.prisma.emailCampaign.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(CAMPAIGN_DRAFT);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/campaigns/camp-1/preview",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
