/**
 * Integration tests for site settings routes.
 *
 * Covers: read (public), update (ADMIN+ only), merge behavior,
 * RBAC enforcement, validation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { settingsRoutes } from "./index.js";

const SETTINGS_FIXTURE = {
  id: "default",
  settings: {
    legal: { siret: "123 456 789 00012", director: "Jean Dupont" },
    contact: { email: "contact@test.fr" },
  },
  updatedAt: new Date(),
  updatedBy: "admin-1",
};

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    siteSettings: {
      findUnique: vi.fn().mockResolvedValue(SETTINGS_FIXTURE),
      upsert: vi.fn().mockResolvedValue(SETTINGS_FIXTURE),
    },
  });

  app.decorate("redis", { get: vi.fn(), set: vi.fn(), del: vi.fn() });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    reply.status(isZodError ? 400 : error.statusCode || 500).send({
      success: false,
      error: { code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR", message: error.message },
    });
  });

  return app;
}

async function signToken(app: FastifyInstance, role = "ADMIN"): Promise<string> {
  return app.jwt.sign({ sub: "admin-1", email: "admin@test.com", role });
}

describe("Site settings routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(settingsRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  describe("GET /admin/settings", () => {
    it("returns settings without auth (public for frontend)", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/admin/settings" });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().data.legal.siret).toBe("123 456 789 00012");
    });

    it("returns empty object if no settings exist", async () => {
      (app.prisma.siteSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await app.inject({ method: "GET", url: "/api/v1/admin/settings" });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual({});
    });
  });

  describe("PUT /admin/settings", () => {
    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/settings",
        payload: { legal: { siret: "999" } },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 403 for CLIENT role", async () => {
      const token = await signToken(app, "CLIENT");
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/settings",
        headers: { authorization: `Bearer ${token}` },
        payload: { legal: { siret: "999" } },
      });
      expect(res.statusCode).toBe(403);
    });

    it("updates settings for ADMIN", async () => {
      const token = await signToken(app);
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/settings",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          legal: { siret: "999 888 777 00011", rcs: "RCS Bobigny" },
          contact: { phone: "0612345678" },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(app.prisma.siteSettings.upsert).toHaveBeenCalledOnce();
    });

    it("merges with existing settings (does not overwrite)", async () => {
      const token = await signToken(app);
      await app.inject({
        method: "PUT",
        url: "/api/v1/admin/settings",
        headers: { authorization: `Bearer ${token}` },
        payload: { legal: { rcs: "RCS Paris" } },
      });

      // The upsert should have been called with merged data
      const upsertCall = (app.prisma.siteSettings.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const createdSettings = upsertCall.create.settings;
      // Should contain both old siret AND new rcs
      expect(createdSettings.legal.siret).toBe("123 456 789 00012");
      expect(createdSettings.legal.rcs).toBe("RCS Paris");
    });
  });
});
