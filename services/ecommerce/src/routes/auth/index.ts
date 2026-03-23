import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role, JwtAccessPayload, JwtRefreshPayload } from "@trottistore/shared";
import { ROLES } from "@trottistore/shared";

// ─── Constants ─────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_DAYS = 30;
const BCRYPT_ROUNDS = 12;

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
  return app.jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    } satisfies Omit<JwtAccessPayload, "iat" | "exp">,
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
      deviceInfo: deviceInfo ?? undefined,
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
  app.post("/auth/register", async (request, reply) => {
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
  app.post("/auth/login", async (request, reply) => {
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
}
