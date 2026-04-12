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
import { reviewRoutes } from "./routes/reviews/index.js";
import { adminUserRoutes } from "./routes/admin-users/index.js";
import { auditRoutes } from "./routes/admin-audit/index.js";
import { invoiceRoutes } from "./routes/admin-invoices/index.js";
import { financeRoutes } from "./routes/finance/index.js";
import { metricsPlugin } from "./plugins/metrics.js";
import { ZodError } from "zod";
import { validateEnv, COMMON_ENV, mapPrismaError, AppError } from "@trottistore/shared";
import { runFinancialReconciliation } from "./lib/finance-reconciliation.js";

// Fail-fast if required env vars are missing
validateEnv("ecommerce", [
  ...COMMON_ENV,
  { name: "COOKIE_SECRET", required: true, secret: true },
  { name: "PORT_ECOMMERCE", required: false },
  { name: "STRIPE_SECRET_KEY", required: false },
  { name: "STRIPE_WEBHOOK_SECRET", required: false },
]);

const PORT = parseInt(process.env.PORT_ECOMMERCE || "3001", 10);
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
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
  });

  // Plugins métier
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(metricsPlugin);

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
  await app.register(reviewRoutes, { prefix: "/api/v1" });
  await app.register(adminUserRoutes, { prefix: "/api/v1" });
  await app.register(auditRoutes, { prefix: "/api/v1" });
  await app.register(invoiceRoutes, { prefix: "/api/v1" });
  await app.register(financeRoutes, { prefix: "/api/v1" });

  // API docs — list available routes
  app.get("/api/v1/docs", async () => ({
    service: "ecommerce",
    version: "1.0",
    endpoints: {
      auth: {
        "POST /api/v1/auth/register": "Create account (email, password, firstName, lastName)",
        "POST /api/v1/auth/login": "Login (email, password) → accessToken",
        "POST /api/v1/auth/refresh": "Refresh token (cookie)",
        "POST /api/v1/auth/logout": "Logout",
        "POST /api/v1/auth/logout-all": "Logout all devices (revoke all refresh tokens)",
        "GET /api/v1/auth/me": "Current user profile (Bearer token)",
        "GET /api/v1/auth/export": "Export personal data (RGPD)",
        "DELETE /api/v1/auth/account": "Delete account (RGPD)",
      },
      products: {
        "GET /api/v1/products": "List products (?page, limit, sort, search, categorySlug)",
        "GET /api/v1/products/:slug": "Product detail by slug",
        "GET /api/v1/products/featured": "Featured products",
      },
      cart: {
        "GET /api/v1/cart": "Get cart (x-session-id header or Bearer token)",
        "POST /api/v1/cart/items": "Add item (productId, variantId?, quantity)",
        "PUT /api/v1/cart/items/:productId": "Update quantity",
        "DELETE /api/v1/cart/items/:productId": "Remove item",
        "DELETE /api/v1/cart": "Clear cart",
      },
      orders: {
        "POST /api/v1/orders": "Create order (auth required: shippingAddressId, paymentMethod, acceptedCgv)",
        "POST /api/v1/orders/guest": "Guest order (email, shippingAddress, paymentMethod, acceptedCgv)",
        "GET /api/v1/orders": "List user orders",
      },
      checkout: {
        "GET /api/v1/checkout/config": "Stripe publishable key",
        "POST /api/v1/checkout/payment-intent": "Create Stripe PaymentIntent",
        "POST /api/v1/checkout/webhook": "Stripe webhook handler (signature verified)",
      },
      categories: {
        "GET /api/v1/categories": "List categories",
      },
      admin: {
        "GET /api/v1/admin/orders": "List all orders (admin)",
        "GET /api/v1/admin/orders/:id": "Order detail (admin)",
        "PUT /api/v1/admin/orders/:id/status": "Change order status",
        "PUT /api/v1/admin/orders/:id/tracking": "Add tracking number",
        "GET /api/v1/admin/checkout/webhooks/dlq": "List webhook DLQ entries",
        "POST /api/v1/admin/checkout/webhooks/dlq/replay": "Replay webhook DLQ entries",
        "GET /api/v1/admin/finance/reconciliation": "Run financial reconciliation report",
        "POST /api/v1/admin/finance/reconciliation/run": "Run financial reconciliation now",
        "GET /api/v1/admin/categories": "List categories with counts",
        "POST /api/v1/admin/categories": "Create category",
        "PUT /api/v1/admin/categories/:id": "Update category",
        "DELETE /api/v1/admin/categories/:id": "Delete empty category",
        "POST /api/v1/admin/products": "Create product",
        "PUT /api/v1/admin/products/:id": "Update product",
        "DELETE /api/v1/admin/products/:id": "Delete product",
      },
    },
  }));

  // Démarrage
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Service E-commerce demarre sur http://${HOST}:${PORT}`);

    // Startup warnings for missing optional config
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      app.log.warn("STRIPE_WEBHOOK_SECRET not set — webhook signature verification disabled. Payment confirmations will fail in production.");
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      app.log.warn("STRIPE_SECRET_KEY not set — checkout disabled.");
    }

    // Financial reconciliation scheduler (default every 60 minutes).
    if (process.env.FINANCE_RECONCILE_ENABLED !== "false") {
      const intervalMinutes = Number(process.env.FINANCE_RECONCILE_INTERVAL_MINUTES || "60");
      const intervalMs = Math.max(5, Number.isFinite(intervalMinutes) ? intervalMinutes : 60) * 60 * 1000;

      const run = async () => {
        try {
          const report = await runFinancialReconciliation(app);
          app.log.info(
            {
              discrepancies: report.discrepanciesCount,
              orphanPayments: report.orphanPaymentsCount,
              stalePending: report.stalePendingPaymentsCount,
            },
            "Financial reconciliation completed",
          );
        } catch (error) {
          app.log.error({ err: error }, "Financial reconciliation failed");
        }
      };

      void run();
      const timer = setInterval(() => void run(), intervalMs);
      app.addHook("onClose", async () => {
        clearInterval(timer);
      });
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
