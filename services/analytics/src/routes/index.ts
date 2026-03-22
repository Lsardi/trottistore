import type { FastifyInstance } from "fastify";
import { z } from "zod";

// --- Schemas ---

const periodQuerySchema = z.object({
  period: z.enum(["day", "week", "month", "quarter", "year"]).default("month"),
});

const analyticsEventSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

const batchEventsSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(1000),
});

// --- Routes ---

export async function analyticsRoutes(app: FastifyInstance) {
  // GET /analytics/realtime — real-time KPIs
  app.get("/analytics/realtime", async (_request, reply) => {
    const now = new Date().toISOString();

    return reply.send({
      revenueToday: 4_589.99,
      ordersToday: 37,
      conversionRate: 3.42,
      activeVisitors: 128,
      currency: "EUR",
      updatedAt: now,
    });
  });

  // GET /analytics/kpis — aggregated KPIs
  app.get("/analytics/kpis", async (request, reply) => {
    const query = periodQuerySchema.parse(request.query);

    return reply.send({
      period: query.period,
      revenue: 128_750.0,
      orders: 1_024,
      averageOrderValue: 125.73,
      conversionRate: 3.18,
      newCustomers: 312,
      returningCustomers: 712,
      currency: "EUR",
    });
  });

  // GET /analytics/products/top — top products
  app.get("/analytics/products/top", async (_request, reply) => {
    return reply.send({
      products: [
        { id: "prod_001", name: "Xiaomi Mi Pro 2", unitsSold: 142, revenue: 71_000.0 },
        { id: "prod_002", name: "Segway Ninebot Max G2", unitsSold: 98, revenue: 63_700.0 },
        { id: "prod_003", name: "Dualtron Thunder 3", unitsSold: 45, revenue: 112_500.0 },
        { id: "prod_004", name: "Vsett 10+", unitsSold: 67, revenue: 80_400.0 },
        { id: "prod_005", name: "Kaabo Mantis King GT", unitsSold: 53, revenue: 58_300.0 },
      ],
      currency: "EUR",
    });
  });

  // POST /analytics/events — batch event ingestion
  app.post("/analytics/events", async (request, reply) => {
    const { events } = batchEventsSchema.parse(request.body);

    // TODO: persist events to database / queue via BullMQ
    app.log.info(`Ingested ${events.length} analytics event(s)`);

    return reply.status(202).send({
      accepted: events.length,
      message: `${events.length} event(s) queued for processing`,
    });
  });
}
