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

  // GET /repairs/diagnostic-stats — Aggregated repair data for the diagnostic tool.
  // Groups closed tickets by issue keywords to provide real cost/duration estimates.
  app.get("/repairs/diagnostic-stats", async () => {
    const closedTickets = await app.prisma.repairTicket.findMany({
      where: {
        closedAt: { not: null },
        actualCost: { not: null },
      },
      select: {
        issueDescription: true,
        diagnosis: true,
        actualCost: true,
        estimatedDays: true,
        createdAt: true,
        closedAt: true,
        type: true,
      },
    });

    // Keyword-based categorization matching the diagnostic tool's categories.
    // Keywords cover both French and technical terms.
    const categories: Record<string, { keyword: string; tickets: typeof closedTickets }> = {
      electrical: { keyword: "electri|moteur|controll|controleur|accelerat|freinage electr|court-circuit|fusible|cablage|connecteur", tickets: [] },
      battery: { keyword: "batter|batterie|charg|autonomi|tension|cellule|bms|accumulat|lithium|decharge", tickets: [] },
      braking: { keyword: "frein|plaquette|disque|levier|cable frein|hydraulique|etrier|patins", tickets: [] },
      display: { keyword: "ecran|display|affich|tableau|compteur|led|retroeclairage|ecran lcd", tickets: [] },
      mechanical: { keyword: "pneu|roue|roulement|fourche|deck|direction|amortisseur|suspension|crevaison|chambre|pliage|collier|guidon|potence", tickets: [] },
      other: { keyword: "", tickets: [] }, // Catch-all for uncategorized
    };

    for (const ticket of closedTickets) {
      const text = `${ticket.issueDescription} ${ticket.diagnosis || ""}`.toLowerCase();
      let matched = false;
      for (const [catKey, cat] of Object.entries(categories)) {
        if (catKey === "other") continue; // Skip catch-all during matching
        const patterns = cat.keyword.split("|");
        if (patterns.some((p) => text.includes(p))) {
          cat.tickets.push(ticket);
          matched = true;
          break;
        }
      }
      if (!matched) {
        categories.other.tickets.push(ticket);
      }
    }

    const stats = Object.entries(categories).map(([key, cat]) => {
      const tickets = cat.tickets;
      if (tickets.length === 0) {
        return { category: key, count: 0, avgCost: null, avgDays: null, minCost: null, maxCost: null };
      }

      const costs = tickets.map((t) => Number(t.actualCost));
      const days = tickets
        .filter((t) => t.closedAt)
        .map((t) => {
          const diffMs = t.closedAt!.getTime() - t.createdAt.getTime();
          return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        });

      return {
        category: key,
        count: tickets.length,
        avgCost: Math.round(costs.reduce((s, c) => s + c, 0) / costs.length),
        minCost: Math.min(...costs),
        maxCost: Math.max(...costs),
        avgDays: days.length > 0 ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : null,
      };
    });

    return {
      success: true,
      data: {
        categories: stats,
        totalRepairs: closedTickets.length,
        lastUpdated: new Date().toISOString(),
      },
    };
  });
}
