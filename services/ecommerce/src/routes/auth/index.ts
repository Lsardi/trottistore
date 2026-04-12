import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role, JwtAccessPayload, JwtRefreshPayload } from "@trottistore/shared";
import { sendEmail } from "@trottistore/shared/notifications";
import { welcomeEmail, passwordResetEmail } from "../../emails/templates.js";
import { ROLES } from "@trottistore/shared";
import type { InputJsonValue } from "@prisma/client/runtime/library";

// ─── Constants ─────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_DAYS = 30;
const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

// ─── Validation schemas ────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email("Email invalide").max(255).toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(128),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  phone: z.string().max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(1).max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(128),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  phone: z.string().max(20).trim().optional().nullable(),
});

// ─── Helpers ───────────────────────────────────────────────

/** SHA-256 hash of a raw refresh token (stored in DB, never the raw value) */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Generate a signed access token */
function signAccessToken(
  app: FastifyInstance,
  user: { id: string; email: string; role: string },
): string {
  const payload: Omit<JwtAccessPayload, "iat" | "exp"> = {
    sub: user.id,
    email: user.email,
    role: user.role as Role,
  };

  return app.jwt.sign(
    payload,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
}

/** Generate a random refresh token, store its hash in DB, return the raw token */
async function createRefreshToken(
  app: FastifyInstance,
  userId: string,
  deviceInfo?: Record<string, unknown>,
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = randomUUID() + randomUUID(); // 72-char opaque token
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  );

  await app.prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      deviceInfo: (deviceInfo as InputJsonValue | undefined) ?? undefined,
    },
  });

  return { rawToken, expiresAt };
}

/** Set refresh token as httpOnly cookie */
function setRefreshCookie(
  reply: FastifyReply,
  rawToken: string,
  expiresAt: Date,
) {
  reply.setCookie("refresh_token", rawToken, {
    path: "/api/v1/auth",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: expiresAt,
  });
}

/** Clear refresh token cookie */
function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie("refresh_token", {
    path: "/api/v1/auth",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
}

// ─── Routes ────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  // ── POST /auth/register ────────────────────────────────
  app.post("/auth/register", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // Check if email already taken
    const existing = await app.prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });

    if (existing) {
      return reply.status(409).send({
        success: false,
        error: {
          code: "EMAIL_TAKEN",
          message: "Cet email est déjà utilisé",
        },
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    // Create user + CRM profile in a transaction
    const user = await app.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone ?? null,
          role: "CLIENT",
          status: "ACTIVE",
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });

      // Create CRM customer profile
      await tx.customerProfile.create({
        data: {
          userId: newUser.id,
          source: "WEBSITE",
          loyaltyTier: "BRONZE",
          loyaltyPoints: 0,
          totalOrders: 0,
          totalSpent: 0,
        },
      });

      return newUser;
    });

    // Send welcome email (non-blocking)
    const { subject, html } = welcomeEmail(user.firstName);
    sendEmail(user.email, subject, html).catch((e: unknown) =>
      app.log.error({ err: e }, "Failed to send welcome email"),
    );

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
    });
  });

  // ── POST /auth/login ───────────────────────────────────
  app.post("/auth/login", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body);

    // Find user
    const user = await app.prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        passwordHash: true,
        loginCount: true,
      },
    });

    if (!user || !user.passwordHash) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email ou mot de passe incorrect",
        },
      });
    }

    if (user.status !== "ACTIVE") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "ACCOUNT_DISABLED",
          message: "Ce compte est désactivé",
        },
      });
    }

    // Verify password
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email ou mot de passe incorrect",
        },
      });
    }

    // Generate tokens
    const accessToken = signAccessToken(app, user);
    const { rawToken, expiresAt } = await createRefreshToken(app, user.id);

    // Update login stats
    await app.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: user.loginCount + 1,
      },
    });

    // Set cookie
    setRefreshCookie(reply, rawToken, expiresAt);

    return {
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
    };
  });

  // ── POST /auth/refresh ─────────────────────────────────
  app.post("/auth/refresh", async (request, reply) => {
    const rawToken = request.cookies.refresh_token;

    if (!rawToken) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "NO_REFRESH_TOKEN",
          message: "Refresh token manquant",
        },
      });
    }

    const tokenHash = hashToken(rawToken);

    // Find the stored refresh token
    const storedToken = await app.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!storedToken) {
      clearRefreshCookie(reply);
      return reply.status(401).send({
        success: false,
        error: {
          code: "INVALID_REFRESH_TOKEN",
          message: "Refresh token invalide",
        },
      });
    }

    // Check expiry
    if (storedToken.expiresAt < new Date()) {
      await app.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      clearRefreshCookie(reply);
      return reply.status(401).send({
        success: false,
        error: {
          code: "REFRESH_TOKEN_EXPIRED",
          message: "Refresh token expiré",
        },
      });
    }

    // Check if already revoked
    if (storedToken.revokedAt) {
      // Potential token reuse attack — revoke all tokens for this user
      await app.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      clearRefreshCookie(reply);
      return reply.status(401).send({
        success: false,
        error: {
          code: "REFRESH_TOKEN_REVOKED",
          message: "Refresh token révoqué — reconnectez-vous",
        },
      });
    }

    // Check user is still active
    if (storedToken.user.status !== "ACTIVE") {
      clearRefreshCookie(reply);
      return reply.status(403).send({
        success: false,
        error: {
          code: "ACCOUNT_DISABLED",
          message: "Ce compte est désactivé",
        },
      });
    }

    // Token rotation: revoke old, issue new
    const [, { rawToken: newRawToken, expiresAt: newExpiresAt }] =
      await Promise.all([
        app.prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokedAt: new Date() },
        }),
        createRefreshToken(app, storedToken.userId),
      ]);

    const accessToken = signAccessToken(app, storedToken.user);
    setRefreshCookie(reply, newRawToken, newExpiresAt);

    return {
      success: true,
      data: { accessToken },
    };
  });

  // ── POST /auth/logout ──────────────────────────────────
  app.post("/auth/logout", async (request, reply) => {
    const rawToken = request.cookies.refresh_token;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      // Revoke the refresh token (ignore if not found)
      await app.prisma.refreshToken
        .update({
          where: { tokenHash },
          data: { revokedAt: new Date() },
        })
        .catch(() => {
          // Token not found — already revoked or invalid, nothing to do
        });
    }

    clearRefreshCookie(reply);

    return { success: true };
  });

  // ── POST /auth/logout-all — Revoke all refresh tokens (all devices)
  app.post(
    "/auth/logout-all",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const { count } = await app.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      clearRefreshCookie(reply);

      return {
        success: true,
        data: { revokedCount: count, message: "Tous les appareils ont été déconnectés" },
      };
    },
  );

  // ── GET /auth/me ───────────────────────────────────────
  app.get(
    "/auth/me",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const user = await app.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          phone: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          status: true,
          lastLoginAt: true,
          loginCount: true,
          createdAt: true,
          addresses: {
            orderBy: { isDefault: "desc" },
            select: {
              id: true,
              type: true,
              label: true,
              firstName: true,
              lastName: true,
              company: true,
              street: true,
              street2: true,
              city: true,
              postalCode: true,
              country: true,
              phone: true,
              isDefault: true,
            },
          },
          customerProfile: {
            select: {
              loyaltyTier: true,
              loyaltyPoints: true,
              totalOrders: true,
              totalSpent: true,
              lastOrderAt: true,
            },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Utilisateur introuvable" },
        });
      }

      return {
        success: true,
        data: { user },
      };
    },
  );

  // ── PUT /auth/profile — Update current user profile ─────
  app.put(
    "/auth/profile",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const parsed = updateProfileSchema.safeParse(request.body);
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

      // Filter out undefined values (only update provided fields)
      const updateData: Record<string, unknown> = {};
      if (parsed.data.firstName !== undefined) updateData.firstName = parsed.data.firstName;
      if (parsed.data.lastName !== undefined) updateData.lastName = parsed.data.lastName;
      if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;

      if (Object.keys(updateData).length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: "NO_CHANGES", message: "Aucun champ à mettre à jour" },
        });
      }

      const user = await app.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatarUrl: true,
        },
      });

      return { success: true, data: { user } };
    },
  );

  // ── GET /auth/garage — list user's saved scooters (My Garage) ──
  // Stored as String[] on CustomerProfile.scooterModels, each entry is a
  // canonical "Brand Model" string. The frontend mirrors this in its
  // localStorage so anonymous users can also use the garage.
  app.get(
    "/auth/garage",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const profile = await app.prisma.customerProfile.findUnique({
        where: { userId },
        select: { scooterModels: true },
      });
      return reply.send({ success: true, data: { scooters: profile?.scooterModels ?? [] } });
    },
  );

  // ── PUT /auth/garage — replace the user's garage with the provided list ──
  // The client sends the canonical merged list (server + localStorage union),
  // we just persist it. Idempotent.
  const updateGarageSchema = z.object({
    scooters: z.array(z.string().min(1).max(120)).max(50),
  });

  app.put(
    "/auth/garage",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const parsed = updateGarageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Liste de scooters invalide",
            details: parsed.error.flatten().fieldErrors,
          },
        });
      }
      // De-duplicate case-insensitively, keep first occurrence's casing.
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const raw of parsed.data.scooters) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(trimmed);
      }

      // Upsert the customer profile (some users may not have one yet,
      // e.g. registered then never bought anything).
      await app.prisma.customerProfile.upsert({
        where: { userId },
        update: { scooterModels: deduped },
        create: { userId, scooterModels: deduped },
      });

      return reply.send({ success: true, data: { scooters: deduped } });
    },
  );

  // ── GET /auth/export — RGPD data portability (art. 20) ──
  app.get(
    "/auth/export",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      const user = await app.prisma.user.findUnique({
        where: { id: userId },
        include: {
          addresses: true,
          orders: {
            include: { items: { select: { productId: true, quantity: true, unitPriceHt: true } } },
            orderBy: { createdAt: "desc" },
          },
          customerProfile: true,
          refreshTokens: false,
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Utilisateur introuvable" },
        });
      }

      // Strip sensitive fields
      const { passwordHash: _, refreshTokens: _rt, ...safeUser } = user as Record<string, unknown>;

      return {
        success: true,
        data: {
          exportedAt: new Date().toISOString(),
          user: safeUser,
        },
      };
    },
  );

  // ── DELETE /auth/account — RGPD right to erasure (art. 17) ──
  app.delete(
    "/auth/account",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      // Anonymize instead of hard delete to preserve order history integrity
      await app.prisma.$transaction(async (tx) => {
        // Delete refresh tokens
        await tx.refreshToken.deleteMany({ where: { userId } });

        // Delete addresses
        await tx.address.deleteMany({ where: { userId } });

        // Delete customer profile + interactions
        const profile = await tx.customerProfile.findUnique({ where: { userId } });
        if (profile) {
          await tx.customerInteraction.deleteMany({ where: { customerId: profile.id } });
          await tx.customerProfile.delete({ where: { userId } });
        }

        // Anonymize user (keep for order history FK)
        await tx.user.update({
          where: { id: userId },
          data: {
            email: `deleted_${userId}@anon.trottistore.fr`,
            firstName: "Compte",
            lastName: "Supprimé",
            phone: null,
            passwordHash: "DELETED",
            avatarUrl: null,
            status: "INACTIVE",
          },
        });
      });

      clearRefreshCookie(reply);

      return {
        success: true,
        data: { message: "Compte supprimé. Vos données personnelles ont été effacées." },
      };
    },
  );

  // ─── POST /auth/forgot-password ────────────────────────────
  // Generates a reset token, sends an email with a reset link.
  // Always returns 200 to prevent email enumeration.
  //
  // Timing-attack hardening (CL-06, 2026-04-12): the "email found" branch
  // performs 3 DB writes + a sendEmail, while the "email not found" branch
  // returns immediately. That timing delta (~20-200ms) lets an attacker
  // enumerate registered emails even though the response body is identical.
  //
  // Mitigation: always sleep for a randomized duration (100-500ms) on both
  // branches, so the response latency is dominated by the jitter and not by
  // the real work. Not perfect (a determined attacker with millions of
  // samples can still see a distribution shift) but raises the cost of
  // enumeration to an impractical level and is defense in depth on top of
  // the 3/15min rate limit.
  async function constantTimeJitter(minMs = 100, maxMs = 500): Promise<void> {
    const delay = Math.floor(minMs + Math.random() * (maxMs - minMs));
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }

  const GENERIC_FORGOT_MESSAGE = "Si cette adresse existe, un email a été envoyé.";

  app.post("/auth/forgot-password", {
    config: { rateLimit: { max: 3, timeWindow: "15 minutes" } },
  }, async (request, _reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      // Still return 200 to prevent enumeration
      await constantTimeJitter();
      return { success: true, data: { message: GENERIC_FORGOT_MESSAGE } };
    }

    const user = await app.prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, firstName: true, email: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      // Don't reveal whether the account exists
      await constantTimeJitter();
      return { success: true, data: { message: GENERIC_FORGOT_MESSAGE } };
    }

    // Invalidate any existing unused reset tokens for this user
    await app.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate new token
    const rawToken = randomUUID();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await app.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Send reset email (fire-and-forget, doesn't contribute to response latency)
    const baseUrl = process.env.BASE_URL || "https://trottistore.fr";
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    const { subject, html } = passwordResetEmail(user.firstName, resetUrl);

    sendEmail(user.email, subject, html).catch((err) => {
      app.log.error({ err, userId: user.id }, "Failed to send password reset email");
    });

    await constantTimeJitter();
    return { success: true, data: { message: GENERIC_FORGOT_MESSAGE } };
  });

  // ─── POST /auth/reset-password ─────────────────────────────
  // Validates the reset token and updates the password.
  app.post("/auth/reset-password", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
  }, async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Données invalides" },
      });
    }

    const tokenHash = hashToken(parsed.data.token);

    const resetToken = await app.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, status: true } } },
    });

    if (!resetToken) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_TOKEN", message: "Lien invalide ou expiré" },
      });
    }

    if (resetToken.usedAt) {
      return reply.status(400).send({
        success: false,
        error: { code: "TOKEN_USED", message: "Ce lien a déjà été utilisé" },
      });
    }

    if (resetToken.expiresAt < new Date()) {
      return reply.status(400).send({
        success: false,
        error: { code: "TOKEN_EXPIRED", message: "Ce lien a expiré" },
      });
    }

    if (resetToken.user.status !== "ACTIVE") {
      return reply.status(400).send({
        success: false,
        error: { code: "ACCOUNT_INACTIVE", message: "Compte inactif" },
      });
    }

    // Hash the new password BEFORE the transaction — bcrypt is slow and
    // must not hold the transaction open.
    const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);

    // Atomic claim pattern to prevent a race where two concurrent callers
    // with the same token both pass the `usedAt === null` check above and
    // both overwrite the user password. updateMany with the { usedAt: null }
    // guard only succeeds for the first committer; the loser gets count: 0
    // and we abort the transaction.
    // Refs: AUDIT_ATOMIC.md#P1-5
    const result = await app.prisma.$transaction(async (tx) => {
      const claim = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claim.count === 0) {
        return { ok: false as const };
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash },
      });

      // Revoke all refresh tokens — force re-login on all devices.
      await tx.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return { ok: true as const };
    });

    if (!result.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: "TOKEN_USED", message: "Ce lien a déjà été utilisé" },
      });
    }

    return { success: true, data: { message: "Mot de passe mis à jour. Vous pouvez vous connecter." } };
  });
}
