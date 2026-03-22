import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { status: "ok", service: "ecommerce", timestamp: new Date().toISOString() };
  });

  app.get("/ready", async () => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      await app.redis.ping();
      return { status: "ready", service: "ecommerce" };
    } catch (err) {
      return { status: "not_ready", service: "ecommerce", error: (err as Error).message };
    }
  });
}
