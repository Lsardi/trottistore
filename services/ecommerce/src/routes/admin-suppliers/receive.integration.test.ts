import { mockActiveAuthUsers } from "../../../../../tests/helpers/auth-users.js";
/**
 * Réception fournisseur: each received line increments stock, writes an
 * IN_PURCHASE movement and moves the PO to PARTIAL / RECEIVED.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { adminSupplierRoutes } from "./index.js";

const PO_ID = "00000000-0000-0000-0000-000000000070";
const V1 = "00000000-0000-0000-0000-000000000071";
const V2 = "00000000-0000-0000-0000-000000000072";

function po(items: Array<{ variantId: string; quantityOrdered: number; quantityReceived: number }>, status = "SENT") {
  return {
    id: PO_ID,
    reference: "PO-2026-00001",
    status,
    receivedAt: null,
    items: items.map((i, idx) => ({ id: `item-${idx}`, purchaseOrderId: PO_ID, ...i })),
  };
}

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";
  const app = Fastify({ logger: false });
  app.decorate("prisma", {
    purchaseOrder: {
      findUnique: vi.fn(),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: PO_ID, ...data, items: [] })),
    },
    purchaseOrderItem: {
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    productVariant: {
      update: vi.fn().mockImplementation(async ({ data }: { data: { stockQuantity: { increment: number } } }) => ({ stockQuantity: 2 + data.stockQuantity.increment })),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    stockMovement: { create: vi.fn().mockResolvedValue({ id: "mv-1" }) },
    stockAlert: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(app.prisma)),
  });
  app.decorate("redis", { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue("OK"), del: vi.fn().mockResolvedValue(1) });
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const isZodError = error instanceof ZodError;
    reply.status(isZodError ? 400 : error.statusCode || 500).send({ success: false, error: { code: isZodError ? "VALIDATION_ERROR" : "REQUEST_ERROR", message: error.message } });
  });
  return app;
}

const token = (app: FastifyInstance, role = "MANAGER") => app.jwt.sign({ tokenVersion: 0, sub: "mgr-1", email: "mgr@test.com", role });

describe("POST /admin/purchase-orders/:id/receive", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = buildApp();
    mockActiveAuthUsers(app);
    await app.register(authPlugin);
    await app.register(adminSupplierRoutes, { prefix: "/api/v1" });
    await app.ready();
  });
  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("partial receipt: increments stock, writes IN_PURCHASE, PO becomes PARTIAL", async () => {
    (app.prisma.purchaseOrder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(po([{ variantId: V1, quantityOrdered: 5, quantityReceived: 0 }]));
    (app.prisma.purchaseOrderItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ variantId: V1, quantityOrdered: 5, quantityReceived: 3 }]);

    const res = await app.inject({
      method: "POST", url: `/api/v1/admin/purchase-orders/${PO_ID}/receive`,
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { lines: [{ variantId: V1, quantityReceived: 3 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.received[0]).toMatchObject({ variantId: V1, quantity: 3, stockAfter: 5, overReceived: false });
    expect(app.prisma.productVariant.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: V1 }, data: { stockQuantity: { increment: 3 } } }));
    expect(app.prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "IN_PURCHASE", quantity: 3, referenceType: "PURCHASE_ORDER", referenceId: PO_ID, stockBefore: 2, stockAfter: 5 }) }),
    );
    expect(app.prisma.purchaseOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PARTIAL" }) }));
  });

  it("final receipt: PO becomes RECEIVED with receivedAt; over-receipt is flagged", async () => {
    (app.prisma.purchaseOrder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      po([{ variantId: V1, quantityOrdered: 5, quantityReceived: 3 }, { variantId: V2, quantityOrdered: 1, quantityReceived: 0 }], "PARTIAL"),
    );
    (app.prisma.purchaseOrderItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { variantId: V1, quantityOrdered: 5, quantityReceived: 5 },
      { variantId: V2, quantityOrdered: 1, quantityReceived: 2 },
    ]);

    const res = await app.inject({
      method: "POST", url: `/api/v1/admin/purchase-orders/${PO_ID}/receive`,
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { lines: [{ variantId: V1, quantityReceived: 2 }, { variantId: V2, quantityReceived: 2 }] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.received.map((r: { overReceived: boolean }) => r.overReceived)).toEqual([false, true]);
    const update = (app.prisma.purchaseOrder.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(update.data.status).toBe("RECEIVED");
    expect(update.data.receivedAt).toBeInstanceOf(Date);
  });

  it("rejects lines not on the PO and receipts on a closed PO", async () => {
    (app.prisma.purchaseOrder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(po([{ variantId: V1, quantityOrdered: 5, quantityReceived: 0 }]));
    const wrong = await app.inject({
      method: "POST", url: `/api/v1/admin/purchase-orders/${PO_ID}/receive`,
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { lines: [{ variantId: V2, quantityReceived: 1 }] },
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error.code).toBe("LINE_NOT_ON_PO");
    expect(app.prisma.productVariant.update).not.toHaveBeenCalled();

    (app.prisma.purchaseOrder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(po([{ variantId: V1, quantityOrdered: 5, quantityReceived: 5 }], "RECEIVED"));
    const closed = await app.inject({
      method: "POST", url: `/api/v1/admin/purchase-orders/${PO_ID}/receive`,
      headers: { authorization: `Bearer ${token(app)}` },
      payload: { lines: [{ variantId: V1, quantityReceived: 1 }] },
    });
    expect(closed.statusCode).toBe(409);
    expect(closed.json().error.code).toBe("PO_CLOSED");
  });

  it("is restricted to managers and above", async () => {
    const res = await app.inject({
      method: "POST", url: `/api/v1/admin/purchase-orders/${PO_ID}/receive`,
      headers: { authorization: `Bearer ${token(app, "STAFF")}` },
      payload: { lines: [{ variantId: V1, quantityReceived: 1 }] },
    });
    expect(res.statusCode).toBe(403);
  });
});
