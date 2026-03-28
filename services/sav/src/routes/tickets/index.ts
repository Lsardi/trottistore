import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  validateTransition,
  getNextStatuses,
  TERMINAL_STATUSES,
} from "../../utils/status-machine.js";

// --- Zod Schemas ---

const repairTypeEnum = z.enum(["GARANTIE", "REPARATION", "RETOUR", "RECLAMATION"]);

const repairStatusEnum = z.enum([
  "NOUVEAU",
  "DIAGNOSTIQUE",
  "DEVIS_ENVOYE",
  "DEVIS_ACCEPTE",
  "EN_REPARATION",
  "EN_ATTENTE_PIECE",
  "TERMINE",
  "LIVRE",
  "REFUS_CLIENT",
  "IRREPARABLE",
]);

const priorityEnum = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

const createRepairSchema = z.object({
  customerId: z.string().uuid(),
  productModel: z.string().min(1),
  serialNumber: z.string().optional(),
  type: repairTypeEnum,
  priority: priorityEnum.optional().default("NORMAL"),
  issueDescription: z.string().min(1),
  photosUrls: z.array(z.string().url()).optional(),
});

const updateStatusSchema = z.object({
  status: repairStatusEnum,
  note: z.string().optional(),
  performedBy: z.string().uuid().optional(),
});

const diagnosisSchema = z.object({
  diagnosis: z.string().min(1),
  estimatedCost: z.number().nonnegative().optional(),
  estimatedDays: z.number().int().positive().optional(),
  assignedTo: z.string().uuid().optional(),
});

const quoteSchema = z.object({
  parts: z.array(
    z.object({
      partName: z.string().min(1),
      partRef: z.string().optional(),
      variantId: z.string().uuid().optional(),
      quantity: z.number().int().positive(),
      unitCost: z.number().nonnegative(),
    })
  ),
  laborCost: z.number().nonnegative().optional(),
});

const addPartSchema = z.object({
  partName: z.string().min(1),
  partRef: z.string().optional(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive().default(1),
  unitCost: z.number().nonnegative(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: repairStatusEnum.optional(),
  type: repairTypeEnum.optional(),
  priority: priorityEnum.optional(),
  assignedTo: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  search: z.string().optional(),
  sort: z.enum(["newest", "oldest", "priority"]).optional().default("newest"),
});

// --- Priority sort weight ---

const PRIORITY_WEIGHT: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

// --- Routes ---

export async function repairRoutes(app: FastifyInstance) {
  // POST /repairs — Create a repair ticket
  app.post("/repairs", async (request, reply) => {
    const body = createRepairSchema.parse(request.body);

    const ticket = await app.prisma.$transaction(async (tx) => {
      const created = await tx.repairTicket.create({
        data: {
          customerId: body.customerId,
          productModel: body.productModel,
          serialNumber: body.serialNumber ?? null,
          type: body.type,
          priority: body.priority,
          status: "NOUVEAU",
          issueDescription: body.issueDescription,
          photosUrls: body.photosUrls ?? [],
        },
      });

      await tx.repairStatusLog.create({
        data: {
          ticketId: created.id,
          fromStatus: "",
          toStatus: "NOUVEAU",
          note: "Ticket cree",
        },
      });

      return created;
    });

    return reply.status(201).send({
      success: true,
      data: ticket,
    });
  });

  // GET /repairs — Paginated list with filters
  app.get("/repairs", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { page, limit, status, type, priority, assignedTo, customerId, search, sort } = query;
    const user = (request as any).user as
      | { userId: string; role: string }
      | undefined;

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;
    if (user?.role === "CLIENT") {
      where.customerId = user.userId;
    } else if (customerId) {
      where.customerId = customerId;
    }
    if (search) {
      where.OR = [
        { productModel: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    let orderBy: Record<string, string>[];
    switch (sort) {
      case "oldest":
        orderBy = [{ createdAt: "asc" }];
        break;
      case "priority":
        // Prisma doesn't support custom enum ordering natively,
        // so we sort by priority field then createdAt
        orderBy = [{ priority: "asc" }, { createdAt: "desc" }];
        break;
      default: // newest
        orderBy = [{ createdAt: "desc" }];
    }

    const [tickets, total] = await Promise.all([
      app.prisma.repairTicket.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          technician: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { partsUsed: true },
          },
        },
      }),
      app.prisma.repairTicket.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // If sorting by priority, do a stable in-memory re-sort using custom weight
    let result = tickets;
    if (sort === "priority") {
      result = [...tickets].sort((a, b) => {
        const wa = PRIORITY_WEIGHT[a.priority] ?? 2;
        const wb = PRIORITY_WEIGHT[b.priority] ?? 2;
        if (wa !== wb) return wa - wb;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    return {
      success: true,
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  });

  // GET /repairs/:id — Full ticket detail
  app.get("/repairs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user as
      | { userId: string; role: string }
      | undefined;

    const ticket = await app.prisma.repairTicket.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        technician: {
          select: { id: true, firstName: true, lastName: true },
        },
        statusLog: {
          orderBy: { createdAt: "asc" },
        },
        partsUsed: {
          include: {
            variant: {
              select: { id: true, sku: true, name: true },
            },
          },
        },
      },
    });

    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Ticket ${id} introuvable` },
      });
    }

    if (user?.role === "CLIENT" && ticket.customerId !== user.userId) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied to this ticket" },
      });
    }

    return { success: true, data: ticket };
  });

  // PUT /repairs/:id/status — Change ticket status
  app.put("/repairs/:id/status", async (request, reply) => {
    const user = (request as any).user as
      | { userId: string; role: string }
      | undefined;
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot update repair statuses",
        },
      });
    }

    const { id } = request.params as { id: string };
    const body = updateStatusSchema.parse(request.body);

    const ticket = await app.prisma.repairTicket.findUnique({
      where: { id },
      include: { partsUsed: true },
    });

    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Ticket ${id} introuvable` },
      });
    }

    if (!validateTransition(ticket.status, body.status)) {
      const allowed = getNextStatuses(ticket.status);
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Transition de '${ticket.status}' vers '${body.status}' non autorisee. Transitions valides : ${allowed.join(", ") || "(aucune — statut terminal)"}`,
        },
      });
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
    };

    // If TERMINE: set closedAt and compute actualCost from parts
    if (body.status === "TERMINE") {
      updateData.closedAt = new Date();
      const partsCostResult = await app.prisma.repairPartUsed.aggregate({
        where: { ticketId: id },
        _sum: { unitCost: true },
      });
      // We need to compute sum(unitCost * quantity) — aggregate doesn't support that directly
      // So compute from existing partsUsed
      let actualCost = 0;
      for (const part of ticket.partsUsed) {
        actualCost += part.quantity * Number(part.unitCost);
      }
      updateData.actualCost = actualCost;
    }

    // If LIVRE: set closedAt if not already set
    if (body.status === "LIVRE" && !ticket.closedAt) {
      updateData.closedAt = new Date();
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.repairTicket.update({
        where: { id },
        data: updateData,
      });

      await tx.repairStatusLog.create({
        data: {
          ticketId: id,
          fromStatus: ticket.status,
          toStatus: body.status,
          note: body.note ?? null,
          performedBy: body.performedBy ?? null,
        },
      });

      return updatedTicket;
    });

    return { success: true, data: updated };
  });

  // POST /repairs/:id/diagnosis — Add diagnosis info
  app.post("/repairs/:id/diagnosis", async (request, reply) => {
    const user = (request as any).user as
      | { userId: string; role: string }
      | undefined;
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot submit diagnosis updates",
        },
      });
    }

    const { id } = request.params as { id: string };
    const body = diagnosisSchema.parse(request.body);

    const ticket = await app.prisma.repairTicket.findUnique({ where: { id } });

    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Ticket ${id} introuvable` },
      });
    }

    if (!validateTransition(ticket.status, "DIAGNOSTIQUE")) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Impossible de passer en DIAGNOSTIQUE depuis le statut '${ticket.status}'`,
        },
      });
    }

    const updateData: Record<string, unknown> = {
      diagnosis: body.diagnosis,
      status: "DIAGNOSTIQUE",
    };

    if (body.estimatedCost !== undefined) updateData.estimatedCost = body.estimatedCost;
    if (body.estimatedDays !== undefined) updateData.estimatedDays = body.estimatedDays;
    if (body.assignedTo) updateData.assignedTo = body.assignedTo;

    const updated = await app.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.repairTicket.update({
        where: { id },
        data: updateData,
      });

      await tx.repairStatusLog.create({
        data: {
          ticketId: id,
          fromStatus: ticket.status,
          toStatus: "DIAGNOSTIQUE",
          note: `Diagnostic: ${body.diagnosis.substring(0, 200)}`,
        },
      });

      return updatedTicket;
    });

    return { success: true, data: updated };
  });

  // POST /repairs/:id/quote — Create and send quote
  app.post("/repairs/:id/quote", async (request, reply) => {
    const user = (request as any).user as
      | { userId: string; role: string }
      | undefined;
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot generate repair quotes",
        },
      });
    }

    const { id } = request.params as { id: string };
    const body = quoteSchema.parse(request.body);

    const ticket = await app.prisma.repairTicket.findUnique({ where: { id } });

    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Ticket ${id} introuvable` },
      });
    }

    if (!validateTransition(ticket.status, "DEVIS_ENVOYE")) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Impossible de passer en DEVIS_ENVOYE depuis le statut '${ticket.status}'`,
        },
      });
    }

    const partsCost = body.parts.reduce(
      (sum, p) => sum + p.quantity * p.unitCost,
      0
    );
    const laborCost = body.laborCost ?? 0;
    const estimatedCost = partsCost + laborCost;

    const updated = await app.prisma.$transaction(async (tx) => {
      await tx.repairTicket.update({
        where: { id },
        data: {
          estimatedCost,
          status: "DEVIS_ENVOYE",
        },
      });

      await tx.repairStatusLog.create({
        data: {
          ticketId: id,
          fromStatus: ticket.status,
          toStatus: "DEVIS_ENVOYE",
          note: `Devis envoye: ${estimatedCost.toFixed(2)} EUR`,
        },
      });

      return { estimatedCost, parts: body.parts, laborCost };
    });

    return { success: true, data: updated };
  });

  // PUT /repairs/:id/quote/accept — Accept quote
  app.put("/repairs/:id/quote/accept", async (request, reply) => {
    const user = (request as any).user as
      | { userId: string; role: string }
      | undefined;
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot accept quotes from this endpoint",
        },
      });
    }

    const { id } = request.params as { id: string };

    const ticket = await app.prisma.repairTicket.findUnique({ where: { id } });

    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Ticket ${id} introuvable` },
      });
    }

    if (!validateTransition(ticket.status, "DEVIS_ACCEPTE")) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Impossible de passer en DEVIS_ACCEPTE depuis le statut '${ticket.status}'`,
        },
      });
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.repairTicket.update({
        where: { id },
        data: { status: "DEVIS_ACCEPTE" },
      });

      await tx.repairStatusLog.create({
        data: {
          ticketId: id,
          fromStatus: ticket.status,
          toStatus: "DEVIS_ACCEPTE",
          note: "Devis accepte par le client",
        },
      });

      return updatedTicket;
    });

    return { success: true, data: updated };
  });

  // POST /repairs/:id/parts — Add a part used
  app.post("/repairs/:id/parts", async (request, reply) => {
    const user = (request as any).user as
      | { userId: string; role: string }
      | undefined;
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot add repair parts",
        },
      });
    }

    const { id } = request.params as { id: string };
    const body = addPartSchema.parse(request.body);

    const ticket = await app.prisma.repairTicket.findUnique({ where: { id } });

    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Ticket ${id} introuvable` },
      });
    }

    const part = await app.prisma.$transaction(async (tx) => {
      const created = await tx.repairPartUsed.create({
        data: {
          ticketId: id,
          partName: body.partName,
          partRef: body.partRef ?? null,
          variantId: body.variantId ?? null,
          quantity: body.quantity,
          unitCost: body.unitCost,
        },
      });

      // Decrement stock if variantId provided
      if (body.variantId) {
        await tx.productVariant.update({
          where: { id: body.variantId },
          data: {
            stockQuantity: { decrement: body.quantity },
          },
        });
      }

      return created;
    });

    return reply.status(201).send({ success: true, data: part });
  });

  // POST /repairs/:id/complete — Mark ticket as complete
  app.post("/repairs/:id/complete", async (request, reply) => {
    const user = (request as any).user as
      | { userId: string; role: string }
      | undefined;
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot mark repair as complete",
        },
      });
    }

    const { id } = request.params as { id: string };

    const ticket = await app.prisma.repairTicket.findUnique({
      where: { id },
      include: { partsUsed: true },
    });

    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Ticket ${id} introuvable` },
      });
    }

    if (!validateTransition(ticket.status, "TERMINE")) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Impossible de passer en TERMINE depuis le statut '${ticket.status}'`,
        },
      });
    }

    let actualCost = 0;
    for (const part of ticket.partsUsed) {
      actualCost += part.quantity * Number(part.unitCost);
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.repairTicket.update({
        where: { id },
        data: {
          status: "TERMINE",
          closedAt: new Date(),
          actualCost,
        },
      });

      await tx.repairStatusLog.create({
        data: {
          ticketId: id,
          fromStatus: ticket.status,
          toStatus: "TERMINE",
          note: `Reparation terminee. Cout reel: ${actualCost.toFixed(2)} EUR`,
        },
      });

      return updatedTicket;
    });

    return { success: true, data: updated };
  });
}
