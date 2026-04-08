import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { parseIdParam } from "@trottistore/shared";
import {
  validateTransition,
  getNextStatuses,
  TERMINAL_STATUSES,
} from "../../utils/status-machine.js";
import { notifyStatusChange } from "../../notifications/engine.js";

// --- Zod Schemas ---

const repairTypeEnum = z.enum(["GARANTIE", "REPARATION", "RETOUR", "RECLAMATION"]);

const repairStatusEnum = z.enum([
  "RECU",
  "DIAGNOSTIC",
  "DEVIS_ENVOYE",
  "DEVIS_ACCEPTE",
  "EN_REPARATION",
  "EN_ATTENTE_PIECE",
  "PRET",
  "RECUPERE",
  "REFUS_CLIENT",
  "IRREPARABLE",
]);

const priorityEnum = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

const createRepairSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(2).max(200).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().min(6).max(20).optional(),
  productModel: z.string().min(1),
  serialNumber: z.string().optional(),
  type: repairTypeEnum,
  priority: priorityEnum.optional().default("NORMAL"),
  visitReason: z.string().max(300).optional(),
  issueDescription: z.string().min(1),
  photosBefore: z.array(z.string().url()).optional(),
  photosUrls: z.array(z.string().url()).optional(), // Legacy support
}).superRefine((value, ctx) => {
  const hasAccount = !!value.customerId;
  const hasGuestProfile = !!value.customerName && !!value.customerPhone;
  if (!hasAccount && !hasGuestProfile) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Provide customerId or guest contact info (customerName + customerPhone)",
      path: ["customerId"],
    });
  }
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

const customerQuoteAcceptSchema = z.object({
  trackingToken: z.string().uuid().optional(),
});

const slotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMin: z.coerce.number().int().min(15).max(240).default(60),
});

const createAppointmentSchema = z.object({
  ticketId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(2).max(200),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().min(6).max(20),
  serviceType: z.enum(["REPARATION", "DIAGNOSTIC", "ESSAI_BOUTIQUE"]).optional().default("REPARATION"),
  isExpress: z.boolean().optional().default(false),
  startsAt: z.string().datetime(),
  durationMin: z.number().int().min(15).max(240).optional().default(60),
  notes: z.string().max(2000).optional(),
});

const trackingParamsSchema = z.object({
  token: z.string().uuid(),
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

type RequestUser = { userId: string; role: string };

function getRequestUser(
  request: { user?: unknown },
): RequestUser | undefined {
  const user = request.user as Partial<RequestUser> | undefined;
  if (!user) return undefined;
  if (typeof user.userId !== "string" || typeof user.role !== "string") {
    return undefined;
  }
  return { userId: user.userId, role: user.role };
}

function atParisTime(dateTime: string) {
  return new Date(dateTime);
}

function getParisOffsetMinutes(year: number, month: number, day: number, hour: number): number {
  const probe = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  const tz = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(probe);
  const offsetPart = tz.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = offsetPart.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}

function parisLocalDate(year: number, month: number, day: number, hour: number, minute = 0): Date {
  const offsetMinutes = getParisOffsetMinutes(year, month, day, hour);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60_000;
  return new Date(utcMs);
}

function computeEnd(start: Date, durationMin: number): Date {
  return new Date(start.getTime() + durationMin * 60_000);
}

function overlaps(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
): boolean {
  return leftStart < rightEnd && leftEnd > rightStart;
}

// --- Routes ---

export async function repairRoutes(app: FastifyInstance) {
  // POST /repairs — Create a repair ticket
  app.post("/repairs", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = createRepairSchema.parse(request.body);
    const user = getRequestUser(request);
    const trackingToken = randomUUID();

    const ticket = await app.prisma.$transaction(async (tx) => {
      const created = await tx.repairTicket.create({
        data: {
          customerId: user?.userId ?? body.customerId ?? null,
          customerName: body.customerName ?? null,
          customerEmail: body.customerEmail ?? null,
          customerPhone: body.customerPhone ?? null,
          productModel: body.productModel,
          serialNumber: body.serialNumber ?? null,
          type: body.type,
          priority: body.priority,
          status: "RECU",
          visitReason: body.visitReason ?? null,
          issueDescription: body.issueDescription,
          photosBefore: body.photosBefore ?? [],
          photosUrls: body.photosUrls ?? [],
          receivedBy: user?.userId ?? null,
          trackingToken,
        },
      });

      await tx.repairStatusLog.create({
        data: {
          ticketId: created.id,
          fromStatus: "",
          toStatus: "RECU",
          note: "Ticket cree",
        },
      });

      await tx.repairActivityLog.create({
        data: {
          ticketId: created.id,
          action: "RECEIVED",
          performedBy: user?.userId ?? null,
          performerName: user ? undefined : body.customerName ?? null,
          details: `Reception: ${body.productModel}${body.visitReason ? ` — Motif: ${body.visitReason}` : ""}`,
          metadata: {
            type: body.type,
            priority: body.priority,
            visitReason: body.visitReason ?? null,
          },
        },
      });

      return created;
    });

    // Fire-and-forget notification for reception
    notifyStatusChange({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      customerName: ticket.customerName ?? body.customerName ?? "Client",
      customerEmail: ticket.customerEmail ?? body.customerEmail ?? null,
      customerPhone: ticket.customerPhone ?? body.customerPhone ?? null,
      productModel: ticket.productModel,
      trackingToken,
      fromStatus: "",
      toStatus: "RECU",
    }).catch((err) => app.log.error({ err }, "Reception notification failed"));

    return reply.status(201).send({
      success: true,
      data: {
        ...ticket,
        trackingUrl: `/mon-compte/suivi/${trackingToken}`,
      },
    });
  });

  // GET /repairs — Paginated list with filters
  app.get("/repairs", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { page, limit, status, type, priority, assignedTo, customerId, search, sort } = query;
    const user = getRequestUser(request);

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;
    if (user?.role === "CLIENT") {
      where.customerId = user.userId;
    } else if (user?.role === "TECHNICIAN") {
      // TECHNICIAN can only see tickets assigned to them
      where.assignedTo = user.userId;
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

  // GET /repairs/tracking/:token — Public tracking view (no auth)
  app.get("/repairs/tracking/:token", async (request, reply) => {
    const { token } = trackingParamsSchema.parse(request.params);

    const ticket = await app.prisma.repairTicket.findUnique({
      where: { trackingToken: token },
      include: {
        statusLog: { orderBy: { createdAt: "asc" } },
        appointments: {
          where: { status: { in: ["BOOKED", "CONFIRMED"] } },
          orderBy: { startsAt: "asc" },
          take: 1,
        },
      },
    });

    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Tracking link introuvable" },
      });
    }

    return {
      success: true,
      data: {
        ticketNumber: ticket.ticketNumber,
        productModel: ticket.productModel,
        status: ticket.status,
        priority: ticket.priority,
        type: ticket.type,
        diagnosis: ticket.diagnosis,
        estimatedCost: ticket.estimatedCost,
        actualCost: ticket.actualCost,
        estimatedDays: ticket.estimatedDays,
        photosBefore: ticket.photosBefore,
        photosAfter: ticket.photosAfter,
        photosUrls: ticket.photosUrls,
        quoteAcceptedAt: ticket.quoteAcceptedAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        nextAppointment: ticket.appointments[0] ?? null,
        statusLog: ticket.statusLog.map((entry) => ({
          fromStatus: entry.fromStatus,
          toStatus: entry.toStatus,
          note: entry.note,
          createdAt: entry.createdAt,
        })),
      },
    };
  });

  // GET /appointments/slots?date=YYYY-MM-DD&durationMin=60
  app.get("/appointments/slots", async (request) => {
    const query = slotsQuerySchema.parse(request.query);
    const durationMin = query.durationMin;
    const now = new Date();
    const [year, month, day] = query.date.split("-").map(Number);
    const openingHour = 10;
    const closingHour = 19;

    const dayStart = parisLocalDate(year, month, day, openingHour);
    const dayEnd = parisLocalDate(year, month, day, closingHour);

    const existing = await (app.prisma as any).repairAppointment.findMany({
      where: {
        status: { in: ["BOOKED", "CONFIRMED"] },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true },
      orderBy: { startsAt: "asc" },
    });

    const slots: Array<{ startsAt: string; endsAt: string; available: boolean }> = [];
    for (let cursor = new Date(dayStart); cursor < dayEnd; cursor = new Date(cursor.getTime() + 30 * 60_000)) {
      const slotEnd = computeEnd(cursor, durationMin);
      if (slotEnd > dayEnd) break;
      const isPast = cursor.getTime() <= now.getTime();
      const hasConflict = existing.some((appointment: { startsAt: Date; endsAt: Date }) =>
        overlaps(cursor, slotEnd, new Date(appointment.startsAt), new Date(appointment.endsAt)),
      );

      slots.push({
        startsAt: cursor.toISOString(),
        endsAt: slotEnd.toISOString(),
        available: !isPast && !hasConflict,
      });
    }

    return { success: true, data: slots };
  });

  // POST /appointments — Book an atelier slot
  app.post("/appointments", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = createAppointmentSchema.parse(request.body);
    const startsAt = atParisTime(body.startsAt);
    const endsAt = computeEnd(startsAt, body.durationMin);

    const overlapCount = await (app.prisma as any).repairAppointment.count({
      where: {
        status: { in: ["BOOKED", "CONFIRMED"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlapCount > 0) {
      return reply.status(409).send({
        success: false,
        error: {
          code: "SLOT_UNAVAILABLE",
          message: "Ce créneau n'est plus disponible",
        },
      });
    }

    const expressSurcharge = body.isExpress ? 0.2 : 0;
    const created = await (app.prisma as any).repairAppointment.create({
      data: {
        ticketId: body.ticketId ?? null,
        customerId: body.customerId ?? null,
        customerName: body.customerName,
        customerEmail: body.customerEmail ?? null,
        customerPhone: body.customerPhone,
        serviceType: body.serviceType,
        isExpress: body.isExpress,
        expressSurcharge,
        startsAt,
        endsAt,
        notes: body.notes ?? null,
        status: "BOOKED",
      },
    });

    return reply.status(201).send({ success: true, data: created });
  });

  // GET /repairs/:id — Full ticket detail
  app.get("/repairs/:id", async (request, reply) => {
    const id = parseIdParam(request.params);
    const user = getRequestUser(request);

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
        activityLog: {
          orderBy: { createdAt: "asc" },
        },
        partsUsed: {
          include: {
            variant: {
              select: { id: true, sku: true, name: true },
            },
          },
        },
        appointments: {
          orderBy: { startsAt: "asc" },
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

    if (user?.role === "TECHNICIAN" && ticket.assignedTo !== user.userId) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Ticket non assigne a vous" },
      });
    }

    return { success: true, data: ticket };
  });

  // PUT /repairs/:id/status — Change ticket status
  app.put("/repairs/:id/status", async (request, reply) => {
    const user = getRequestUser(request);
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot update repair statuses",
        },
      });
    }

    const id = parseIdParam(request.params);
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

    // TECHNICIAN can only modify their assigned tickets
    if (user?.role === "TECHNICIAN" && ticket.assignedTo !== user.userId) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Ticket non assigne a vous" },
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

    // If PRET: set closedAt and compute actualCost from parts
    if (body.status === "PRET") {
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

    // If RECUPERE: set closedAt if not already set
    if (body.status === "RECUPERE" && !ticket.closedAt) {
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

      await tx.repairActivityLog.create({
        data: {
          ticketId: id,
          action: "STATUS_CHANGE",
          performedBy: body.performedBy ?? user?.userId ?? null,
          details: body.note ?? `Statut: ${ticket.status} → ${body.status}`,
          metadata: { fromStatus: ticket.status, toStatus: body.status },
        },
      });

      return updatedTicket;
    });

    // Fire-and-forget notification (don't block the response)
    notifyStatusChange({
      ticketId: id,
      ticketNumber: ticket.ticketNumber,
      customerName: ticket.customerName ?? "Client",
      customerEmail: ticket.customerEmail,
      customerPhone: ticket.customerPhone,
      productModel: ticket.productModel,
      trackingToken: ticket.trackingToken,
      fromStatus: ticket.status,
      toStatus: body.status,
      estimatedCost: ticket.estimatedCost ? Number(ticket.estimatedCost) : null,
      estimatedDays: ticket.estimatedDays,
      performedBy: body.performedBy ?? user?.userId ?? null,
    }).catch((err) => app.log.error({ err }, "Notification failed"));

    return { success: true, data: updated };
  });

  // POST /repairs/:id/diagnosis — Add diagnosis info
  app.post("/repairs/:id/diagnosis", async (request, reply) => {
    const user = getRequestUser(request);
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot submit diagnosis updates",
        },
      });
    }

    const id = parseIdParam(request.params);
    const body = diagnosisSchema.parse(request.body);

    const ticket = await app.prisma.repairTicket.findUnique({ where: { id } });

    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Ticket ${id} introuvable` },
      });
    }

    // TECHNICIAN can only diagnose their assigned tickets
    if (user?.role === "TECHNICIAN" && ticket.assignedTo !== user.userId) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Ticket non assigne a vous" },
      });
    }

    if (!validateTransition(ticket.status, "DIAGNOSTIC")) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Impossible de passer en DIAGNOSTIC depuis le statut '${ticket.status}'`,
        },
      });
    }

    const updateData: Record<string, unknown> = {
      diagnosis: body.diagnosis,
      status: "DIAGNOSTIC",
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
          toStatus: "DIAGNOSTIC",
          note: `Diagnostic: ${body.diagnosis.substring(0, 200)}`,
        },
      });

      await tx.repairActivityLog.create({
        data: {
          ticketId: id,
          action: "DIAGNOSIS_ADDED",
          performedBy: user?.userId ?? null,
          details: `Diagnostic: ${body.diagnosis.substring(0, 200)}`,
          metadata: {
            fromStatus: ticket.status,
            toStatus: "DIAGNOSTIC",
            diagnosis: body.diagnosis,
            estimatedCost: body.estimatedCost ?? null,
            estimatedDays: body.estimatedDays ?? null,
          },
        },
      });

      return updatedTicket;
    });

    return { success: true, data: updated };
  });

  // POST /repairs/:id/quote — Create and send quote
  app.post("/repairs/:id/quote", async (request, reply) => {
    const user = getRequestUser(request);
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot generate repair quotes",
        },
      });
    }

    const id = parseIdParam(request.params);
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
    const user = getRequestUser(request);
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot accept quotes from this endpoint",
        },
      });
    }

    const id = parseIdParam(request.params);

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

  // PUT /repairs/:id/quote/accept-client — Accept quote as client or guest via tracking token
  app.put("/repairs/:id/quote/accept-client", async (request, reply) => {
    const user = getRequestUser(request);
    const id = parseIdParam(request.params);
    const body = customerQuoteAcceptSchema.parse(request.body ?? {});

    const ticket = await app.prisma.repairTicket.findUnique({ where: { id } });
    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Ticket ${id} introuvable` },
      });
    }

    const isStaff = !!user && user.role !== "CLIENT";
    const isOwnerClient = !!user && user.role === "CLIENT" && ticket.customerId === user.userId;
    const hasValidToken = !!body.trackingToken && body.trackingToken === ticket.trackingToken;
    if (!isStaff && !isOwnerClient && !hasValidToken) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Vous n'êtes pas autorisé à accepter ce devis",
        },
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
        data: {
          status: "DEVIS_ACCEPTE",
          quoteAcceptedAt: new Date(),
        },
      });

      await tx.repairStatusLog.create({
        data: {
          ticketId: id,
          fromStatus: ticket.status,
          toStatus: "DEVIS_ACCEPTE",
          note: "Devis accepte par le client (self-service)",
          performedBy: user?.userId ?? null,
        },
      });

      return updatedTicket;
    });

    return { success: true, data: updated };
  });

  // POST /repairs/:id/parts — Add a part used
  app.post("/repairs/:id/parts", async (request, reply) => {
    const user = getRequestUser(request);
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot add repair parts",
        },
      });
    }

    const id = parseIdParam(request.params);
    const body = addPartSchema.parse(request.body);

    const ticket = await app.prisma.repairTicket.findUnique({ where: { id } });

    if (!ticket) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Ticket ${id} introuvable` },
      });
    }

    // TECHNICIAN can only add parts to their assigned tickets
    if (user?.role === "TECHNICIAN" && ticket.assignedTo !== user.userId) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Ticket non assigne a vous" },
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

      await tx.repairActivityLog.create({
        data: {
          ticketId: id,
          action: "PART_ADDED",
          performedBy: user?.userId ?? null,
          details: `Piece ajoutee: ${body.partName} x${body.quantity} (${body.unitCost}€/u)`,
          metadata: {
            partName: body.partName,
            partRef: body.partRef ?? null,
            quantity: body.quantity,
            unitCost: body.unitCost,
            variantId: body.variantId ?? null,
          },
        },
      });

      return created;
    });

    return reply.status(201).send({ success: true, data: part });
  });

  // POST /repairs/:id/complete — Mark ticket as complete
  app.post("/repairs/:id/complete", async (request, reply) => {
    const user = getRequestUser(request);
    if (user?.role === "CLIENT") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Clients cannot mark repair as complete",
        },
      });
    }

    const id = parseIdParam(request.params);

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

    // TECHNICIAN can only complete their assigned tickets
    if (user?.role === "TECHNICIAN" && ticket.assignedTo !== user.userId) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Ticket non assigne a vous" },
      });
    }

    if (!validateTransition(ticket.status, "PRET")) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Impossible de passer en PRET depuis le statut '${ticket.status}'`,
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
          status: "PRET",
          closedAt: new Date(),
          actualCost,
        },
      });

      await tx.repairStatusLog.create({
        data: {
          ticketId: id,
          fromStatus: ticket.status,
          toStatus: "PRET",
          note: `Reparation terminee. Cout reel: ${actualCost.toFixed(2)} EUR`,
        },
      });

      return updatedTicket;
    });

    // Notify customer that repair is complete
    notifyStatusChange({
      ticketId: id,
      ticketNumber: ticket.ticketNumber,
      customerName: ticket.customerName ?? "Client",
      customerEmail: ticket.customerEmail,
      customerPhone: ticket.customerPhone,
      productModel: ticket.productModel,
      trackingToken: ticket.trackingToken,
      fromStatus: ticket.status,
      toStatus: "PRET",
      estimatedCost: ticket.estimatedCost ? Number(ticket.estimatedCost) : null,
      estimatedDays: ticket.estimatedDays,
    }).catch((err) => app.log.error({ err }, "Complete notification failed"));

    return { success: true, data: updated };
  });
}
