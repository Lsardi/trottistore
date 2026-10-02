import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { authPlugin } from "../../plugins/auth.js";
import { authRoutes } from "./index.js";

describe("atomic refresh rotation", () => {
  it("rejects a second claim even when both requests read an unrevoked token", async () => {
    process.env.JWT_ACCESS_SECRET = "refresh-test-secret";
    const app = Fastify();
    const user = { id: "user-1", email: "user@example.fr", role: "CLIENT", status: "ACTIVE", tokenVersion: 0 };
    let claimed = false;
    const updateMany = vi.fn(async (args: { where: { id?: string } }) => {
      if (args.where.id) {
        if (claimed) return { count: 0 };
        claimed = true;
      }
      return { count: 1 };
    });
    const create = vi.fn().mockResolvedValue({});
    const tx = { refreshToken: { updateMany, create } };
    app.decorate("prisma", {
      refreshToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "refresh-1", userId: user.id, user, revokedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
        }),
      },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    });
    await app.register(authPlugin);
    await app.register(authRoutes);
    await app.ready();
    try {
      const request = { method: "POST" as const, url: "/auth/refresh", headers: { cookie: "refresh_token=same-token" } };
      expect((await app.inject(request)).statusCode).toBe(200);
      const second = await app.inject(request);
      expect(second.statusCode).toBe(401);
      expect(second.json().error.code).toBe("REFRESH_REUSED");
      expect(create).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { userId: user.id, revokedAt: null }, data: { revokedAt: expect.any(Date) },
      });
      expect(app.prisma.$transaction).toHaveBeenCalledTimes(2);
    } finally { await app.close(); }
  });
});
