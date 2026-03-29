import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { authPlugin } from "../../plugins/auth.js";

function makeToken(app: FastifyInstance, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  return app.jwt.sign({
    sub: "00000000-0000-0000-0000-000000000111",
    email: "smoke@trottistore.test",
    role,
    iat: now,
    exp: now + 15 * 60,
  });
}

describe("CRM auth guard smoke", () => {
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
      if (request.user?.role === "CLIENT") {
        return reply.status(403).send({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied for CLIENT role on CRM service",
          },
        });
      }
    });

    app.get("/health", async () => ({ ok: true }));
    app.get("/api/v1/customers", async () => ({ success: true, data: [] }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 on protected route without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/customers" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for CLIENT role", async () => {
    const token = makeToken(app, "CLIENT");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/customers",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 for ADMIN role", async () => {
    const token = makeToken(app, "ADMIN");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/customers",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
