/**
 * Integration tests for password reset flow.
 *
 * Covers: forgot-password (email enumeration prevention),
 * reset-password (valid token, expired token, used token, invalid token).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { authRoutes } from "./index.js";

// Mock the shared notifications module
vi.mock("@trottistore/shared/notifications", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    passwordResetToken: {
      create: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    customerProfile: {
      create: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === "function") return arg(app.prisma);
      return Promise.all(arg);
    }),
  });

  app.decorate("redis", {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    xadd: vi.fn().mockResolvedValue("1-0"),
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    const statusCode = isZodError ? 400 : error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR",
        message: error.message,
      },
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Password reset flow", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(authRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // POST /auth/forgot-password
  // -----------------------------------------------------------------------

  describe("POST /auth/forgot-password", () => {
    it("returns 200 even when email does not exist (prevents enumeration)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: { email: "unknown@example.com" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      // Should NOT have created a token
      expect(app.prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it("creates token and sends email for existing user", async () => {
      (app.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "user-1",
        firstName: "Alice",
        email: "alice@example.com",
        status: "ACTIVE",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: { email: "alice@example.com" },
      });

      expect(res.statusCode).toBe(200);
      expect(app.prisma.passwordResetToken.create).toHaveBeenCalledOnce();
      // Invalidate old tokens
      expect(app.prisma.passwordResetToken.updateMany).toHaveBeenCalledOnce();
    });

    it("does not send email for inactive user", async () => {
      (app.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "user-2",
        firstName: "Bob",
        email: "bob@example.com",
        status: "INACTIVE",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: { email: "bob@example.com" },
      });

      expect(res.statusCode).toBe(200);
      expect(app.prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it("returns 200 with invalid email format (no error leak)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: { email: "not-an-email" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // POST /auth/reset-password
  // -----------------------------------------------------------------------

  describe("POST /auth/reset-password", () => {
    it("resets password with valid token", async () => {
      const rawToken = "valid-reset-token-uuid";

      (app.prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "reset-1",
        userId: "user-1",
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 3600000), // 1h from now
        usedAt: null,
        user: { id: "user-1", status: "ACTIVE" },
      });
      // Atomic claim succeeds: token was unused, updateMany marks it used.
      (app.prisma.passwordResetToken.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ count: 1 });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: rawToken, newPassword: "NewSecure1!" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      // Should atomically claim the token via updateMany, then update the
      // user password, then revoke refresh tokens.
      expect(app.prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "reset-1", usedAt: null },
          data: { usedAt: expect.any(Date) },
        }),
      );
      expect(app.prisma.user.update).toHaveBeenCalledOnce();
      expect(app.prisma.refreshToken.updateMany).toHaveBeenCalledOnce();
    });

    // Security regression for AUDIT_ATOMIC.md#P1-5:
    // Two concurrent /reset-password requests with the same token must
    // not both succeed. The previous implementation read usedAt, branched
    // on it, then wrote — racy. The fix uses an atomic updateMany guarded
    // by usedAt: null, and rejects the caller whose updateMany returns 0.
    it("rejects concurrent reuse — second request loses the atomic claim (400 TOKEN_USED)", async () => {
      const rawToken = "race-token-uuid";
      (app.prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "reset-race",
        userId: "user-1",
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null, // still unused at read time
        user: { id: "user-1", status: "ACTIVE" },
      });
      // The first (concurrent) request already claimed the token between
      // our findUnique and our updateMany, so the atomic claim now finds
      // zero rows matching { id, usedAt: null } and returns count: 0.
      (app.prisma.passwordResetToken.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ count: 0 });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: rawToken, newPassword: "LoserPass9!" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("TOKEN_USED");
      // The user password MUST NOT have been overwritten by the loser.
      expect(app.prisma.user.update).not.toHaveBeenCalled();
      // Refresh tokens must NOT have been revoked either.
      expect(app.prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: "invalid-token", newPassword: "NewSecure1!" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("INVALID_TOKEN");
    });

    it("returns 400 for already used token", async () => {
      (app.prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "reset-2",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(), // Already used
        user: { id: "user-1", status: "ACTIVE" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: "used-token", newPassword: "NewSecure1!" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("TOKEN_USED");
    });

    it("returns 400 for expired token", async () => {
      (app.prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "reset-3",
        userId: "user-1",
        expiresAt: new Date(Date.now() - 1000), // Expired
        usedAt: null,
        user: { id: "user-1", status: "ACTIVE" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: "expired-token", newPassword: "NewSecure1!" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("TOKEN_EXPIRED");
    });

    it("returns 400 with short password", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: "some-token", newPassword: "short" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for inactive account", async () => {
      (app.prisma.passwordResetToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "reset-4",
        userId: "user-2",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: { id: "user-2", status: "INACTIVE" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: "inactive-token", newPassword: "NewSecure1!" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("ACCOUNT_INACTIVE");
    });
  });
});
