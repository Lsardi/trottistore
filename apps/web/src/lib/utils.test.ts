import { describe, it, expect } from "vitest";
import { formatPrice, formatPriceTTC, priceTTC } from "./utils.js";

// ── formatPrice ───────────────────────────────────────────────────

describe("formatPrice", () => {
  it("formats a number as EUR in fr-FR locale", () => {
    const result = formatPrice(100);
    // Should contain "100" and the euro symbol
    expect(result).toContain("100");
    expect(result).toMatch(/€/);
  });

  it("formats a string amount", () => {
    const result = formatPrice("49.99");
    expect(result).toContain("49,99");
    expect(result).toMatch(/€/);
  });

  it("formats zero correctly", () => {
    const result = formatPrice(0);
    expect(result).toContain("0");
    expect(result).toMatch(/€/);
  });

  it("formats large numbers with grouping", () => {
    const result = formatPrice(1234.56);
    // fr-FR uses narrow no-break space or regular space for thousands
    expect(result).toMatch(/1[\s\u00a0\u202f]?234,56/);
  });
});

// ── priceTTC ──────────────────────────────────────────────────────

describe("priceTTC", () => {
  it("applies 20% TVA by default", () => {
    expect(priceTTC(100)).toBeCloseTo(120);
  });

  it("applies a custom TVA rate", () => {
    expect(priceTTC(100, 5.5)).toBeCloseTo(105.5);
  });

  it("accepts string inputs", () => {
    expect(priceTTC("200", "10")).toBeCloseTo(220);
  });

  it("handles zero price", () => {
    expect(priceTTC(0)).toBe(0);
  });

  it("handles zero TVA rate", () => {
    expect(priceTTC(100, 0)).toBe(100);
  });
});

// ── formatPriceTTC ────────────────────────────────────────────────

describe("formatPriceTTC", () => {
  it("returns a formatted TTC price with default 20% TVA", () => {
    const result = formatPriceTTC(100);
    // 100 * 1.20 = 120,00 EUR
    expect(result).toContain("120");
    expect(result).toMatch(/€/);
  });

  it("uses a custom TVA rate", () => {
    const result = formatPriceTTC(100, 5.5);
    // 100 * 1.055 = 105,50
    expect(result).toContain("105,50");
  });

  it("handles string inputs", () => {
    const result = formatPriceTTC("50", "20");
    // 50 * 1.20 = 60
    expect(result).toContain("60");
    expect(result).toMatch(/€/);
  });
});
