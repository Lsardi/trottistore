import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { productRoutes } from "./routes/products/index.js";
import { cartRoutes } from "./routes/cart/index.js";
import { orderRoutes } from "./routes/orders/index.js";
import { categoryRoutes } from "./routes/categories/index.js";
import { authRoutes } from "./routes/auth/index.js";
import { adminRoutes } from "./routes/admin/index.js";

const PORT = parseInt(process.env.PORT_ECOMMERCE || "3001", 10);
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

  // Plugins métier
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);

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
  await app.register(productRoutes, { prefix: "/api/v1" });
  await app.register(cartRoutes, { prefix: "/api/v1" });
  await app.register(orderRoutes, { prefix: "/api/v1" });
  await app.register(categoryRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(adminRoutes, { prefix: "/api/v1" });

  // Démarrage
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`🛒 Service E-commerce démarré sur http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
