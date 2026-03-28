import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { authPlugin } from "../../plugins/auth.js";

function makeToken(app: FastifyInstance, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  return app.jwt.sign({
    sub: "00000000-0000-0000-0000-000000000222",
    email: "smoke@trottistore.test",
    role,
    iat: now,
    exp: now + 15 * 60,
  });
}

describe("SAV auth guard smoke", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-secret";

    app = Fastify({ logger: false });
    await app.register(authPlugin);

    app.addHook("onRequest", async (request, reply) => {
      const path = request.url.split("?")[0];
      const isHealth =
        path === "/health" ||
        path === "/ready" ||
        path.startsWith("/api/v1/health") ||
        path.startsWith("/api/v1/ready");
      const isPublicSavIntake =
        request.method === "POST" &&
        (path === "/api/v1/repairs" || path === "/repairs");

      if (isHealth || isPublicSavIntake) {
        return;
      }

      await app.authenticate(request, reply);
    });

    app.post("/api/v1/repairs", async () => ({ success: true }));
    app.get("/api/v1/internal", async () => ({ success: true }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows public SAV intake without token", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/repairs", payload: {} });
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 on protected route without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/internal" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 200 on protected route with valid token", async () => {
    const token = makeToken(app, "TECHNICIAN");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/internal",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
