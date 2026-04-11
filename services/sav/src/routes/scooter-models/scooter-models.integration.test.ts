/**
 * Integration tests for the public scooter-models aggregation route.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { scooterModelsRoutes, parseProductModel } from "./index.js";

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorate("prisma", {
    repairTicket: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as FastifyInstance["prisma"]);
  return app;
}

describe("Scooter models route", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(scooterModelsRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/v1/repairs/scooter-models", () => {
    it("returns empty array when no tickets", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/repairs/scooter-models" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true, data: [] });
    });

    it("groups distinct productModel by brand", async () => {
      (app.prisma.repairTicket.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { productModel: "Dualtron Thunder 2" },
        { productModel: "Dualtron Mini" },
        { productModel: "Xiaomi M365 Pro" },
        { productModel: "Xiaomi M365" },
        { productModel: "Ninebot Max G30" },
      ]);

      const res = await app.inject({ method: "GET", url: "/api/v1/repairs/scooter-models" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);

      const dualtron = body.data.find((b: { brand: string }) => b.brand === "Dualtron");
      expect(dualtron.models).toEqual(["Mini", "Thunder 2"]); // sorted
      const xiaomi = body.data.find((b: { brand: string }) => b.brand === "Xiaomi");
      expect(xiaomi.models).toEqual(["M365", "M365 Pro"]);
      const ninebot = body.data.find((b: { brand: string }) => b.brand === "Ninebot");
      expect(ninebot.models).toEqual(["Max G30"]);
    });

    it("normalizes case while preserving alnum tokens like M365", async () => {
      (app.prisma.repairTicket.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { productModel: "DUALTRON thunder 2" },
        { productModel: "xiaomi M365" },
      ]);

      const res = await app.inject({ method: "GET", url: "/api/v1/repairs/scooter-models" });
      const body = res.json();
      const brands = body.data.map((b: { brand: string }) => b.brand);
      expect(brands).toContain("Dualtron");
      expect(brands).toContain("Xiaomi");
      const xiaomi = body.data.find((b: { brand: string }) => b.brand === "Xiaomi");
      expect(xiaomi.models).toContain("M365"); // alnum token preserved
    });

    it("returns brands sorted alphabetically", async () => {
      (app.prisma.repairTicket.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { productModel: "Vsett 10+" },
        { productModel: "Dualtron Thunder" },
        { productModel: "Kaabo Mantis 10" },
      ]);

      const res = await app.inject({ method: "GET", url: "/api/v1/repairs/scooter-models" });
      const brands = res.json().data.map((b: { brand: string }) => b.brand);
      expect(brands).toEqual(["Dualtron", "Kaabo", "Vsett"]);
    });

    it("filters out brand-only entries with no model", async () => {
      (app.prisma.repairTicket.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { productModel: "Dualtron" }, // single token, no model
        { productModel: "Xiaomi M365" },
      ]);

      const res = await app.inject({ method: "GET", url: "/api/v1/repairs/scooter-models" });
      const brands = res.json().data.map((b: { brand: string }) => b.brand);
      expect(brands).not.toContain("Dualtron"); // filtered (no models)
      expect(brands).toContain("Xiaomi");
    });

    it("sets a public 5min Cache-Control header", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/repairs/scooter-models" });
      expect(res.headers["cache-control"]).toContain("max-age=300");
    });
  });

  describe("parseProductModel helper", () => {
    it("returns null for empty input", () => {
      expect(parseProductModel("")).toBeNull();
      expect(parseProductModel("   ")).toBeNull();
    });

    it("splits brand and model on first whitespace", () => {
      expect(parseProductModel("Dualtron Thunder 2")).toEqual({ brand: "Dualtron", model: "Thunder 2" });
    });

    it("returns brand only with empty model for single token", () => {
      expect(parseProductModel("Dualtron")).toEqual({ brand: "Dualtron", model: "" });
    });
  });
});
