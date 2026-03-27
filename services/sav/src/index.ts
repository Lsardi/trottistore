import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { healthRoutes } from "./routes/health.js";
import { repairRoutes } from "./routes/tickets/index.js";
import { technicianRoutes } from "./routes/technicians/index.js";
import { statsRoutes } from "./routes/stats/index.js";

const PORT = parseInt(process.env.PORT_SAV || "3004", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // Plugins globaux
  await app.register(cors, {
    origin: process.env.BASE_URL || "http://localhost:3000",
    credentials: true,
  });

  await app.register(helmet);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Plugins metier
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // Global error handler
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const statusCode = error.statusCode || 500;

    app.log.error({
      err: error,
      method: request.method,
      url: request.url,
      statusCode,
    });

    reply.status(statusCode).send({
      success: false,
      error: {
        code: statusCode === 429 ? "RATE_LIMITED" : statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message: statusCode >= 500 ? "Une erreur interne est survenue" : error.message,
        ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
      },
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} introuvable`,
      },
    });
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(repairRoutes, { prefix: "/api/v1" });
  await app.register(technicianRoutes, { prefix: "/api/v1" });
  await app.register(statsRoutes, { prefix: "/api/v1" });

  // Demarrage
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Service SAV demarre sur http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
