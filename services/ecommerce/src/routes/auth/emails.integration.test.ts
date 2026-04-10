/**
 * Integration tests verifying that emails are ACTUALLY sent (sendEmail called
 * with correct arguments) for: registration, forgot-password.
 *
 * We mock sendEmail at the module level and assert it was called with
 * the expected recipient, subject pattern, and HTML content.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { authRoutes } from "./index.js";

// Mock sendEmail — capture all calls
const mockSendEmail = vi.fn().mockResolvedValue(true);
vi.mock("@trottistore/shared/notifications", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  const mockBcryptHash = "$2a$12$fakehashfakehashfakehashfakehashfakehashfakehashfake";

  app.decorate("prisma", {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        id: "new-user-1",
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        createdAt: new Date(),
      })),
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
      error: { code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR", message: error.message },
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Email sending verification", () => {
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

  describe("Registration → Welcome email", () => {
    it("sends welcome email to newly registered user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email: "alice@example.com",
          password: "SecurePass1!",
          firstName: "Alice",
          lastName: "Dupont",
        },
      });

      expect(res.statusCode).toBe(201);

      // Wait for non-blocking email to be called
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSendEmail).toHaveBeenCalledOnce();
      const [to, subject, html] = mockSendEmail.mock.calls[0];
      expect(to).toBe("alice@example.com");
      expect(subject).toContain("Bienvenue");
      expect(html).toContain("Alice");
      expect(html).toContain("CATALOGUE");
    });
  });

  describe("Forgot password → Reset email", () => {
    it("sends password reset email with valid link", async () => {
      // Mock user exists
      (app.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "user-1",
        firstName: "Bob",
        email: "bob@example.com",
        status: "ACTIVE",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: { email: "bob@example.com" },
      });

      expect(res.statusCode).toBe(200);

      // Wait for non-blocking email
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSendEmail).toHaveBeenCalledOnce();
      const [to, subject, html] = mockSendEmail.mock.calls[0];
      expect(to).toBe("bob@example.com");
      expect(subject).toContain("Réinitialisation");
      expect(html).toContain("Bob");
      expect(html).toContain("/reset-password?token=");
    });

    it("does NOT send email for unknown user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: { email: "unknown@example.com" },
      });

      expect(res.statusCode).toBe(200); // Always 200 (enumeration prevention)

      await new Promise((r) => setTimeout(r, 50));

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});
