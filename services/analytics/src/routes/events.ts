import type { FastifyInstance } from "fastify";
import { z } from "zod";

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
}
