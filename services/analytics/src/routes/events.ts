import type { FastifyInstance } from "fastify";
import { z } from "zod";

const publicFunnelEventTypeSchema = z.enum([
  "diagnostic_category_selected",
  "diagnostic_result_viewed",
  "diagnostic_ticket_cta_clicked",
  "urgence_slots_loaded",
  "urgence_ticket_created",
  "repair_tracking_viewed",
]);

const analyticsEventSchema = z.object({
  type: z.string().min(1).max(100),
  sessionId: z.string().optional(),
  userId: z.string().uuid().optional(),
  properties: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

const batchEventsSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(1000),
});

const publicFunnelEventSchema = z.object({
  type: publicFunnelEventTypeSchema,
  sessionId: z.string().optional(),
  properties: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
  timestamp: z.string().datetime().optional(),
});

const publicBatchEventsSchema = z.object({
  events: z.array(publicFunnelEventSchema).min(1).max(50),
});

const REDIS_EVENTS_KEY = "analytics:events";

export async function eventsRoutes(app: FastifyInstance) {
  // POST /analytics/events — batch event ingestion
  app.post("/analytics/events", async (request, reply) => {
    const { events } = batchEventsSchema.parse(request.body);

    // Normalize events with timestamps and push to Redis list for future ClickHouse ingestion
    const pipeline = app.redis.pipeline();
    for (const event of events) {
      const normalized = {
        ...event,
        timestamp: event.timestamp ?? new Date().toISOString(),
        receivedAt: new Date().toISOString(),
      };
      pipeline.rpush(REDIS_EVENTS_KEY, JSON.stringify(normalized));
    }
    await pipeline.exec();

    app.log.info(`Ingested ${events.length} analytics event(s) into Redis`);

    return reply.status(202).send({
      accepted: events.length,
      message: `${events.length} event(s) queued for processing`,
    });
  });

  // POST /analytics/events/public — public funnel events (no auth)
  app.post("/analytics/events/public", async (request, reply) => {
    const { events } = publicBatchEventsSchema.parse(request.body);

    const headerSession = request.headers["x-session-id"];
    const sessionId =
      typeof headerSession === "string"
        ? headerSession
        : Array.isArray(headerSession)
          ? headerSession[0]
          : undefined;

    const pipeline = app.redis.pipeline();
    for (const event of events) {
      const normalized = {
        ...event,
        source: "web_funnel",
        sessionId: event.sessionId ?? sessionId,
        timestamp: event.timestamp ?? new Date().toISOString(),
        receivedAt: new Date().toISOString(),
      };
      pipeline.rpush(REDIS_EVENTS_KEY, JSON.stringify(normalized));
    }
    await pipeline.exec();

    return reply.status(202).send({
      accepted: events.length,
      message: `${events.length} public funnel event(s) queued`,
    });
  });
}
