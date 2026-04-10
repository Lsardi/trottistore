/**
 * Unit tests for the shared notifications package.
 *
 * Tests cover: email sending (SMTP/Brevo fallback), SMS sending,
 * phone normalization, and transport error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizePhone } from "./sms.js";

// ---------------------------------------------------------------------------
// Phone normalization (pure function, no mocks needed)
// ---------------------------------------------------------------------------

describe("normalizePhone", () => {
  it("normalizes French mobile starting with 0", () => {
    expect(normalizePhone("0612345678")).toBe("+33612345678");
  });

  it("normalizes with spaces and dashes", () => {
    expect(normalizePhone("06 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("06-12-34-56-78")).toBe("+33612345678");
    expect(normalizePhone("06.12.34.56.78")).toBe("+33612345678");
  });

  it("passes through E.164 format unchanged", () => {
    expect(normalizePhone("+33612345678")).toBe("+33612345678");
  });

  it("normalizes without leading +", () => {
    expect(normalizePhone("33612345678")).toBe("+33612345678");
  });

  it("returns null for invalid phone numbers", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("abcdef")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("handles parentheses in phone numbers", () => {
    expect(normalizePhone("(06) 12 34 56 78")).toBe("+33612345678");
  });

  it("handles international numbers with +", () => {
    expect(normalizePhone("+1234567890")).toBe("+1234567890");
  });
});

// ---------------------------------------------------------------------------
// Transport layer (mocked)
// ---------------------------------------------------------------------------

describe("sendViaSmtp", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns false when SMTP_HOST is not set", async () => {
    delete process.env.SMTP_HOST;
    const { sendViaSmtp } = await import("./transport.js");
    const result = await sendViaSmtp(
      "TrottiStore <test@test.com>",
      "recipient@test.com",
      "Subject",
      { html: "<p>Test</p>" },
    );
    expect(result).toBe(false);
  });
});

describe("brevoFetch", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns false when BREVO_API_KEY is not set", async () => {
    delete process.env.BREVO_API_KEY;
    const { brevoFetch } = await import("./transport.js");
    const result = await brevoFetch("/smtp/email", { test: true });
    expect(result).toBe(false);
  });

  it("calls Brevo API when key is set", async () => {
    process.env.BREVO_API_KEY = "test-key";
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const { brevoFetch } = await import("./transport.js");
    const result = await brevoFetch("/smtp/email", { to: "test@test.com" });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "api-key": "test-key" }),
      }),
    );
  });

  it("returns false on Brevo API error", async () => {
    process.env.BREVO_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve("Bad Request") }));

    const { brevoFetch } = await import("./transport.js");
    const result = await brevoFetch("/smtp/email", {});
    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
    process.env.BREVO_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const { brevoFetch } = await import("./transport.js");
    const result = await brevoFetch("/smtp/email", {});
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sendEmail (high-level, SMTP → Brevo fallback)
// ---------------------------------------------------------------------------

describe("sendEmail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    delete process.env.BREVO_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns false when no transport is configured", async () => {
    const { sendEmail } = await import("./email.js");
    const result = await sendEmail("to@test.com", "Subject", "<p>Hi</p>");
    expect(result).toBe(false);
  });

  it("falls back to Brevo when SMTP is not available", async () => {
    process.env.BREVO_API_KEY = "test-key";
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const { sendEmail } = await import("./email.js");
    const result = await sendEmail("to@test.com", "Subject", "<p>Hi</p>");

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("accepts custom sender options", async () => {
    process.env.BREVO_API_KEY = "test-key";
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const { sendEmail } = await import("./email.js");
    await sendEmail("to@test.com", "Subject", "<p>Hi</p>", {
      senderName: "SAV TrottiStore",
      senderEmail: "sav@trottistore.fr",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sender.name).toBe("SAV TrottiStore");
    expect(body.sender.email).toBe("sav@trottistore.fr");
  });
});

// ---------------------------------------------------------------------------
// sendSms
// ---------------------------------------------------------------------------

describe("sendSms", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns false for invalid phone number", async () => {
    const { sendSms } = await import("./sms.js");
    const result = await sendSms("invalid", "Test message");
    expect(result).toBe(false);
  });

  it("logs to console in dev mode (no API key)", async () => {
    delete process.env.BREVO_API_KEY;
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { sendSms } = await import("./sms.js");
    const result = await sendSms("0612345678", "Test message");

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("+33612345678"),
    );
  });

  it("sends via Brevo when API key is set", async () => {
    process.env.BREVO_API_KEY = "test-key";
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const { sendSms } = await import("./sms.js");
    const result = await sendSms("0612345678", "Test message");

    expect(result).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.recipient).toBe("+33612345678");
    expect(body.content).toBe("Test message");
    expect(body.type).toBe("transactional");
  });
});
