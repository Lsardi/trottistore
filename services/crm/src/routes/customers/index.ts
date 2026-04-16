import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseIdParam } from "@trottistore/shared";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  loyaltyTier: z.enum(["BRONZE", "SILVER", "GOLD"]).optional(),
  tags: z.string().optional(), // comma-separated
  minSpent: z.coerce.number().optional(),
  maxSpent: z.coerce.number().optional(),
  source: z.string().optional(),
  sort: z
    .enum(["newest", "name", "points_desc", "last_active", "total_spent"])
    .default("newest"),
});

const timelineQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  type: z
    .enum(["EMAIL", "CALL", "VISIT", "SMS", "NOTE", "ORDER", "SAV"])
    .optional(),
});

const addPointsSchema = z.object({
  points: z.number().int().positive(),
  reason: z.string().min(1).max(255),
  type: z.string().optional(),
  referenceId: z.string().optional(),
});

const createInteractionSchema = z.object({
  type: z.enum(["EMAIL", "CALL", "VISIT", "SMS", "NOTE", "ORDER", "SAV"]),
  channel: z.string().optional(),
  subject: z.string().max(300).optional(),
  content: z.string().optional(),
  referenceId: z.string().max(100).optional(),
});

const updateCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(6).max(30).nullable().optional(),
  source: z.string().trim().max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
  scooterModels: z.array(z.string().trim().min(1).max(120)).optional(),
  healthScore: z.number().int().min(0).max(100).nullable().optional(),
});

/**
 * Determine loyalty tier from points total.
 */
function computeLoyaltyTier(points: number): string {
  if (points >= 2000) return "GOLD";
  if (points >= 500) return "SILVER";
  return "BRONZE";
}

export async function customerRoutes(app: FastifyInstance) {
  // ───────────────────────────────────────────────────────────
  // GET /customers — Paginated list with filters
  // ───────────────────────────────────────────────────────────
  app.get("/customers", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { page, limit, search, loyaltyTier, tags, minSpent, maxSpent, source, sort } = query;
    const skip = (page - 1) * limit;

    // Build CustomerProfile where clause
    const profileWhere: {
      loyaltyTier?: "BRONZE" | "SILVER" | "GOLD";
      source?: string;
      totalSpent?: {
        gte?: number;
        lte?: number;
      };
      tags?: { hasSome: string[] };
    } = {};
    if (loyaltyTier) profileWhere.loyaltyTier = loyaltyTier;
    if (source) profileWhere.source = source;
    if (minSpent !== undefined || maxSpent !== undefined) {
      profileWhere.totalSpent = {};
      if (minSpent !== undefined) profileWhere.totalSpent.gte = minSpent;
      if (maxSpent !== undefined) profileWhere.totalSpent.lte = maxSpent;
    }
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        profileWhere.tags = { hasSome: tagList };
      }
    }

    // Build User where clause — search across name/email
    // Only real customers:
    //   1. role must be CLIENT (exclude SUPERADMIN/ADMIN/MANAGER/TECHNICIAN/STAFF)
    //   2. customerProfile must actually exist — Prisma treats an empty
    //      relation filter `{}` as "no filter", which would include users
    //      without a profile. Use `is:` with conditions (or `isNot: null`)
    //      to force the existence check.
    const hasProfileFilter = Object.keys(profileWhere).length > 0;
    const userWhere: {
      role: "CLIENT";
      customerProfile: { is: typeof profileWhere } | { isNot: null };
      OR?: Array<{
        email?: { contains: string; mode: "insensitive" };
        firstName?: { contains: string; mode: "insensitive" };
        lastName?: { contains: string; mode: "insensitive" };
        phone?: { contains: string; mode: "insensitive" };
      }>;
    } = {
      role: "CLIENT",
      customerProfile: hasProfileFilter ? { is: profileWhere } : { isNot: null },
    };

    if (search) {
      userWhere.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    // Build orderBy — some sorts are on the profile relation
    let orderBy:
      | { lastName: "asc" }
      | { customerProfile: { loyaltyPoints: "desc" } }
      | { lastLoginAt: "desc" }
      | { customerProfile: { totalSpent: "desc" } }
      | { createdAt: "desc" };
    switch (sort) {
      case "name":
        orderBy = { lastName: "asc" };
        break;
      case "points_desc":
        orderBy = { customerProfile: { loyaltyPoints: "desc" } };
        break;
      case "last_active":
        orderBy = { lastLoginAt: "desc" };
        break;
      case "total_spent":
        orderBy = { customerProfile: { totalSpent: "desc" } };
        break;
      default:
        orderBy = { createdAt: "desc" };
    }

    const [customers, total] = await Promise.all([
      app.prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          lastLoginAt: true,
          createdAt: true,
          customerProfile: {
            select: {
              loyaltyTier: true,
              loyaltyPoints: true,
              totalOrders: true,
              totalSpent: true,
              source: true,
              tags: true,
              healthScore: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      app.prisma.user.count({ where: userWhere }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: customers,
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

  // ───────────────────────────────────────────────────────────
  // GET /customers/:id — Full 360-degree profile
  // ───────────────────────────────────────────────────────────
  app.get("/customers/:id", async (request, reply) => {
    const id = parseIdParam(request.params);

    const customer = await app.prisma.user.findUnique({
      where: { id },
      include: {
        customerProfile: {
          include: {
            loyaltyLog: {
              take: 10,
              orderBy: { createdAt: "desc" },
            },
          },
        },
        addresses: {
          orderBy: { isDefault: "desc" },
        },
        orders: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalTtc: true,
            paymentMethod: true,
            shippingMethod: true,
            createdAt: true,
          },
        },
        repairTickets: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            ticketNumber: true,
            status: true,
            productModel: true,
            type: true,
            priority: true,
            estimatedCost: true,
            actualCost: true,
            trackingToken: true,
            createdAt: true,
            closedAt: true,
          },
        },
        interactions: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            channel: true,
            subject: true,
            content: true,
            referenceId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer || customer.role !== "CLIENT") {
      // Hide staff/admin users behind a 404 — this endpoint is only meant
      // to serve customer profiles, not backoffice accounts.
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Client '${id}' introuvable` },
      });
    }

    return { success: true, data: customer };
  });

  // ───────────────────────────────────────────────────────────
  // PUT /customers/:id — Update customer profile (admin CRM)
  // ───────────────────────────────────────────────────────────
  app.put("/customers/:id", async (request, reply) => {
    const id = parseIdParam(request.params);
    const body = updateCustomerSchema.parse(request.body);

    const existing = await app.prisma.user.findUnique({
      where: { id },
      include: { customerProfile: true },
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Client '${id}' introuvable` },
      });
    }

    const profileData: {
      source?: string;
      tags?: string[];
      scooterModels?: string[];
      healthScore?: number | null;
    } = {};
    if (body.source !== undefined) profileData.source = body.source;
    if (body.tags !== undefined) profileData.tags = body.tags;
    if (body.scooterModels !== undefined) profileData.scooterModels = body.scooterModels;
    if (body.healthScore !== undefined) profileData.healthScore = body.healthScore;

    const [updatedUser, updatedProfile] = await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id },
        data: {
          ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
          ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      }),
      app.prisma.customerProfile.update({
        where: { userId: id },
        data: profileData,
        select: {
          loyaltyTier: true,
          loyaltyPoints: true,
          totalOrders: true,
          totalSpent: true,
          source: true,
          tags: true,
          scooterModels: true,
          healthScore: true,
        },
      }),
    ]);

    app.log.info({ customerId: id, userId: (request.user as { userId?: string })?.userId }, "Customer profile updated");

    return {
      success: true,
      data: {
        ...updatedUser,
        customerProfile: updatedProfile,
      },
    };
  });

  // ───────────────────────────────────────────────────────────
  // GET /customers/:id/timeline — Paginated interaction history
  // ───────────────────────────────────────────────────────────
  app.get("/customers/:id/timeline", async (request, reply) => {
    const id = parseIdParam(request.params);
    const query = timelineQuerySchema.parse(request.query);
    const { page, limit, type } = query;
    const skip = (page - 1) * limit;

    // Verify customer exists
    const userExists = await app.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!userExists) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Client '${id}' introuvable` },
      });
    }

    const where: {
      customerId: string;
      type?: "EMAIL" | "CALL" | "VISIT" | "SMS" | "NOTE" | "ORDER" | "SAV";
    } = { customerId: id };
    if (type) where.type = type;

    const [interactions, total] = await Promise.all([
      app.prisma.customerInteraction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      app.prisma.customerInteraction.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: interactions,
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

  // ───────────────────────────────────────────────────────────
  // POST /customers/:id/loyalty/add — Add loyalty points
  // ───────────────────────────────────────────────────────────
  app.post("/customers/:id/loyalty/add", async (request, reply) => {
    const id = parseIdParam(request.params);
    const body = addPointsSchema.parse(request.body);

    // Ensure profile exists
    const profile = await app.prisma.customerProfile.findUnique({
      where: { userId: id },
      select: { id: true, loyaltyPoints: true, loyaltyTier: true },
    });

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Profil client '${id}' introuvable` },
      });
    }

    const newTotal = profile.loyaltyPoints + body.points;
    const newTier = computeLoyaltyTier(newTotal);

    const [updatedProfile, loyaltyRecord] = await app.prisma.$transaction([
      app.prisma.customerProfile.update({
        where: { userId: id },
        data: {
          loyaltyPoints: { increment: body.points },
          loyaltyTier: newTier,
        },
        select: {
          id: true,
          userId: true,
          loyaltyTier: true,
          loyaltyPoints: true,
          totalOrders: true,
          totalSpent: true,
        },
      }),
      app.prisma.loyaltyPoint.create({
        data: {
          profileId: profile.id,
          points: body.points,
          type: body.type ?? "ADJUSTMENT",
          referenceId: body.referenceId ?? null,
          description: body.reason,
        },
      }),
    ]);

    app.log.info({ customerId: id, points: body.points, newTier, userId: (request.user as { userId?: string })?.userId }, "Loyalty points added");

    return {
      success: true,
      data: {
        profile: updatedProfile,
        transaction: loyaltyRecord,
      },
    };
  });

  // ───────────────────────────────────────────────────────────
  // POST /customers/:id/interactions — Create interaction
  // ───────────────────────────────────────────────────────────
  app.post("/customers/:id/interactions", async (request, reply) => {
    const id = parseIdParam(request.params);
    const body = createInteractionSchema.parse(request.body);

    // Verify customer exists
    const userExists = await app.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!userExists) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Client '${id}' introuvable` },
      });
    }

    const interaction = await app.prisma.customerInteraction.create({
      data: {
        customerId: id,
        type: body.type,
        channel: body.channel ?? "MANUAL",
        subject: body.subject ?? null,
        content: body.content ?? null,
        referenceId: body.referenceId ?? null,
      },
    });

    app.log.info({ customerId: id, interactionType: body.type, userId: (request.user as { userId?: string })?.userId }, "Customer interaction created");

    return { success: true, data: interaction };
  });

  // GET /customers/:id/garage — Full repair + purchase history (timeline)
  app.get("/customers/:id/garage", async (request, reply) => {
    const id = parseIdParam(request.params);

    // Get customer profile
    const profile = await app.prisma.customerProfile.findUnique({
      where: { userId: id },
      select: {
        loyaltyTier: true,
        loyaltyPoints: true,
        totalOrders: true,
        totalSpent: true,
        scooterModels: true,
        tags: true,
      },
    });

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Profil client introuvable" },
      });
    }

    // Fetch repairs, orders, and interactions in parallel
    const [repairs, orders, interactions] = await Promise.all([
      app.prisma.repairTicket.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          ticketNumber: true,
          productModel: true,
          type: true,
          status: true,
          priority: true,
          visitReason: true,
          diagnosis: true,
          estimatedCost: true,
          actualCost: true,
          createdAt: true,
          closedAt: true,
        },
      }),
      app.prisma.order.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalTtc: true,
          paymentMethod: true,
          createdAt: true,
          items: {
            select: {
              quantity: true,
              product: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      app.prisma.customerInteraction.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          channel: true,
          subject: true,
          createdAt: true,
        },
      }),
    ]);

    // Build unified timeline (sorted by date, newest first)
    const timeline: Array<{
      date: Date;
      type: "REPAIR" | "ORDER" | "INTERACTION";
      data: unknown;
    }> = [];

    for (const r of repairs) {
      timeline.push({ date: r.createdAt, type: "REPAIR", data: r });
    }
    for (const o of orders) {
      timeline.push({ date: o.createdAt, type: "ORDER", data: o });
    }
    for (const i of interactions) {
      timeline.push({ date: i.createdAt, type: "INTERACTION", data: i });
    }

    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      success: true,
      data: {
        profile,
        stats: {
          totalRepairs: repairs.length,
          activeRepairs: repairs.filter((r: { status: string }) => !["RECUPERE", "REFUS_CLIENT", "IRREPARABLE"].includes(r.status)).length,
          totalOrders: orders.length,
          totalSpent: Number(profile.totalSpent),
          scooterModels: profile.scooterModels,
        },
        timeline,
      },
    };
  });

  // ───────────────────────────────────────────────────────────
  // PUT /customers/:id/status — Activate, suspend, or ban a customer (ADMIN+ only)
  // ───────────────────────────────────────────────────────────
  app.put("/customers/:id/status", async (request, reply) => {
    // T-04: RBAC — only SUPERADMIN/ADMIN can change account status
    const reqUserStatus = request.user as { role?: string } | undefined;
    if (!reqUserStatus || !["SUPERADMIN", "ADMIN"].includes(reqUserStatus.role ?? "")) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Seuls les administrateurs peuvent modifier le statut d'un compte" },
      });
    }
    const id = parseIdParam(request.params);
    const body = z.object({
      status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
      reason: z.string().max(500).optional(),
    }).parse(request.body);

    const existing = await app.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Client introuvable" },
      });
    }

    const user = await app.prisma.user.update({
      where: { id },
      data: { status: body.status },
      select: { id: true, email: true, firstName: true, lastName: true, status: true },
    });

    // Log the interaction
    await app.prisma.customerInteraction.create({
      data: {
        customerId: id,
        type: "NOTE",
        channel: "SYSTEM",
        subject: `Compte ${body.status === "ACTIVE" ? "réactivé" : body.status === "SUSPENDED" ? "suspendu" : "banni"}`,
        content: body.reason ?? null,
      },
    });

    app.log.info({ customerId: id, status: body.status, userId: (reqUserStatus as { userId?: string })?.userId }, "Customer status changed");

    return { success: true, data: user };
  });

  // ───────────────────────────────────────────────────────────
  // GET /customers/:id/rgpd-export — Full data export (RGPD art. 15)
  // ───────────────────────────────────────────────────────────
  // Aggregates everything the CRM can read about a customer into a
  // single JSON document. Returned as a downloadable file so the
  // admin can forward it to the customer on request.
  app.get("/customers/:id/rgpd-export", async (request, reply) => {
    const id = parseIdParam(request.params);
    const customer = await app.prisma.user.findUnique({
      where: { id },
      include: {
        customerProfile: { include: { loyaltyLog: true } },
        addresses: true,
        orders: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        },
        repairTickets: {
          include: {
            partsUsed: true,
            statusLog: true,
          },
        },
        interactions: true,
      },
    });

    if (!customer || customer.role !== "CLIENT") {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Client introuvable" },
      });
    }

    // CL-09: Use dedicated DPO email, separate from general contact
    const dpoEmail = process.env.DPO_EMAIL || "dpo@trottistore.fr";

    const exportDoc = {
      generatedAt: new Date().toISOString(),
      exportKind: "RGPD_ART_15_ACCESS",
      dpoContact: dpoEmail,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        role: customer.role,
        status: customer.status,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        lastLoginAt: customer.lastLoginAt,
        loginCount: customer.loginCount,
      },
      profile: customer.customerProfile,
      addresses: customer.addresses,
      orders: customer.orders,
      repairTickets: customer.repairTickets,
      interactions: customer.interactions,
    };

    const filename = `rgpd-${customer.email.replace(/[^a-z0-9.-]/gi, "_")}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    return reply.send(JSON.stringify(exportDoc, null, 2));
  });

  // ───────────────────────────────────────────────────────────
  // POST /customers/:id/anonymize — Right to erasure (RGPD art. 17)
  // ───────────────────────────────────────────────────────────
  // Replaces PII with anonymous placeholders but keeps the user row
  // + order history because the orders have legal value for tax
  // purposes (min 10 years retention). The customer is banned to
  // prevent new logins, the email is rewritten to a non-routable
  // sentinel, and the customerProfile is wiped of identifying tags.
  app.post("/customers/:id/anonymize", async (request, reply) => {
    const reqUser = request.user as { role?: string } | undefined;
    if (!reqUser || !["SUPERADMIN", "ADMIN"].includes(reqUser.role ?? "")) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Seuls SUPERADMIN et ADMIN peuvent anonymiser un compte",
        },
      });
    }

    const id = parseIdParam(request.params);
    const existing = await app.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, email: true },
    });
    if (!existing || existing.role !== "CLIENT") {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Client introuvable" },
      });
    }

    // Guard: the email must not already look anonymized to avoid double-
    // processing in case of a retry.
    if (existing.email.startsWith("anonymized+")) {
      return reply.status(409).send({
        success: false,
        error: { code: "ALREADY_ANONYMIZED", message: "Ce compte est déjà anonymisé" },
      });
    }

    const sentinelEmail = `anonymized+${id}@invalid.trottistore.local`;

    await app.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          email: sentinelEmail,
          firstName: "Client",
          lastName: "Anonymisé",
          phone: null,
          passwordHash: null,
          status: "BANNED",
          metadata: {},
        },
      });

      // Reset profile fields that carry PII/behavioral data.
      await tx.customerProfile.updateMany({
        where: { userId: id },
        data: {
          tags: [],
          scooterModels: [],
          notes: null,
        },
      });

      // Drop addresses — they're PII and no longer needed once the
      // account is gone.
      await tx.address.deleteMany({ where: { userId: id } });

      // RGPD-CRIT: Scrub denormalized PII on repair tickets and appointments
      await tx.repairTicket.updateMany({
        where: { customerId: id },
        data: {
          customerName: "Client Anonymisé",
          customerEmail: sentinelEmail,
          customerPhone: null,
        },
      });
      await tx.repairAppointment.updateMany({
        where: { customerId: id },
        data: {
          customerName: "Client Anonymisé",
          customerEmail: sentinelEmail,
          customerPhone: "00 00 00 00 00",
        },
      });

      // Scrub interaction content that may contain PII
      await tx.customerInteraction.updateMany({
        where: { customerId: id },
        data: { content: "[contenu effacé — RGPD art. 17]", subject: "Interaction anonymisée" },
      });

      // Revoke all sessions
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });

      // Log the interaction for audit trail.
      await tx.customerInteraction.create({
        data: {
          customerId: id,
          type: "NOTE",
          channel: "SYSTEM",
          subject: "Compte anonymisé (RGPD art. 17)",
          content: "Données personnelles effacées à la demande du client.",
        },
      });
    });

    app.log.info({ customerId: id, userId: (reqUser as { userId?: string })?.userId }, "Customer anonymized (RGPD art. 17)");

    return { success: true };
  });

  // ───────────────────────────────────────────────────────────
  // POST /customers/merge — Merge two customer accounts into one
  // ───────────────────────────────────────────────────────────
  app.post("/customers/merge", async (request, reply) => {
    // T-03: RBAC — only SUPERADMIN/ADMIN can merge accounts
    const reqUser = request.user as { role?: string } | undefined;
    if (!reqUser || !["SUPERADMIN", "ADMIN"].includes(reqUser.role ?? "")) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Seuls les administrateurs peuvent fusionner des comptes" },
      });
    }

    const body = z.object({
      keepId: z.string().uuid(),
      mergeId: z.string().uuid(),
    }).parse(request.body);

    // T-03: Prevent merging non-CLIENT accounts (protect backoffice users)
    if (body.keepId === body.mergeId) {
      return reply.status(400).send({
        success: false,
        error: { code: "SAME_ACCOUNT", message: "Impossible de fusionner un compte avec lui-même" },
      });
    }

    const [keepUser, mergeUser] = await Promise.all([
      app.prisma.user.findUnique({ where: { id: body.keepId }, select: { id: true, role: true } }),
      app.prisma.user.findUnique({ where: { id: body.mergeId }, select: { id: true, role: true } }),
    ]);

    if (!keepUser || !mergeUser) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Un des deux comptes est introuvable" },
      });
    }

    // T-03: Only allow merging CLIENT accounts (protect backoffice users)
    if (keepUser.role !== "CLIENT" || mergeUser.role !== "CLIENT") {
      return reply.status(400).send({
        success: false,
        error: { code: "NOT_CLIENT", message: "Seuls les comptes clients peuvent être fusionnés" },
      });
    }

    // Single transaction: every step must commit or roll back together so that
    // a crash midway never leaves the system in a half-merged state. This also
    // migrates loyalty point history (previously orphaned by the cascade delete
    // on CustomerProfile) and deletes the merged profile to avoid zombie rows.
    await app.prisma.$transaction(async (tx) => {
      // 1. Transfer ownership of all related rows from mergeUser to keepUser.
      await tx.order.updateMany({
        where: { customerId: body.mergeId },
        data: { customerId: body.keepId },
      });
      await tx.repairTicket.updateMany({
        where: { customerId: body.mergeId },
        data: { customerId: body.keepId },
      });
      await tx.address.updateMany({
        where: { userId: body.mergeId },
        data: { userId: body.keepId },
      });
      await tx.customerInteraction.updateMany({
        where: { customerId: body.mergeId },
        data: { customerId: body.keepId },
      });
      await tx.review.updateMany({
        where: { userId: body.mergeId },
        data: { userId: body.keepId },
      });

      // 2. Merge customer profiles (loyalty totals + history reparent + deletion).
      // Read both profiles inside the transaction so the totals we add are
      // consistent with the rows we move.
      const [keepProfile, mergeProfile] = await Promise.all([
        tx.customerProfile.findUnique({ where: { userId: body.keepId } }),
        tx.customerProfile.findUnique({ where: { userId: body.mergeId } }),
      ]);

      if (mergeProfile) {
        if (keepProfile) {
          // Reparent loyalty log rows BEFORE deleting mergeProfile, otherwise
          // the cascade delete on CustomerProfile would wipe them.
          await tx.loyaltyPoint.updateMany({
            where: { profileId: mergeProfile.id },
            data: { profileId: keepProfile.id },
          });

          await tx.customerProfile.update({
            where: { id: keepProfile.id },
            data: {
              loyaltyPoints: keepProfile.loyaltyPoints + mergeProfile.loyaltyPoints,
              totalOrders: keepProfile.totalOrders + mergeProfile.totalOrders,
              totalSpent: { increment: Number(mergeProfile.totalSpent) },
            },
          });

          // Now safe to delete the merged profile — its loyalty log has moved.
          await tx.customerProfile.delete({ where: { id: mergeProfile.id } });
        } else {
          // No profile on the kept side: just reparent the existing profile.
          await tx.customerProfile.update({
            where: { id: mergeProfile.id },
            data: { userId: body.keepId },
          });
        }
      }

      // Transfer appointments and invalidate sessions on merged account
      await tx.repairAppointment.updateMany({
        where: { customerId: body.mergeId },
        data: { customerId: body.keepId },
      });
      await tx.refreshToken.deleteMany({ where: { userId: body.mergeId } });
      await tx.passwordResetToken.deleteMany({ where: { userId: body.mergeId } });

      // 3. Deactivate the merged user account.
      await tx.user.update({
        where: { id: body.mergeId },
        data: {
          status: "INACTIVE",
          email: `merged_${body.mergeId}@deleted.local`,
        },
      });

      // 4. Log the merge as a system interaction on the kept account.
      await tx.customerInteraction.create({
        data: {
          customerId: body.keepId,
          type: "NOTE",
          channel: "SYSTEM",
          subject: "Fusion de compte",
          content: `Compte ${body.mergeId} fusionné dans ce compte. Commandes, tickets, adresses et points de fidélité transférés.`,
        },
      });
    });

    app.log.info({ keepId: body.keepId, mergeId: body.mergeId, userId: (reqUser as { userId?: string })?.userId }, "Customer accounts merged");

    return {
      success: true,
      data: {
        keptAccount: body.keepId,
        mergedAccount: body.mergeId,
        message: "Comptes fusionnés avec succès",
      },
    };
  });
}
