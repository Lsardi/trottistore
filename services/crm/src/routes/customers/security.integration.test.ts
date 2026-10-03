import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { customerRoutes } from "./index.js";
import { campaignRoutes } from "../campaigns/index.js";
import type { Role } from "@trottistore/shared";

async function buildApp(role: Role) {
  const app = Fastify();
  const fixture: Record<string, unknown> = {
    id: "client-1", email: "client@example.fr", role: "CLIENT", status: "ACTIVE",
    passwordHash: "SECRET", tokenVersion: 42, customerProfile: null, orders: [], addresses: [],
  };
  const findUnique = vi.fn(async (args: { select?: Record<string, unknown> }) =>
    args.select ? Object.fromEntries(Object.entries(fixture).filter(([key]) => key in args.select!)) : fixture);
  app.decorate("prisma", { user: { findUnique, update: vi.fn() } });
  app.addHook("onRequest", async (request) => {
    request.user = { id: "caller", userId: "caller", email: "caller@example.fr", role };
  });
  await app.register(customerRoutes);
  await app.register(campaignRoutes);
  await app.ready();
  return { app, fixture, findUnique };
}

describe("CRM security", () => {
  it("selects safe customer fields and never returns passwordHash", async () => {
    const { app, findUnique } = await buildApp("ADMIN");
    try {
      const res = await app.inject("/customers/client-1");
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain("passwordHash");
      expect(res.body).not.toContain("SECRET");
      const query = findUnique.mock.calls[0][0];
      expect(query.select).toMatchObject({ id: true, email: true, role: true, emailVerified: true });
      expect(query.select).not.toHaveProperty("passwordHash");
    } finally { await app.close(); }
  });
  it("denies all customer access to TECHNICIAN", async () => {
    const { app, findUnique } = await buildApp("TECHNICIAN");
    try {
      expect((await app.inject("/customers/client-1")).statusCode).toBe(403);
      expect(findUnique).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
  it("denies campaign creation to STAFF", async () => {
    const { app } = await buildApp("STAFF");
    try {
      const res = await app.inject({ method: "POST", url: "/campaigns", payload: {} });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
    } finally { await app.close(); }
  });
  it("denies ADMIN a status change on SUPERADMIN", async () => {
    const { app, fixture } = await buildApp("ADMIN");
    fixture.role = "SUPERADMIN";
    try {
      const res = await app.inject({ method: "PUT", url: "/customers/client-1/status", payload: { status: "SUSPENDED" } });
      expect(res.statusCode).toBe(403);
      expect(app.prisma.user.update).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
