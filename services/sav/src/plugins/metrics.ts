import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import client from "prom-client";

// Default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ prefix: "trottistore_" });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: "trottistore_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const httpRequestDuration = new client.Histogram({
  name: "trottistore_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const metricsPlugin = fp(async (app: FastifyInstance) => {
  // Track request duration and count
  app.addHook("onResponse", (request, reply, done) => {
    const route = request.routeOptions?.url || request.url.split("?")[0];
    const labels = {
      method: request.method,
      route,
      status_code: reply.statusCode.toString(),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
    done();
  });

  // Expose /metrics endpoint
  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", client.register.contentType);
    return client.register.metrics();
  });
});
