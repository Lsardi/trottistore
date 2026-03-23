import type { FastifyInstance } from "fastify";
import { realtimeRoutes } from "./realtime.js";
import { kpisRoutes } from "./kpis.js";
import { salesRoutes } from "./sales.js";
import { customersRoutes } from "./customers.js";
import { stockRoutes } from "./stock.js";
import { eventsRoutes } from "./events.js";

export async function analyticsRoutes(app: FastifyInstance) {
  await app.register(realtimeRoutes);
  await app.register(kpisRoutes);
  await app.register(salesRoutes);
  await app.register(customersRoutes);
  await app.register(stockRoutes);
  await app.register(eventsRoutes);
}
