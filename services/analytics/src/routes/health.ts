import type { FastifyInstance } from "fastify";

const startedAt = Date.now();

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "analytics",
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async (_request, reply) => {
    const checks: Array<{ name: string; ok: boolean; latencyMs: number; error?: string }> = [];
    let allOk = true;

    const t0 = Date.now();
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      checks.push({ name: "postgresql", ok: true, latencyMs: Date.now() - t0 });
    } catch (err) {
      allOk = false;
      checks.push({ name: "postgresql", ok: false, latencyMs: Date.now() - t0, error: (err as Error).message });
    }

    const t1 = Date.now();
    try {
      await app.redis.ping();
      checks.push({ name: "redis", ok: true, latencyMs: Date.now() - t1 });
    } catch (err) {
      allOk = false;
      checks.push({ name: "redis", ok: false, latencyMs: Date.now() - t1, error: (err as Error).message });
    }

    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? "ready" : "not_ready",
      service: "analytics",
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
