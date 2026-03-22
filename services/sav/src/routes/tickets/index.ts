import type { FastifyInstance } from "fastify";
import { z } from "zod";

// --- Schemas Zod ---

const repairTypeEnum = z.enum(["WARRANTY", "OUT_OF_WARRANTY", "RECALL", "MAINTENANCE"]);

const repairStatusEnum = z.enum([
  "PENDING",
  "DIAGNOSED",
  "WAITING_PARTS",
  "IN_REPAIR",
  "QUALITY_CHECK",
  "READY",
  "DELIVERED",
  "CANCELLED",
]);

const createRepairSchema = z.object({
  customerId: z.string().uuid(),
  productModel: z.string().min(1),
  issueDescription: z.string().min(10),
  type: repairTypeEnum,
});

const updateStatusSchema = z.object({
  status: repairStatusEnum,
  note: z.string().optional(),
});

const diagnosisSchema = z.object({
  technicianId: z.string().uuid(),
  findings: z.string().min(10),
  estimatedCost: z.number().nonnegative().optional(),
  estimatedDays: z.number().int().positive().optional(),
});

const addPartSchema = z.object({
  partReference: z.string().min(1),
  partName: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  unitCost: z.number().nonnegative(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: repairStatusEnum.optional(),
  assignedTo: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

// --- Transitions de statut valides ---

const validTransitions: Record<string, string[]> = {
  PENDING: ["DIAGNOSED", "CANCELLED"],
  DIAGNOSED: ["WAITING_PARTS", "IN_REPAIR", "CANCELLED"],
  WAITING_PARTS: ["IN_REPAIR", "CANCELLED"],
  IN_REPAIR: ["QUALITY_CHECK", "WAITING_PARTS", "CANCELLED"],
  QUALITY_CHECK: ["READY", "IN_REPAIR"],
  READY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// --- Routes ---

export async function repairRoutes(app: FastifyInstance) {
  // POST /api/v1/repairs — Créer un ticket de réparation
  app.post("/repairs", async (request, reply) => {
    const body = createRepairSchema.parse(request.body);

    // Placeholder: en production, on créerait via Prisma
    const ticket = {
      id: crypto.randomUUID(),
      ...body,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusLog: [
        {
          status: "PENDING",
          timestamp: new Date().toISOString(),
          note: "Ticket créé",
        },
      ],
      diagnosis: null,
      partsUsed: [],
      assignedTo: null,
    };

    return reply.status(201).send({ success: true, data: ticket });
  });

  // GET /api/v1/repairs — Liste des tickets avec filtres
  app.get("/repairs", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { page, limit, status, assignedTo, customerId } = query;

    // Placeholder: données fictives
    const tickets = [
      {
        id: "aaaaaaaa-1111-4000-8000-000000000001",
        customerId: customerId || "cccccccc-1111-4000-8000-000000000001",
        productModel: "Ninebot Max G2",
        type: "WARRANTY",
        status: status || "PENDING",
        assignedTo: assignedTo || null,
        createdAt: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "aaaaaaaa-1111-4000-8000-000000000002",
        customerId: customerId || "cccccccc-1111-4000-8000-000000000002",
        productModel: "Xiaomi Pro 4",
        type: "OUT_OF_WARRANTY",
        status: status || "IN_REPAIR",
        assignedTo: assignedTo || "tttttttt-1111-4000-8000-000000000001",
        createdAt: "2026-03-18T14:30:00.000Z",
      },
    ];

    return {
      success: true,
      data: tickets,
      pagination: {
        page,
        limit,
        total: tickets.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  });

  // GET /api/v1/repairs/:id — Détail d'un ticket
  app.get("/repairs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    // Placeholder
    const ticket = {
      id,
      customerId: "cccccccc-1111-4000-8000-000000000001",
      productModel: "Ninebot Max G2",
      issueDescription: "La trottinette ne s'allume plus après une charge complète.",
      type: "WARRANTY",
      status: "DIAGNOSED",
      assignedTo: "tttttttt-1111-4000-8000-000000000001",
      createdAt: "2026-03-20T10:00:00.000Z",
      updatedAt: "2026-03-21T09:00:00.000Z",
      statusLog: [
        { status: "PENDING", timestamp: "2026-03-20T10:00:00.000Z", note: "Ticket créé" },
        { status: "DIAGNOSED", timestamp: "2026-03-21T09:00:00.000Z", note: "Problème de carte contrôleur identifié" },
      ],
      diagnosis: {
        technicianId: "tttttttt-1111-4000-8000-000000000001",
        findings: "Carte contrôleur défectueuse — court-circuit détecté sur le module de charge.",
        estimatedCost: 85.0,
        estimatedDays: 3,
        diagnosedAt: "2026-03-21T09:00:00.000Z",
      },
      partsUsed: [
        {
          partReference: "NBM-CTRL-G2",
          partName: "Carte contrôleur Ninebot G2",
          quantity: 1,
          unitCost: 65.0,
        },
      ],
    };

    return { success: true, data: ticket };
  });

  // PUT /api/v1/repairs/:id/status — Changer le statut d'un ticket
  app.put("/repairs/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateStatusSchema.parse(request.body);

    // Placeholder: statut actuel simulé
    const currentStatus = "PENDING";
    const allowed = validTransitions[currentStatus] || [];

    if (!allowed.includes(body.status)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Transition de '${currentStatus}' vers '${body.status}' non autorisée. Transitions valides : ${allowed.join(", ")}`,
        },
      });
    }

    return {
      success: true,
      data: {
        id,
        previousStatus: currentStatus,
        newStatus: body.status,
        note: body.note || null,
        updatedAt: new Date().toISOString(),
      },
    };
  });

  // POST /api/v1/repairs/:id/diagnosis — Ajouter un diagnostic
  app.post("/repairs/:id/diagnosis", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = diagnosisSchema.parse(request.body);

    const diagnosis = {
      ticketId: id,
      ...body,
      diagnosedAt: new Date().toISOString(),
    };

    return reply.status(201).send({ success: true, data: diagnosis });
  });

  // POST /api/v1/repairs/:id/parts — Ajouter une pièce utilisée
  app.post("/repairs/:id/parts", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = addPartSchema.parse(request.body);

    const part = {
      ticketId: id,
      ...body,
      totalCost: body.quantity * body.unitCost,
      addedAt: new Date().toISOString(),
    };

    return reply.status(201).send({ success: true, data: part });
  });

  // GET /api/v1/repairs/technician/:id/schedule — Planning d'un technicien
  app.get("/repairs/technician/:id/schedule", async (request) => {
    const { id } = request.params as { id: string };

    // Placeholder
    const schedule = {
      technicianId: id,
      date: new Date().toISOString().split("T")[0],
      tickets: [
        {
          id: "aaaaaaaa-1111-4000-8000-000000000001",
          productModel: "Ninebot Max G2",
          status: "IN_REPAIR",
          priority: "HIGH",
          estimatedDuration: "2h",
        },
        {
          id: "aaaaaaaa-1111-4000-8000-000000000003",
          productModel: "Dualtron Thunder 3",
          status: "DIAGNOSED",
          priority: "MEDIUM",
          estimatedDuration: "1h30",
        },
        {
          id: "aaaaaaaa-1111-4000-8000-000000000004",
          productModel: "Vsett 10+",
          status: "QUALITY_CHECK",
          priority: "LOW",
          estimatedDuration: "30min",
        },
      ],
      totalTickets: 3,
    };

    return { success: true, data: schedule };
  });

  // GET /api/v1/repairs/stats — Statistiques SAV
  app.get("/repairs/stats", async () => {
    // Placeholder: données fictives
    const stats = {
      period: "2026-03",
      totalTickets: 142,
      byStatus: {
        PENDING: 18,
        DIAGNOSED: 12,
        WAITING_PARTS: 8,
        IN_REPAIR: 25,
        QUALITY_CHECK: 5,
        READY: 10,
        DELIVERED: 58,
        CANCELLED: 6,
      },
      byType: {
        WARRANTY: 65,
        OUT_OF_WARRANTY: 52,
        RECALL: 12,
        MAINTENANCE: 13,
      },
      averageRepairDays: 4.2,
      satisfactionRate: 94.5,
      topIssues: [
        { issue: "Batterie défectueuse", count: 32 },
        { issue: "Contrôleur HS", count: 21 },
        { issue: "Pneu crevé", count: 18 },
        { issue: "Frein usé", count: 15 },
        { issue: "Écran cassé", count: 11 },
      ],
    };

    return { success: true, data: stats };
  });
}
