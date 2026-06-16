import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import qrcode from "qrcode";
import type { Role, JwtAccessPayload, JwtRefreshPayload } from "@trottistore/shared";
import { sendEmail } from "@trottistore/shared/notifications";
import { welcomeEmail, passwordResetEmail } from "../../emails/templates.js";
import { ROLES } from "@trottistore/shared";
import { verifyTurnstile, turnstileEnabled } from "../../lib/turnstile.js";
import type { InputJsonValue } from "@prisma/client/runtime/library";

// ─── Constants ─────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY = "4h";
const ACCESS_TOKEN_MAX_AGE_S = 4 * 60 * 60; // keep in sync with ACCESS_TOKEN_EXPIRY
const REFRESH_TOKEN_DAYS = 30;
const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_EXPIRY_HOURS = 1;
const EMAIL_VERIFY_CODE_LENGTH = 6;
const EMAIL_VERIFY_TTL_SECONDS = 15 * 60; // 15 minutes

function generateVerifyCode(): string {
  const min = Math.pow(10, EMAIL_VERIFY_CODE_LENGTH - 1);
  const max = Math.pow(10, EMAIL_VERIFY_CODE_LENGTH) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

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
  turnstileToken: z.string().max(2048).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(1).max(128),
  totp: z.string().max(20).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  turnstileToken: z.string().max(2048).optional(),
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

/**
 * Set the access token as an httpOnly cookie (path "/").
 * Read by @fastify/jwt (cookieName "access_token") on the API side and by the
 * Next.js middleware server-side. Keeps the token out of reach of JS (no XSS
 * exfiltration), unlike the previous localStorage approach.
 */
function setAccessCookie(reply: FastifyReply, token: string) {
  reply.setCookie("access_token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ACCESS_TOKEN_MAX_AGE_S,
  });
}

/** Clear the access token cookie */
function clearAccessCookie(reply: FastifyReply) {
  reply.clearCookie("access_token", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
}

// ─── 2FA helpers ───────────────────────────────────────────

const TOTP_ISSUER = process.env.TOTP_ISSUER || "TrottiStore";

/** Generate N single-use backup codes (returned once, stored hashed). */
function generateBackupCodes(count = 8): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  for (let i = 0; i < count; i++) {
    // 10 hex chars, grouped as xxxxx-xxxxx for readability
    const raw = randomBytes(5).toString("hex");
    plain.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  const hashed = plain.map((c) => hashToken(c.replace("-", "")));
  return { plain, hashed };
}

/** Verify a TOTP code against a secret (with a ±1 step window). */
function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ""), secret });
  } catch {
    return false;
  }
}

// ─── Routes ────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  /**
   * Bot guard for public auth endpoints. Returns true when the request was
   * blocked (a 400 has already been sent). No-op pass when Turnstile is not
   * configured (dev/test).
   */
  async function blockedByTurnstile(
    request: FastifyRequest,
    reply: FastifyReply,
    token: string | undefined,
  ): Promise<boolean> {
    const result = await verifyTurnstile(token, request.ip);
    if (!result.ok) {
      reply.status(400).send({
        success: false,
        error: {
          code: "CAPTCHA_FAILED",
          message: "Vérification anti-robot échouée. Réessayez.",
          details: { reason: result.reason },
        },
      });
      return true;
    }
    return false;
  }

  // ── POST /auth/register ────────────────────────────────
  app.post("/auth/register", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = registerSchema.parse(request.body);

    if (await blockedByTurnstile(request, reply, body.turnstileToken)) return;

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

    // HIGH-1: Create user + CRM profile in a transaction. Catch P2002 (unique constraint)
    // for race condition on duplicate email instead of relying on the pre-check alone.
    let user;
    try {
    user = await app.prisma.$transaction(async (tx) => {
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
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === "P2002") {
        return reply.status(409).send({
          success: false,
          error: { code: "EMAIL_TAKEN", message: "Cet email est déjà utilisé" },
        });
      }
      throw err;
    }

    // Generate verification code and store in Redis
    const verifyCode = generateVerifyCode();
    await app.redis.set(`email-verify:${user.id}`, verifyCode, "EX", EMAIL_VERIFY_TTL_SECONDS);

    // Send verification email (non-blocking)
    const { verificationEmail } = await import("../../emails/templates.js");
    const { subject, html } = verificationEmail(user.firstName, verifyCode);
    sendEmail(user.email, subject, html).catch((e: unknown) =>
      app.log.error({ err: e }, "Failed to send verification email"),
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
          emailVerified: false,
        },
        message: "Un code de vérification a été envoyé à votre adresse email.",
      },
    });
  });

  // ── POST /auth/verify-email ─────────────────────────────
  app.post("/auth/verify-email", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const schema = z.object({
      userId: z.string().uuid(),
      code: z.string().length(EMAIL_VERIFY_CODE_LENGTH),
    });
    const body = schema.parse(request.body);

    const storedCode = await app.redis.get(`email-verify:${body.userId}`);
    if (!storedCode || storedCode !== body.code) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_CODE", message: "Code invalide ou expiré" },
      });
    }

    // Mark email as verified
    await app.prisma.user.update({
      where: { id: body.userId },
      data: { emailVerified: true },
    });

    // Clean up Redis
    await app.redis.del(`email-verify:${body.userId}`);

    // Send welcome email now that email is verified
    const user = await app.prisma.user.findUnique({
      where: { id: body.userId },
      select: { firstName: true, email: true },
    });
    if (user) {
      const { subject: welcomeSubject, html: welcomeHtml } = welcomeEmail(user.firstName);
      sendEmail(user.email, welcomeSubject, welcomeHtml).catch(() => {});
    }

    return { success: true, data: { message: "Email vérifié avec succès" } };
  });

  // ── POST /auth/resend-verification ──────────────────────
  app.post("/auth/resend-verification", {
    config: { rateLimit: { max: 3, timeWindow: "5 minutes" } },
  }, async (request, reply) => {
    const schema = z.object({ userId: z.string().uuid() });
    const body = schema.parse(request.body);

    const user = await app.prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, email: true, firstName: true, emailVerified: true },
    });

    if (!user || user.emailVerified) {
      // Don't reveal if user exists or is already verified
      return { success: true, data: { message: "Si ce compte existe, un code a été envoyé." } };
    }

    const verifyCode = generateVerifyCode();
    await app.redis.set(`email-verify:${user.id}`, verifyCode, "EX", EMAIL_VERIFY_TTL_SECONDS);

    const { verificationEmail } = await import("../../emails/templates.js");
    const { subject, html } = verificationEmail(user.firstName, verifyCode);
    sendEmail(user.email, subject, html).catch((e: unknown) =>
      app.log.error({ err: e }, "Failed to resend verification email"),
    );

    return { success: true, data: { message: "Si ce compte existe, un code a été envoyé." } };
  });

  // ── POST /auth/login ───────────────────────────────────
  app.post("/auth/login", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body);

    if (await blockedByTurnstile(request, reply, body.turnstileToken)) return;

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
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
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

    // Two-factor challenge (TOTP) — when enabled, a valid code (or a single-use
    // backup code) is required before any token is issued.
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!body.totp) {
        // Password OK but second factor needed — tell the client to prompt.
        return reply.send({ success: true, data: { twoFactorRequired: true } });
      }

      const codeOk = verifyTotp(body.totp, user.twoFactorSecret);
      let backupConsumed = false;

      if (!codeOk) {
        // Fall back to single-use backup codes.
        const presentedHash = hashToken(body.totp.replace(/[\s-]/g, ""));
        if (user.twoFactorBackupCodes.includes(presentedHash)) {
          backupConsumed = true;
          await app.prisma.user.update({
            where: { id: user.id },
            data: {
              twoFactorBackupCodes: user.twoFactorBackupCodes.filter(
                (h) => h !== presentedHash,
              ),
            },
          });
        }
      }

      if (!codeOk && !backupConsumed) {
        return reply.status(401).send({
          success: false,
          error: { code: "INVALID_2FA", message: "Code de vérification invalide" },
        });
      }
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

    // Set cookies (refresh + httpOnly access token)
    setRefreshCookie(reply, rawToken, expiresAt);
    setAccessCookie(reply, accessToken);

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
  app.post("/auth/refresh", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
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
    setAccessCookie(reply, accessToken);

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
    clearAccessCookie(reply);

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
      clearAccessCookie(reply);

      return {
        success: true,
        data: { revokedCount: count, message: "Tous les appareils ont été déconnectés" },
      };
    },
  );

  // ── 2FA (TOTP) management ──────────────────────────────

  // POST /auth/2fa/setup — generate a secret + provisioning QR (not yet enabled)
  app.post(
    "/auth/2fa/setup",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId, email } = request.user;

      const current = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
      });
      if (current?.twoFactorEnabled) {
        return reply.status(409).send({
          success: false,
          error: { code: "2FA_ALREADY_ENABLED", message: "La 2FA est déjà activée" },
        });
      }

      const secret = authenticator.generateSecret();
      const otpauthUrl = authenticator.keyuri(email, TOTP_ISSUER, secret);
      const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

      // Store the pending secret; activation requires a verified code.
      await app.prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret, twoFactorEnabled: false },
      });

      return {
        success: true,
        data: { secret, otpauthUrl, qrDataUrl },
      };
    },
  );

  // POST /auth/2fa/enable — confirm a code, activate 2FA, return backup codes once
  app.post(
    "/auth/2fa/enable",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { totp } = z.object({ totp: z.string().min(6).max(10) }).parse(request.body);

      const user = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true, twoFactorEnabled: true },
      });

      if (!user?.twoFactorSecret) {
        return reply.status(400).send({
          success: false,
          error: { code: "2FA_NOT_INITIALIZED", message: "Lancez d'abord la configuration 2FA" },
        });
      }
      if (user.twoFactorEnabled) {
        return reply.status(409).send({
          success: false,
          error: { code: "2FA_ALREADY_ENABLED", message: "La 2FA est déjà activée" },
        });
      }
      if (!verifyTotp(totp, user.twoFactorSecret)) {
        return reply.status(401).send({
          success: false,
          error: { code: "INVALID_2FA", message: "Code invalide" },
        });
      }

      const { plain, hashed } = generateBackupCodes();
      await app.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true, twoFactorBackupCodes: hashed },
      });

      return {
        success: true,
        data: {
          enabled: true,
          backupCodes: plain,
          message: "2FA activée. Conservez ces codes de secours en lieu sûr — ils ne seront plus affichés.",
        },
      };
    },
  );

  // POST /auth/2fa/disable — requires the account password
  app.post(
    "/auth/2fa/disable",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { password } = z.object({ password: z.string().min(1).max(128) }).parse(request.body);

      const user = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });
      if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
        return reply.status(401).send({
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Mot de passe incorrect" },
        });
      }

      await app.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
      });

      return { success: true, data: { enabled: false } };
    },
  );

  // ── GET /auth/me (cached 30s in Redis per user) ────────
  app.get(
    "/auth/me",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;

      // Check Redis cache first (avoids DB query on every SPA navigation)
      const cacheKey = `session:me:${userId}`;
      try {
        const cached = await app.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch { /* cache miss */ }

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

      const response = { success: true, data: { user } };

      // Cache for 30s — invalidated on profile update, address change, or order
      try {
        await app.redis.set(cacheKey, JSON.stringify(response), "EX", 30);
      } catch { /* non-fatal */ }

      return response;
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

        // Delete customer profile + interactions (T-05 + R3-08 fix)
        await tx.customerInteraction.deleteMany({ where: { customerId: userId } });
        const profile = await tx.customerProfile.findUnique({ where: { userId } });
        if (profile) {
          await tx.loyaltyPoint.deleteMany({ where: { profileId: profile.id } });
          await tx.customerProfile.delete({ where: { userId } });
        }

        // T-05: Delete newsletter subscriptions (RGPD art. 17)
        const userEmail = (await tx.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email;
        if (userEmail) {
          await tx.newsletterSubscriber.deleteMany({ where: { email: userEmail } }).catch(() => {});
        }

        // Delete reviews
        await tx.review.deleteMany({ where: { userId } });

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

    // Bot guard — on failure, behave identically to the generic path so bots
    // get no signal (and no email enumeration).
    const turnstile = await verifyTurnstile(parsed.data.turnstileToken, request.ip);
    if (!turnstile.ok) {
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
