import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseIdParam } from "@trottistore/shared";
import { TERMINAL_STATUSES } from "../../utils/status-machine.js";

// --- Zod Schemas ---

const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

// Terminal statuses as array for Prisma notIn filter
const TERMINAL_ARRAY = [...TERMINAL_STATUSES];

// --- Routes ---

export async function technicianRoutes(app: FastifyInstance) {
  // GET /technicians — List all technicians with user info
  app.get("/technicians", async () => {
    const technicians = await app.prisma.technician.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Enrich with active ticket count
    const enriched = await Promise.all(
      technicians.map(async (tech) => {
        const activeTicketCount = await app.prisma.repairTicket.count({
          where: {
            assignedTo: tech.userId,
            status: { notIn: TERMINAL_ARRAY },
          },
        });

        return {
          ...tech,
          activeTicketCount,
        };
      })
    );

    return { success: true, data: enriched };
  });

  // GET /technicians/:id/schedule — Technician's active tickets
  app.get("/technicians/:id/schedule", async (request, reply) => {
    const id = parseIdParam(request.params);

    // Look up technician by their own id (Technician table id)
    const technician = await app.prisma.technician.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!technician) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Technicien ${id} introuvable` },
      });
    }

    const tickets = await app.prisma.repairTicket.findMany({
      where: {
        assignedTo: technician.userId,
        status: { notIn: TERMINAL_ARRAY },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { partsUsed: true },
        },
      },
    });

    // Stable re-sort by priority weight then createdAt
    const PRIORITY_WEIGHT: Record<string, number> = {
      URGENT: 0,
      HIGH: 1,
      NORMAL: 2,
      LOW: 3,
    };

    const sorted = [...tickets].sort((a, b) => {
      const wa = PRIORITY_WEIGHT[a.priority] ?? 2;
      const wb = PRIORITY_WEIGHT[b.priority] ?? 2;
      if (wa !== wb) return wa - wb;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return {
      success: true,
      data: {
        technician: technician.user,
        totalActiveTickets: sorted.length,
        tickets: sorted,
      },
    };
  });

  // PUT /technicians/:id/availability — Update availability
  app.put("/technicians/:id/availability", async (request, reply) => {
    const id = parseIdParam(request.params);
    const body = updateAvailabilitySchema.parse(request.body);

    const technician = await app.prisma.technician.findUnique({ where: { id } });

    if (!technician) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Technicien ${id} introuvable` },
      });
    }

    const updated = await app.prisma.technician.update({
      where: { id },
      data: { isAvailable: body.isAvailable },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return { success: true, data: updated };
  });
}
