import type { FastifyInstance } from "fastify";
import { TERMINAL_STATUSES } from "../../utils/status-machine.js";

const TERMINAL_ARRAY = [...TERMINAL_STATUSES];

export async function statsRoutes(app: FastifyInstance) {
  // GET /repairs/stats — SAV statistics with real Prisma aggregations
  app.get("/repairs/stats", async () => {
    // All queries run in parallel for performance
    const [
      byStatusRaw,
      byTypeRaw,
      closedTickets,
      partsCostResult,
      openCount,
      closedThisMonthCount,
    ] = await Promise.all([
      // Tickets by status
      app.prisma.repairTicket.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      // Tickets by type
      app.prisma.repairTicket.groupBy({
        by: ["type"],
        _count: { id: true },
      }),

      // Closed tickets for average resolution time calculation
      app.prisma.repairTicket.findMany({
        where: {
          closedAt: { not: null },
        },
        select: {
          createdAt: true,
          closedAt: true,
        },
      }),

      // Total parts cost: sum(unitCost * quantity) via raw query for accuracy
      app.prisma.$queryRaw<[{ total: number | null }]>`
        SELECT COALESCE(SUM(unit_cost * quantity), 0)::float AS total
        FROM sav.repair_parts_used
      `,

      // Open tickets count (non-terminal statuses)
      app.prisma.repairTicket.count({
        where: {
          status: { notIn: TERMINAL_ARRAY },
        },
      }),

      // Tickets closed this month
      app.prisma.repairTicket.count({
        where: {
          closedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    // Format byStatus as { STATUS: count }
    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count.id;
    }

    // Format byType as { TYPE: count }
    const byType: Record<string, number> = {};
    for (const row of byTypeRaw) {
      byType[row.type] = row._count.id;
    }

    // Average resolution time in hours
    let averageResolutionHours: number | null = null;
    if (closedTickets.length > 0) {
      const totalHours = closedTickets.reduce((sum, t) => {
        if (!t.closedAt) return sum;
        const diffMs = t.closedAt.getTime() - t.createdAt.getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }, 0);
      averageResolutionHours = Math.round((totalHours / closedTickets.length) * 100) / 100;
    }

    const totalPartsCost = partsCostResult[0]?.total ?? 0;

    return {
      success: true,
      data: {
        byStatus,
        byType,
        averageResolutionHours,
        totalPartsCost,
        openTickets: openCount,
        closedThisMonth: closedThisMonthCount,
      },
    };
  });
}
