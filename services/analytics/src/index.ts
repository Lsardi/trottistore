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
import { metricsPlugin } from "./plugins/metrics.js";
import { healthRoutes } from "./routes/health.js";
import { analyticsRoutes } from "./routes/index.js";
import { ZodError } from "zod";
import { validateEnv, COMMON_ENV, mapPrismaError, AppError } from "@trottistore/shared";

validateEnv("analytics", [
  ...COMMON_ENV,
  { name: "PORT_ANALYTICS", required: false },
  { name: "CLICKHOUSE_URL", required: false },
]);

const PORT = parseInt(process.env.PORT_ANALYTICS || "3003", 10);
const HOST = process.env.HOST || "0.0.0.0";

function resolveTrustProxy(): boolean | string[] {
  const configured = process.env.TRUSTED_PROXY_CIDRS?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }

  // Secure-by-default in production: trust proxy headers only if explicitly configured.
  return process.env.NODE_ENV === "production" ? false : true;
}

async function start() {
  const app = Fastify({
    trustProxy: resolveTrustProxy(),
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
    addHeaders: { "x-ratelimit-limit": true, "x-ratelimit-remaining": true, "x-ratelimit-reset": true, "retry-after": true },
  });

  // Plugins métier
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(metricsPlugin);

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    const isPublicFunnelEventIngest =
      request.method === "POST" &&
      (path === "/api/v1/analytics/events/public" || path === "/analytics/events/public");
    if (
      path === "/health" ||
      path === "/metrics" ||
      path === "/ready" ||
      path.startsWith("/api/v1/health") ||
      path.startsWith("/api/v1/metrics") ||
      path.startsWith("/api/v1/ready") ||
      isPublicFunnelEventIngest
    ) {
      return;
    }

    await app.authenticate(request, reply);
    const role = request.user?.role;
    const allowed = role === "SUPERADMIN" || role === "ADMIN" || role === "MANAGER";
    if (!allowed) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Access analytics requires MANAGER or ADMIN role",
        },
      });
    }
  });

  // Global error handler
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const prismaAppError = mapPrismaError(error);
    if (prismaAppError) {
      error = prismaAppError as AppError & { statusCode?: number };
    }
    const errorWithCode = error as { code?: unknown };
    const isZodError = error instanceof ZodError;
    const zodError = isZodError ? (error as ZodError) : null;
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
        ...(zodError ? { details: zodError.flatten().fieldErrors } : {}),
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
  await app.register(analyticsRoutes, { prefix: "/api/v1" });

  // Démarrage
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`📊 Service Analytics démarré sur http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
