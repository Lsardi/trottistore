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
import { repairRoutes } from "./routes/tickets/index.js";
import { technicianRoutes } from "./routes/technicians/index.js";
import { statsRoutes } from "./routes/stats/index.js";
import { ZodError } from "zod";
import { validateEnv, COMMON_ENV, mapPrismaError, AppError } from "@trottistore/shared";

validateEnv("sav", [
  ...COMMON_ENV,
  { name: "PORT_SAV", required: false },
  { name: "SMTP_HOST", required: false },
  { name: "BREVO_API_KEY", required: false },
]);

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
  await app.register(authPlugin);

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    const hasAuthorizationHeader = typeof request.headers.authorization === "string" && request.headers.authorization.length > 0;
    const isHealth =
      path === "/health" ||
      path === "/ready" ||
      path.startsWith("/api/v1/health") ||
      path.startsWith("/api/v1/ready");
    const isPublicSavIntake =
      request.method === "POST" &&
      (path === "/api/v1/repairs" || path === "/repairs");
    const isPublicTracking = request.method === "GET" && path.startsWith("/api/v1/repairs/tracking/");
    const isPublicSlots = request.method === "GET" && (path === "/api/v1/appointments/slots" || path === "/appointments/slots");
    const isPublicAppointmentBooking = request.method === "POST" && (path === "/api/v1/appointments" || path === "/appointments");
    const isPublicQuoteAccept = request.method === "PUT" && path.endsWith("/quote/accept-client");

    if (isHealth || isPublicTracking || isPublicSlots || isPublicAppointmentBooking || isPublicQuoteAccept) {
      return;
    }

    // Intake stays public for guests, but if a token is provided we authenticate
    // so the ticket can be linked to the connected customer account.
    if (isPublicSavIntake) {
      if (hasAuthorizationHeader) {
        await app.authenticate(request, reply);
      }
      return;
    }
    await app.authenticate(request, reply);
  });

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
