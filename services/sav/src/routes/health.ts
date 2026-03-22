import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { status: "ok", service: "sav", timestamp: new Date().toISOString() };
  });

  app.get("/ready", async () => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      await app.redis.ping();
      return { status: "ready", service: "sav" };
    } catch (err) {
      return { status: "not_ready", service: "sav", error: (err as Error).message };
    }
  });
}
