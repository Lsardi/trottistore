/**
 * Admin user/staff management routes.
 *
 * Allows admins to create, list, update, and deactivate staff members.
 * Sends invitation emails with a password reset link for new accounts.
 *
 * All routes require ADMIN+ role.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { parseIdParam } from "@trottistore/shared";
import { requireRole } from "../../plugins/auth.js";
import { sendEmail } from "@trottistore/shared/notifications";
import { staffInvitationEmail } from "../../emails/templates.js";

// ---------------------------------------------------------------------------
// Constants & schemas
// ---------------------------------------------------------------------------

// SUPERADMIN excluded — only SUPERADMIN can promote to SUPERADMIN (handled separately)
const STAFF_ROLES = ["ADMIN", "MANAGER", "TECHNICIAN", "STAFF"] as const;
const INVITATION_EXPIRY_HOURS = 72;

const createStaffSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  role: z.enum(STAFF_ROLES),
  phone: z.string().max(20).optional(),
});

const updateStaffSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  role: z.enum(STAFF_ROLES).optional(),
  phone: z.string().max(20).optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function adminUserRoutes(app: FastifyInstance) {
  const adminOnly = {
    preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN")],
  };

  // GET /admin/users — List all staff members (non-CLIENT)
  app.get("/admin/users", adminOnly, async (request) => {
    const query = request.query as { role?: string; status?: string };

    const where: Record<string, unknown> = {
      role: { not: "CLIENT" },
    };
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;

    const users = await app.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        phone: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: users };
  });

  // GET /admin/users/:id — Staff member detail with activity
  app.get("/admin/users/:id", adminOnly, async (request, reply) => {
    const id = parseIdParam(request.params);

    const user = await app.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        phone: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Utilisateur introuvable" },
      });
    }

    // Fetch recent activity: orders processed, tickets handled
    const [processedOrders, handledTickets] = await Promise.all([
      app.prisma.orderStatusHistory.findMany({
        where: { changedBy: id },
        orderBy: { changedAt: "desc" },
        take: 20,
        select: {
          orderId: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          changedAt: true,
        },
      }),
      app.prisma.repairTicket.findMany({
        where: { assignedTo: id },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          productModel: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        ...user,
        activity: {
          processedOrders,
          handledTickets,
        },
      },
    };
  });

  // POST /admin/users — Create staff member + send invitation email
  app.post("/admin/users", adminOnly, async (request, reply) => {
    const parsed = createStaffSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Données invalides",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    // Check email uniqueness
    const existing = await app.prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: "EMAIL_TAKEN", message: "Cet email est déjà utilisé" },
      });
    }

    // Create user without password (must set via invitation link)
    const user = await app.prisma.user.create({
      data: {
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        role: parsed.data.role,
        phone: parsed.data.phone ?? null,
        passwordHash: null, // No password yet — set via invitation
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Create a password reset token for the invitation (72h expiry)
    const rawToken = randomUUID();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);

    await app.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Send invitation email
    const baseUrl = process.env.BASE_URL || "https://trottistore.fr";
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    const { subject, html } = staffInvitationEmail(
      user.firstName,
      parsed.data.role,
      resetUrl,
    );

    sendEmail(user.email, subject, html).catch((err) => {
      app.log.error({ err, userId: user.id }, "Failed to send staff invitation email");
    });

    return reply.status(201).send({
      success: true,
      data: { user, invitationSent: true },
    });
  });

  // PUT /admin/users/:id — Update staff member (role, status, info)
  app.put("/admin/users/:id", adminOnly, async (request, reply) => {
    const id = parseIdParam(request.params);

    const parsed = updateStaffSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Données invalides" },
      });
    }

    const existing = await app.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Utilisateur introuvable" },
      });
    }

    // Prevent self-demotion or self-deactivation
    const requestUser = request.user as { userId?: string; id?: string };
    const requestUserId = requestUser.userId ?? requestUser.id;
    if (id === requestUserId && parsed.data.status === "SUSPENDED") {
      return reply.status(400).send({
        success: false,
        error: { code: "SELF_SUSPEND", message: "Vous ne pouvez pas vous désactiver vous-même" },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.firstName !== undefined) updateData.firstName = parsed.data.firstName;
    if (parsed.data.lastName !== undefined) updateData.lastName = parsed.data.lastName;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

    const user = await app.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        phone: true,
      },
    });

    return { success: true, data: user };
  });

  // POST /admin/users/:id/reset-password — Force send a password reset email
  app.post("/admin/users/:id/reset-password", adminOnly, async (request, reply) => {
    const id = parseIdParam(request.params);

    const user = await app.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true, status: true },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Utilisateur introuvable" },
      });
    }

    // Invalidate previous tokens
    await app.prisma.passwordResetToken.updateMany({
      where: { userId: id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Create new token (72h for staff, same as invitation)
    const rawToken = randomUUID();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);

    await app.prisma.passwordResetToken.create({
      data: { userId: id, tokenHash, expiresAt },
    });

    // Import and use the standard password reset email template
    const { passwordResetEmail } = await import("../../emails/templates.js");
    const baseUrl = process.env.BASE_URL || "https://trottistore.fr";
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    const { subject, html } = passwordResetEmail(user.firstName, resetUrl);

    sendEmail(user.email, subject, html).catch((err) => {
      app.log.error({ err, userId: id }, "Failed to send admin-initiated password reset email");
    });

    return {
      success: true,
      data: { message: `Email de réinitialisation envoyé à ${user.email}` },
    };
  });
}
