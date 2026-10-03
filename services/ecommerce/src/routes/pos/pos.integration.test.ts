import { mockActiveAuthUsers } from "../../../../../tests/helpers/auth-users.js";
/**
 * Caisse (POS) — counter sales share one stock with the web shop, are paid on
 * the spot and attached to the open register session.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { posRoutes } from "./index.js";

const VARIANT_ID = "00000000-0000-0000-0000-000000000040";
const SESSION_ID = "00000000-0000-0000-0000-000000000050";
const WALK_IN_ID = "00000000-0000-0000-0000-000000000060";

const variant = {
  id: VARIANT_ID,
  sku: "XIA-PRO2-BLK",
  name: "Noir",
  barcode: "3760000000017",
  priceOverride: null,
  stockQuantity: 5,
  stockReserved: 1,
  isActive: true,
  product: { id: "00000000-0000-0000-0000-000000000041", name: "Xiaomi Pro 2", priceHt: "400.00", tvaRate: "20.00", status: "ACTIVE", slug: "xiaomi-pro-2" },
};

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";
  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    posSession: {
      findFirst: vi.fn().mockResolvedValue({ id: SESSION_ID, status: "OPEN", openingCashCents: 15000, note: null }),
      create: vi.fn().mockResolvedValue({ id: SESSION_ID, status: "OPEN", openingCashCents: 15000 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: SESSION_ID, status: "CLOSED", openingCashCents: 15000, closingCashCents: 60000, expectedCashCents: 63000 }),
    },
    productVariant: {
      findFirst: vi.fn().mockResolvedValue(variant),
      findMany: vi.fn().mockResolvedValue([variant]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: WALK_IN_ID }),
      create: vi.fn().mockResolvedValue({ id: WALK_IN_ID }),
    },
    order: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "order-1", orderNumber: 101, ...data, items: [] })),
      findMany: vi.fn().mockResolvedValue([]),
    },
    payment: {
      create: vi.fn().mockResolvedValue({ id: "pay-1" }),
      findMany: vi.fn().mockResolvedValue([{ amount: "480.00", method: "CASH" }]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    financialLedger: { create: vi.fn().mockResolvedValue({ id: "ledger-1" }) },
    stockMovement: { create: vi.fn().mockResolvedValue({ id: "mv-1" }) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(app.prisma)),
  });
  app.decorate("redis", { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue("OK"), del: vi.fn().mockResolvedValue(1) });

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    const statusCode = isZodError ? 400 : error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: { code: isZodError ? "VALIDATION_ERROR" : statusCode < 500 && error.code ? error.code : "REQUEST_ERROR", message: error.message },
    });
  });
  return app;
}

const token = (app: FastifyInstance, role = "STAFF") =>
  app.jwt.sign({ tokenVersion: 0, sub: "staff-1", email: "staff@test.com", role });

describe("POS routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    mockActiveAuthUsers(app);
    await app.register(authPlugin);
    await app.register(posRoutes, { prefix: "/api/v1" });
    await app.ready();
  });
  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("rejects CLIENT and TECHNICIAN", async () => {
    for (const role of ["CLIENT", "TECHNICIAN"]) {
      const res = await app.inject({ method: "GET", url: "/api/v1/admin/pos/session", headers: { authorization: `Bearer ${token(app, role)}` } });
      expect(res.statusCode).toBe(403);
    }
  });

  it("opens a register once (second open → 409)", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/admin/pos/session/open",
      headers: { authorization: `Bearer ${token(app)}` }, payload: { openingCashCents: 15000 },
    });
    expect(res.statusCode).toBe(201);
    (app.prisma.posSession.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ code: "P2002" });
    const again = await app.inject({
      method: "POST", url: "/api/v1/admin/pos/session/open",
      headers: { authorization: `Bearer ${token(app)}` }, payload: { openingCashCents: 1 },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe("SESSION_ALREADY_OPEN");
  });

  it("lookup matches an exact barcode first", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/pos/lookup?q=3760000000017", headers: { authorization: `Bearer ${token(app)}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data[0]).toMatchObject({ sku: "XIA-PRO2-BLK", unitPriceHt: 400, tvaRate: 20, available: 4, exactMatch: true });
  });

  it("records a cash sale: DELIVERED/PAID order on channel STORE, stock guard, payment, ledger, movement, change", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/admin/pos/sales",
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ variantId: VARIANT_ID, quantity: 2 }], paymentMethod: "CASH", cashReceivedCents: 100000 },
    });
    expect(res.statusCode).toBe(201);
    const { order, receipt } = res.json().data;
    // 2 × 400 HT = 800 HT, 160 TVA, 960 TTC
    expect(receipt).toMatchObject({ subtotalHt: 800, tvaAmount: 160, totalTtc: 960, changeCents: 4000 });
    expect(order).toMatchObject({ channel: "STORE", status: "DELIVERED", paymentStatus: "PAID", posSessionId: SESSION_ID, customerId: WALK_IN_ID });
    // Same atomic guard as the web checkout: quantity + reserved must fit in stockQuantity
    expect(app.prisma.productVariant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: VARIANT_ID, stockQuantity: { gte: 3 }, stockReserved: 1 } }),
    );
    expect(app.prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ provider: "pos", method: "CASH", status: "CONFIRMED" }) }));
    expect(app.prisma.financialLedger.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operation: "CHARGE", amountCents: 96000 }) }));
    expect(app.prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "OUT_SALE", quantity: -2, stockBefore: 5, stockAfter: 3 }) }),
    );
  });

  it("applies a whole-ticket discount proportionally to VAT", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/admin/pos/sales",
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ variantId: VARIANT_ID, quantity: 1 }], paymentMethod: "CARD_TERMINAL", discountHt: 50 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.receipt).toMatchObject({ subtotalHt: 350, tvaAmount: 70, totalTtc: 420, discountHt: 50, changeCents: null });
  });

  it("refuses the sale when stock is insufficient and when cash received is short", async () => {
    (app.prisma.productVariant.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ count: 0 });
    const short = await app.inject({
      method: "POST", url: "/api/v1/admin/pos/sales",
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ variantId: VARIANT_ID, quantity: 9 }], paymentMethod: "CASH" },
    });
    expect(short.statusCode).toBe(409);
    expect(short.json().error.code).toBe("INSUFFICIENT_STOCK");
    expect(app.prisma.order.create).not.toHaveBeenCalled();

    const cash = await app.inject({
      method: "POST", url: "/api/v1/admin/pos/sales",
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ variantId: VARIANT_ID, quantity: 1 }], paymentMethod: "CASH", cashReceivedCents: 100 },
    });
    expect(cash.statusCode).toBe(400);
    expect(cash.json().error.code).toBe("CASH_INSUFFICIENT");
  });

  it("refuses a sale when no register is open", async () => {
    (app.prisma.posSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await app.inject({
      method: "POST", url: "/api/v1/admin/pos/sales",
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { items: [{ variantId: VARIANT_ID, quantity: 1 }], paymentMethod: "CASH" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("NO_OPEN_SESSION");
  });

  it("closes the register with expected cash = opening + cash sales and reports the difference", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/admin/pos/session/close",
      headers: { authorization: `Bearer ${token(app)}` }, payload: { closingCashCents: 60000 },
    });
    expect(res.statusCode).toBe(200);
    // expected = 150.00 + 480.00 cash = 630.00 → counted 600.00 → −30.00
    expect(app.prisma.posSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SESSION_ID, status: "OPEN" }, data: expect.objectContaining({ status: "CLOSED", expectedCashCents: 63000, closingCashCents: 60000 }) }),
    );
    expect(res.json().data.differenceCents).toBe(-3000);
  });
});
