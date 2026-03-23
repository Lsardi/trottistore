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

  // Routes
  await app.register(healthRoutes);
  await app.register(productRoutes, { prefix: "/api/v1" });
  await app.register(cartRoutes, { prefix: "/api/v1" });
  await app.register(orderRoutes, { prefix: "/api/v1" });
  await app.register(categoryRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1" });

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
