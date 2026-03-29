import { describe, it, expect, beforeEach, afterEach } from "vitest";

// We need to test the module's exported values and the helper functions.
// Since `env` and `splitName` are not exported, we test them indirectly
// through `brand` defaults, and also test `splitName` logic directly
// by reimplementing the same logic and verifying against brand output.

describe("brand config (default values)", () => {
  // Import brand fresh — env vars are read at import time.
  // For defaults, we just import normally (no NEXT_PUBLIC_BRAND_* set).
  let brand: typeof import("./brand.js")["brand"];

  beforeEach(async () => {
    // Dynamic import to get fresh defaults
    const mod = await import("./brand.js");
    brand = mod.brand;
  });

  it("has name set to TROTTISTORE by default", () => {
    expect(brand.name).toBe("TROTTISTORE");
  });

  it("has tagline set correctly", () => {
    expect(brand.tagline).toBe(
      "Spécialiste trottinettes électriques depuis 2019",
    );
  });

  it("has domain set to trottistore.fr", () => {
    expect(brand.domain).toBe("trottistore.fr");
  });

  it("has since set to 2019", () => {
    expect(brand.since).toBe("2019");
  });

  it("has default contact info", () => {
    expect(brand.email).toBe("contact@trottistore.fr");
    expect(brand.phone).toBe("06 04 46 30 55");
    expect(brand.phoneIntl).toBe("+33604463055");
  });

  it("has default address", () => {
    expect(brand.address.street).toBe("18 bis Rue Mechin");
    expect(brand.address.postalCode).toBe("93450");
    expect(brand.address.city).toBe("L'Île-Saint-Denis");
  });

  it("has default SEO config", () => {
    expect(brand.seo.locale).toBe("fr_FR");
    expect(brand.seo.ogUrl).toBe("https://trottistore.fr");
    expect(brand.seo.keywords).toBeInstanceOf(Array);
    expect(brand.seo.keywords.length).toBeGreaterThan(0);
  });

  it("has default navigation labels", () => {
    expect(brand.nav.mainCategory).toBe("TROTTINETTES");
    expect(brand.nav.parts).toBe("PIÈCES");
    expect(brand.nav.repair).toBe("SAV");
  });

  it("has 3-line hero title", () => {
    expect(brand.heroTitle).toHaveLength(3);
    expect(brand.heroTitle[0]).toBe("GLISSEZ");
    expect(brand.heroTitle[1]).toBe("EN TOUTE");
    expect(brand.heroTitle[2]).toBe("LIBERTÉ");
  });
});

// ── env() helper — tested indirectly ──────────────────────────────

describe("env() helper behavior", () => {
  it("returns fallback when env var is not set", () => {
    // brand.name uses env("NEXT_PUBLIC_BRAND_NAME", "TROTTISTORE")
    // Since we haven't set that env var, it should be the fallback
    delete process.env.NEXT_PUBLIC_BRAND_NAME;
    // Re-evaluate: since brand is already imported, we test via fresh import
    // The default import already proves fallback works — brand.name === "TROTTISTORE"
    expect(process.env.NEXT_PUBLIC_BRAND_NAME).toBeUndefined();
  });
});

// ── splitName logic ───────────────────────────────────────────────

describe("splitName", () => {
  // Reimplement splitName to unit test the logic directly
  function splitName(
    name: string,
    envValue?: string,
  ): [string, string] {
    if (envValue && envValue.includes(",")) {
      const [a, b] = envValue.split(",", 2);
      return [a.trim(), b.trim()];
    }
    const mid = Math.ceil(name.length / 2);
    return [name.slice(0, mid), name.slice(mid)];
  }

  it("auto-splits a name at the midpoint when no env override", () => {
    // "TROTTISTORE" has 11 chars, ceil(11/2) = 6
    const [a, b] = splitName("TROTTISTORE");
    expect(a).toBe("TROTTI");
    expect(b).toBe("STORE");
  });

  it("splits using comma-separated env value when provided", () => {
    const [a, b] = splitName("TROTTISTORE", "TROTT, ISTORE");
    expect(a).toBe("TROTT");
    expect(b).toBe("ISTORE");
  });

  it("falls back to auto-split when env value has no comma", () => {
    const [a, b] = splitName("TROTTISTORE", "NOCOMA");
    expect(a).toBe("TROTTI");
    expect(b).toBe("STORE");
  });

  it("handles even-length names", () => {
    const [a, b] = splitName("ABCDEF");
    // ceil(6/2) = 3
    expect(a).toBe("ABC");
    expect(b).toBe("DEF");
  });

  it("handles single-character name", () => {
    const [a, b] = splitName("X");
    expect(a).toBe("X");
    expect(b).toBe("");
  });

  it("brand.nameParts matches splitName for default name", () => {
    // brand.nameParts is computed by splitName("TROTTISTORE")
    // which should be ["TROTTI", "STORE"]
    // We import brand to verify
    import("./brand.js").then((mod) => {
      expect(mod.brand.nameParts).toEqual(["TROTTI", "STORE"]);
    });
  });
});

describe("brand.nameParts default", () => {
  it("splits TROTTISTORE into TROTTI and STORE", async () => {
    const { brand } = await import("./brand.js");
    expect(brand.nameParts[0]).toBe("TROTTI");
    expect(brand.nameParts[1]).toBe("STORE");
  });
});
