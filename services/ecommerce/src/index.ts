import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), "../../.env") });

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
import { leadRoutes } from "./routes/leads/index.js";
import { addressRoutes } from "./routes/addresses/index.js";
import { stockRoutes } from "./routes/stock/index.js";
import { checkoutRoutes } from "./routes/checkout/index.js";
import { merchantRoutes } from "./routes/merchant/index.js";
import { ZodError } from "zod";
import { validateEnv, COMMON_ENV, mapPrismaError, AppError } from "@trottistore/shared";

// Fail-fast if required env vars are missing
validateEnv("ecommerce", [
  ...COMMON_ENV,
  { name: "PORT_ECOMMERCE", required: false },
  { name: "STRIPE_SECRET_KEY", required: false },
  { name: "STRIPE_WEBHOOK_SECRET", required: false },
]);

const PORT = parseInt(process.env.PORT_ECOMMERCE || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  const app = Fastify({
    trustProxy: true,
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
    const prismaAppError = mapPrismaError(error);
    if (prismaAppError) {
      error = prismaAppError as AppError & { statusCode?: number };
    }
    const errorWithCode = error as { code?: unknown };
    const isZodError = error instanceof ZodError;
    const statusCode = isZodError ? 400 : error.statusCode || 500;
    const customCode =
      statusCode < 500 && typeof errorWithCode.code === "string"
        ? errorWithCode.code
        : undefined;
    const code =
      customCode ??
      (isZodError
        ? "VALIDATION_ERROR"
        : statusCode === 401
          ? "UNAUTHORIZED"
          : statusCode === 403
            ? "FORBIDDEN"
            : statusCode === 404
              ? "NOT_FOUND"
              : statusCode === 429
                ? "RATE_LIMITED"
                : statusCode >= 500
                  ? "INTERNAL_ERROR"
                  : "REQUEST_ERROR");
    const message = isZodError
      ? "Invalid request data"
      : statusCode >= 500
        ? "Une erreur interne est survenue"
        : error.message;

    app.log.error({
      err: error,
      method: request.method,
      url: request.url,
      statusCode,
    });

    reply.status(statusCode).send({
      success: false,
      error: {
        code,
        message,
        ...(isZodError ? { details: error.flatten().fieldErrors } : {}),
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
  await app.register(leadRoutes, { prefix: "/api/v1" });
  await app.register(stockRoutes, { prefix: "/api/v1" });
  await app.register(checkoutRoutes, { prefix: "/api/v1" });
  await app.register(merchantRoutes, { prefix: "/api/v1" });
  await app.register(addressRoutes, { prefix: "/api/v1" });

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
