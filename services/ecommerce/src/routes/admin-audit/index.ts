/**
 * Audit trail routes — view who did what, when.
 *
 * GET /admin/audit-log — paginated, filterable by resource/action/user.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../../plugins/auth.js";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  resource: z.string().max(50).optional(),
  action: z.string().max(50).optional(),
  userId: z.string().uuid().optional(),
});

export async function auditRoutes(app: FastifyInstance) {
  const adminOnly = {
    preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN")],
  };

  // GET /admin/audit-log — Paginated audit log
  app.get("/admin/audit-log", adminOnly, async (request) => {
    const query = querySchema.parse(request.query);
    const skip = (query.page - 1) * query.limit;

    const where: Record<string, unknown> = {};
    if (query.resource) where.resource = query.resource;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;

    const [entries, total] = await Promise.all([
      app.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      app.prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: entries,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  });
}

/**
 * Helper to log an audit entry. Non-blocking — errors are logged, not thrown.
 */
export async function logAudit(
  prisma: { auditLog: { create: (args: unknown) => Promise<unknown> } },
  entry: {
    userId?: string;
    userName?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: string;
    ipAddress?: string;
  },
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        userName: entry.userName ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        details: entry.details ?? null,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to log:", err);
  }
}
