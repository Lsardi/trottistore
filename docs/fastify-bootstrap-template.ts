/**
 * Shared Fastify bootstrap — common setup for all TrottiStore services.
 *
 * Usage in a service index.ts:
 *   import { createApp } from "@trottistore/shared";
 *   const app = await createApp({ name: "ecommerce" });
 *   // Register service-specific routes and hooks
 *   await app.listen({ port: 3001, host: "0.0.0.0" });
 */

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { mapPrismaError } from "./errors.js";

export interface CreateAppOptions {
  name: string;
  logLevel?: string;
}

/**
 * Create a pre-configured Fastify instance with standard plugins and error handling.
 */
export async function createApp(options: CreateAppOptions): Promise<FastifyInstance> {
  const { name, logLevel } = options;
  const isProd = process.env.NODE_ENV === "production";

  const app = Fastify({
    logger: {
      level: logLevel || (isProd ? "info" : "debug"),
      transport: !isProd
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    },
  });

  // Global plugins
  await app.register(cors, {
    origin: process.env.BASE_URL || "http://localhost:3000",
    credentials: true,
  });

  await app.register(helmet);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Global error handler
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    // Check for Prisma known errors first
    const prismaHandled = mapPrismaError(error);
    if (prismaHandled) {
      app.log.warn({ err: error, method: request.method, url: request.url }, `Prisma error mapped to ${prismaHandled.statusCode}`);
      return reply.status(prismaHandled.statusCode).send({
        success: false,
        error: { code: prismaHandled.code, message: prismaHandled.message },
      });
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
        ...(isZodError ? { details: (error as ZodError).flatten().fieldErrors } : {}),
      },
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  return app;
}
