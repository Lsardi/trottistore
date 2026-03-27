import { describe, it, expect } from "vitest";
import { z } from "zod";
import bcrypt from "bcryptjs";

// ── Reproduce the validation schemas from the auth route ──────────

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

// ── Registration validation ───────────────────────────────────────

describe("registerSchema", () => {
  const validPayload = {
    email: "alice@example.com",
    password: "secureP@ss1",
    firstName: "Alice",
    lastName: "Dupont",
  };

  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts a payload with an optional phone", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      phone: "06 12 34 56 78",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("06 12 34 56 78");
    }
  });

  it("rejects when email is missing", () => {
    const { email, ...rest } = validPayload;
    const result = registerSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email format", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.issues.find(
        (i) => i.path[0] === "email",
      );
      expect(emailError).toBeDefined();
    }
  });

  it("lowercases and trims email", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      email: "  Alice@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("alice@example.com");
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwError = result.error.issues.find(
        (i) => i.path[0] === "password",
      );
      expect(pwError).toBeDefined();
      expect(pwError!.message).toContain("8");
    }
  });

  it("rejects a password longer than 128 characters", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      password: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("rejects when firstName is missing", () => {
    const { firstName, ...rest } = validPayload;
    const result = registerSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when lastName is missing", () => {
    const { lastName, ...rest } = validPayload;
    const result = registerSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty firstName", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      firstName: "",
    });
    expect(result.success).toBe(false);
  });
});

// ── Login validation ──────────────────────────────────────────────

describe("loginSchema", () => {
  it("accepts a valid login payload", () => {
    const result = loginSchema.safeParse({
      email: "alice@example.com",
      password: "secureP@ss1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when email is missing", () => {
    const result = loginSchema.safeParse({ password: "secureP@ss1" });
    expect(result.success).toBe(false);
  });

  it("rejects when password is missing", () => {
    const result = loginSchema.safeParse({ email: "alice@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "alice@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "bad",
      password: "secureP@ss1",
    });
    expect(result.success).toBe(false);
  });

  it("lowercases and trims email", () => {
    const result = loginSchema.safeParse({
      email: " Bob@Example.COM ",
      password: "secureP@ss1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("bob@example.com");
    }
  });
});

// ── Password hashing (bcrypt) ─────────────────────────────────────

describe("password hashing with bcrypt", () => {
  const BCRYPT_ROUNDS = 12;
  const password = "SuperSecret123!";

  it("hashes a password with bcrypt", async () => {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    // bcrypt hashes start with $2a$ or $2b$
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const valid = await bcrypt.compare(password, hash);
    expect(valid).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const valid = await bcrypt.compare("WrongPassword!", hash);
    expect(valid).toBe(false);
  });

  it("produces different hashes for the same password (salted)", async () => {
    const hash1 = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const hash2 = await bcrypt.hash(password, BCRYPT_ROUNDS);
    expect(hash1).not.toBe(hash2);
  });
});
