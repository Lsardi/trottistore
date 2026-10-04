/**
 * "Aujourd'hui" côté atelier — ce que l'équipe doit faire à l'ouverture.
 * Action lists, not KPIs: counts plus the first items to act on. Technicians
 * see their own queue; managers see everything.
 */
import type { FastifyInstance } from "fastify";

const PREVIEW = 10;
const QUOTE_REMINDER_HOURS = 48;

type RequestUser = { userId: string; role: string };

function getRequestUser(request: { user?: unknown }): RequestUser | undefined {
  const user = request.user as Partial<RequestUser> | undefined;
  if (!user || typeof user.userId !== "string" || typeof user.role !== "string") return undefined;
  return { userId: user.userId, role: user.role };
}

export async function todayRoutes(app: FastifyInstance) {
  app.get("/today", async (request, reply) => {
    const user = getRequestUser(request);
    if (!user || user.role === "CLIENT") {
      return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Accès réservé au personnel" } });
    }
    const mine = user.role === "TECHNICIAN" ? { assignedTo: user.userId } : {};

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const quoteCutoff = new Date(Date.now() - QUOTE_REMINDER_HOURS * 3600_000);

    const ticketPreview = {
      id: true,
      ticketNumber: true,
      status: true,
      priority: true,
      type: true,
      productModel: true,
      customerName: true,
      customerPhone: true,
      assignedTo: true,
      estimatedDays: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    const [
      appointments,
      appointmentsCount,
      toDiagnose,
      toDiagnoseCount,
      inProgress,
      inProgressCount,
      readyForPickup,
      readyForPickupCount,
      quotesWithoutAnswer,
      quotesWithoutAnswerCount,
      waitingParts,
      waitingPartsCount,
      urgent,
    ] = await Promise.all([
      app.prisma.repairAppointment.findMany({
        where: { startsAt: { gte: dayStart, lt: dayEnd }, status: { in: ["BOOKED", "CONFIRMED"] } },
        orderBy: { startsAt: "asc" },
        take: 50,
        include: { ticket: { select: { id: true, ticketNumber: true, status: true, productModel: true } } },
      }),
      app.prisma.repairAppointment.count({
        where: { startsAt: { gte: dayStart, lt: dayEnd }, status: { in: ["BOOKED", "CONFIRMED"] } },
      }),
      // Received, nobody has looked at it yet
      app.prisma.repairTicket.findMany({
        where: { status: "RECU", ...mine },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: PREVIEW,
        select: ticketPreview,
      }),
      app.prisma.repairTicket.count({ where: { status: "RECU", ...mine } }),
      // On the bench
      app.prisma.repairTicket.findMany({
        where: { status: { in: ["DIAGNOSTIC", "DEVIS_ACCEPTE", "EN_REPARATION"] }, ...mine },
        orderBy: [{ priority: "desc" }, { updatedAt: "asc" }],
        take: PREVIEW,
        select: ticketPreview,
      }),
      app.prisma.repairTicket.count({ where: { status: { in: ["DIAGNOSTIC", "DEVIS_ACCEPTE", "EN_REPARATION"] }, ...mine } }),
      // Repaired, customer has not collected — oldest first (they take space)
      app.prisma.repairTicket.findMany({
        where: { status: "PRET", ...mine },
        orderBy: { updatedAt: "asc" },
        take: PREVIEW,
        select: ticketPreview,
      }),
      app.prisma.repairTicket.count({ where: { status: "PRET", ...mine } }),
      // Quote sent > 48h ago, no answer: call the customer
      app.prisma.repairTicket.findMany({
        where: { status: "DEVIS_ENVOYE", updatedAt: { lt: quoteCutoff }, ...mine },
        orderBy: { updatedAt: "asc" },
        take: PREVIEW,
        select: { ...ticketPreview, estimatedCost: true },
      }),
      app.prisma.repairTicket.count({ where: { status: "DEVIS_ENVOYE", updatedAt: { lt: quoteCutoff }, ...mine } }),
      // Blocked on a part: check deliveries
      app.prisma.repairTicket.findMany({
        where: { status: "EN_ATTENTE_PIECE", ...mine },
        orderBy: { updatedAt: "asc" },
        take: PREVIEW,
        select: ticketPreview,
      }),
      app.prisma.repairTicket.count({ where: { status: "EN_ATTENTE_PIECE", ...mine } }),
      app.prisma.repairTicket.count({
        where: { priority: "URGENT", status: { notIn: ["RECUPERE", "REFUS_CLIENT", "IRREPARABLE"] }, ...mine },
      }),
    ]);

    return {
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        scope: user.role === "TECHNICIAN" ? "mine" : "all",
        appointments: { count: appointmentsCount, items: appointments },
        actions: {
          toDiagnose: { count: toDiagnoseCount, items: toDiagnose },
          inProgress: { count: inProgressCount, items: inProgress },
          readyForPickup: { count: readyForPickupCount, items: readyForPickup },
          quotesWithoutAnswer: { count: quotesWithoutAnswerCount, items: quotesWithoutAnswer, olderThanHours: QUOTE_REMINDER_HOURS },
          waitingParts: { count: waitingPartsCount, items: waitingParts },
        },
        urgentOpen: urgent,
      },
    };
  });
}
