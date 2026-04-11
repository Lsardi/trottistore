/**
 * Integration tests for the public newsletter routes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { newsletterRoutes } from "./index.js";

vi.mock("@trottistore/shared/notifications", () => ({
  sendEmail: vi.fn().mockResolvedValue(false),
}));

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorate("prisma", {
    newsletterSubscriber: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
  } as unknown as FastifyInstance["prisma"]);
  return app;
}

describe("Newsletter routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(newsletterRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/v1/newsletter/subscribe", () => {
    it("rejects payload without consent", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/newsletter/subscribe",
        payload: { email: "alice@test.com" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects malformed email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/newsletter/subscribe",
        payload: { email: "not-an-email", consent: true },
      });
      expect(res.statusCode).toBe(400);
    });

    it("creates a subscriber and auto-confirms when no email transport", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/newsletter/subscribe",
        payload: { email: "alice@test.com", consent: true, source: "home" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const upsertMock = app.prisma.newsletterSubscriber.upsert as ReturnType<typeof vi.fn>;
      expect(upsertMock).toHaveBeenCalledTimes(1);
      const upsertCall = upsertMock.mock.calls[0][0];
      expect(upsertCall.create.email).toBe("alice@test.com");
      expect(upsertCall.create.status).toBe("CONFIRMED");
      expect(upsertCall.create.confirmToken).toBeNull();
      expect(upsertCall.create.unsubscribeToken).toMatch(/^[a-f0-9]{48}$/);
    });

    it("normalizes email to lowercase + trim", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/newsletter/subscribe",
        payload: { email: "  Alice@Test.COM ", consent: true },
      });

      const findMock = app.prisma.newsletterSubscriber.findUnique as ReturnType<typeof vi.fn>;
      expect(findMock).toHaveBeenCalledTimes(1);
      expect(findMock.mock.calls[0][0].where.email).toBe("alice@test.com");
    });

    it("does not leak information when email is already CONFIRMED", async () => {
      (app.prisma.newsletterSubscriber.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "sub-1",
        email: "alice@test.com",
        status: "CONFIRMED",
        unsubscribeToken: "existing-token",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/newsletter/subscribe",
        payload: { email: "alice@test.com", consent: true },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("ok");
      expect(app.prisma.newsletterSubscriber.upsert).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/newsletter/confirm", () => {
    it("rejects missing token", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/newsletter/confirm" });
      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for unknown token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/newsletter/confirm?token=" + "a".repeat(48),
      });
      expect(res.statusCode).toBe(404);
    });

    it("confirms a PENDING subscriber", async () => {
      (app.prisma.newsletterSubscriber.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "sub-1",
        status: "PENDING",
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/newsletter/confirm?token=" + "a".repeat(48),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("confirmed");

      const updateCall = (app.prisma.newsletterSubscriber.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updateCall.data.status).toBe("CONFIRMED");
      expect(updateCall.data.confirmToken).toBeNull();
    });

    it("idempotent on already CONFIRMED", async () => {
      (app.prisma.newsletterSubscriber.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "sub-1",
        status: "CONFIRMED",
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/newsletter/confirm?token=" + "a".repeat(48),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("already_confirmed");
      expect(app.prisma.newsletterSubscriber.update).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/newsletter/unsubscribe", () => {
    it("unsubscribes a CONFIRMED subscriber", async () => {
      (app.prisma.newsletterSubscriber.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "sub-1",
        status: "CONFIRMED",
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/newsletter/unsubscribe?token=" + "b".repeat(48),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("unsubscribed");

      const updateCall = (app.prisma.newsletterSubscriber.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updateCall.data.status).toBe("UNSUBSCRIBED");
      expect(updateCall.data.unsubscribedAt).toBeInstanceOf(Date);
    });

    it("idempotent on already UNSUBSCRIBED", async () => {
      (app.prisma.newsletterSubscriber.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "sub-1",
        status: "UNSUBSCRIBED",
      });
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/newsletter/unsubscribe?token=" + "b".repeat(48),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("already_unsubscribed");
      expect(app.prisma.newsletterSubscriber.update).not.toHaveBeenCalled();
    });

    it("returns 404 for unknown token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/newsletter/unsubscribe?token=" + "b".repeat(48),
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
