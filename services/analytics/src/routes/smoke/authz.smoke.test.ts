import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { authPlugin } from "../../plugins/auth.js";

function makeToken(app: FastifyInstance, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  return app.jwt.sign({
    sub: "00000000-0000-0000-0000-000000000333",
    email: "smoke@trottistore.test",
    role,
    iat: now,
    exp: now + 15 * 60,
  });
}

describe("Analytics auth guard smoke", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-secret";

    app = Fastify({ logger: false });
    await app.register(authPlugin);

    app.addHook("onRequest", async (request, reply) => {
      const path = request.url.split("?")[0];
      if (
        path === "/health" ||
        path === "/ready" ||
        path.startsWith("/api/v1/health") ||
        path.startsWith("/api/v1/ready")
      ) {
        return;
      }

      await app.authenticate(request, reply);
      const role = request.user?.role;
      const allowed = role === "SUPERADMIN" || role === "ADMIN" || role === "MANAGER";
      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Access analytics requires MANAGER or ADMIN role",
          },
        });
      }
    });

    app.get("/api/v1/analytics/realtime", async () => ({ success: true, data: {} }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/analytics/realtime" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for CLIENT role", async () => {
    const token = makeToken(app, "CLIENT");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/realtime",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 for MANAGER role", async () => {
    const token = makeToken(app, "MANAGER");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/realtime",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
