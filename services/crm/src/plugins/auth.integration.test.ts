import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { authPlugin } from "./auth.js";

async function buildApp(withRedis = false) {
  process.env.JWT_ACCESS_SECRET = "security-test-secret";
  const app = Fastify();
  const user = { id: "user-1", status: "ACTIVE", role: "ADMIN", tokenVersion: 3 };
  const findUnique = vi.fn(async () => ({ ...user }));
  app.decorate("prisma", { user: { findUnique } });
  const cache = new Map<string, string>();
  const redis = {
    get: vi.fn(async (key: string) => cache.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { cache.set(key, value); return "OK"; }),
    del: vi.fn(async (key: string) => { cache.delete(key); return 1; }),
  };
  if (withRedis) app.decorate("redis", redis);
  await app.register(authPlugin);
  app.get("/protected", { preHandler: [app.authenticate] }, async () => ({ success: true }));
  await app.ready();
  const token = (version: number | undefined = 3, role = "ADMIN") =>
    app.jwt.sign({ sub: user.id, email: "user@example.fr", role, ...(version === undefined ? {} : { tokenVersion: version }) });
  return { app, user, findUnique, redis, token };
}

describe("access token revocation", () => {
  it("reads DB directly without Redis and rejects stale versions", async () => {
    const { app, token, findUnique } = await buildApp();
    try {
      const res = await app.inject({ url: "/protected", headers: { authorization: `Bearer ${token(2)}` } });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ success: false, error: { code: "TOKEN_REVOKED" } });
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" }, select: { id: true, status: true, role: true, tokenVersion: true },
      });
    } finally { await app.close(); }
  });
  it("rejects suspended accounts and stale roles", async () => {
    const { app, user, token } = await buildApp();
    try {
      user.status = "SUSPENDED";
      expect((await app.inject({ url: "/protected", headers: { authorization: `Bearer ${token()}` } })).statusCode).toBe(401);
      user.status = "ACTIVE";
      expect((await app.inject({ url: "/protected", headers: { authorization: `Bearer ${token(3, "SUPERADMIN")}` } })).statusCode).toBe(401);
      const legacy = app.jwt.sign({ sub: user.id, email: "user@example.fr", role: "ADMIN" });
      expect((await app.inject({ url: "/protected", headers: { authorization: `Bearer ${legacy}` } })).json().error.code).toBe("TOKEN_REVOKED");
    } finally { await app.close(); }
  });
  it("caches for 60 seconds and falls back to DB when Redis fails", async () => {
    const { app, findUnique, redis, token } = await buildApp(true);
    try {
      const headers = { authorization: `Bearer ${token()}` };
      expect((await app.inject({ url: "/protected", headers })).statusCode).toBe(200);
      expect((await app.inject({ url: "/protected", headers })).statusCode).toBe(200);
      expect(findUnique).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith("auth:user:user-1", expect.any(String), "EX", 60);
      redis.get.mockRejectedValueOnce(new Error("Redis unavailable"));
      expect((await app.inject({ url: "/protected", headers })).statusCode).toBe(200);
      expect(findUnique).toHaveBeenCalledTimes(2);
    } finally { await app.close(); }
  });
});
