import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { repairRoutes } from "../tickets/index.js";
import { quoteRoutes } from "./index.js";

describe("ticket access on parts and PDF", () => {
  it.each([
    ["GET", "/repairs/ticket-1/quote/pdf"],
    ["DELETE", "/repairs/ticket-1/parts/part-1"],
  ] as const)("rejects an unassigned technician for %s %s", async (method, url) => {
    const app = Fastify();
    const findUnique = vi.fn().mockResolvedValue({
      id: "ticket-1", customerId: "client-1", assignedTo: "other-tech",
    });
    const findFirst = vi.fn();
    app.decorate("prisma", { repairTicket: { findUnique }, repairPartUsed: { findFirst } });
    app.decorate("authenticate", async () => {});
    app.addHook("onRequest", async (request) => {
      request.user = { id: "tech-1", userId: "tech-1", email: "tech@example.fr", role: "TECHNICIAN" };
    });
    app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
      reply.status(error.statusCode ?? 500).send({ success: false, error: { code: error.code, message: error.message } });
    });
    await app.register(repairRoutes);
    await app.register(quoteRoutes);
    try {
      const res = await app.inject({ method, url });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
      expect(findFirst).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
