import type { FastifyInstance } from "fastify";
import client from "prom-client";

const startedAt = Date.now();

// A10.1 — Expose DB/Redis health as Prometheus gauge for alerting
const dbHealthGauge = new client.Gauge({
  name: "trottistore_database_healthy",
  help: "1 if PostgreSQL is reachable, 0 otherwise",
});

const redisHealthGauge = new client.Gauge({
  name: "trottistore_redis_healthy",
  help: "1 if Redis is reachable, 0 otherwise",
});

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "ecommerce",
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async (_request, reply) => {
    const checks: Array<{ name: string; ok: boolean; latencyMs: number; error?: string }> = [];
    let allOk = true;

    // PostgreSQL
    const t0 = Date.now();
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      checks.push({ name: "postgresql", ok: true, latencyMs: Date.now() - t0 });
      dbHealthGauge.set(1);
    } catch (err) {
      allOk = false;
      checks.push({ name: "postgresql", ok: false, latencyMs: Date.now() - t0, error: (err as Error).message });
      dbHealthGauge.set(0);
    }

    // Redis
    const t1 = Date.now();
    try {
      await app.redis.ping();
      checks.push({ name: "redis", ok: true, latencyMs: Date.now() - t1 });
      redisHealthGauge.set(1);
    } catch (err) {
      allOk = false;
      checks.push({ name: "redis", ok: false, latencyMs: Date.now() - t1, error: (err as Error).message });
      redisHealthGauge.set(0);
    }

    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? "ready" : "not_ready",
      service: "ecommerce",
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
