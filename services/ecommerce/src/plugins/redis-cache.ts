/**
 * Redis-backed API response cache for high-read endpoints.
 *
 * Usage:
 *   const cached = await getCache(app.redis, "products:featured");
 *   if (cached) return cached;
 *   const data = await expensiveQuery();
 *   await setCache(app.redis, "products:featured", data, 120);
 *   return data;
 */

import type { FastifyInstance } from "fastify";

const CACHE_PREFIX = "cache:";

export async function getCache<T>(redis: FastifyInstance["redis"], key: string): Promise<T | null> {
  try {
    const raw = await redis.get(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCache(
  redis: FastifyInstance["redis"],
  key: string,
  data: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(`${CACHE_PREFIX}${key}`, JSON.stringify(data), "EX", ttlSeconds);
  } catch {
    // Cache write failure is non-fatal
  }
}

export async function invalidateCache(redis: FastifyInstance["redis"], pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Cache invalidation failure is non-fatal
  }
}
