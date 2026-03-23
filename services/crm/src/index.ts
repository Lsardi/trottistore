import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { healthRoutes } from "./routes/health.js";
import { customerRoutes } from "./routes/customers/index.js";
import { segmentRoutes } from "./routes/segments/index.js";
import { campaignRoutes } from "./routes/campaigns/index.js";

const PORT = parseInt(process.env.PORT_CRM || "3002", 10);
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

  // Routes
  await app.register(healthRoutes);
  await app.register(customerRoutes, { prefix: "/api/v1" });
  await app.register(segmentRoutes, { prefix: "/api/v1" });
  await app.register(campaignRoutes, { prefix: "/api/v1" });

  // Demarrage
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Service CRM demarre sur http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
