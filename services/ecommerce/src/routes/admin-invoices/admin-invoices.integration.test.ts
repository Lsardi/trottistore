/**
 * Integration tests for invoice PDF generation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { authPlugin } from "../../plugins/auth.js";
import { invoiceRoutes } from "./index.js";

const ORDER_FIXTURE = {
  id: "order-1",
  orderNumber: 1042,
  customerId: "user-1",
  status: "CONFIRMED",
  paymentMethod: "CARD",
  shippingAddress: { street: "18 rue Méchin", postalCode: "93450", city: "L'Île-Saint-Denis" },
  billingAddress: {},
  subtotalHt: 399,
  tvaAmount: 79.8,
  shippingCost: 0,
  totalTtc: 478.8,
  createdAt: new Date(),
  customer: { firstName: "Alice", lastName: "Dupont", email: "alice@test.com", phone: "0612345678" },
  items: [
    {
      quantity: 1,
      unitPriceHt: 399,
      totalHt: 399,
      tvaRate: 20,
      product: { name: "Xiaomi Pro 2", sku: "XP2" },
      variant: { name: "Default", sku: "XP2-D" },
    },
  ],
};

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    order: {
      findUnique: vi.fn().mockResolvedValue(ORDER_FIXTURE),
    },
  });

  app.decorate("redis", { get: vi.fn(), set: vi.fn(), del: vi.fn() });

  return app;
}

async function signToken(app: FastifyInstance, role = "ADMIN"): Promise<string> {
  return app.jwt.sign({ sub: "admin-1", email: "admin@test.com", role });
}

describe("Invoice routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(invoiceRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("GET /admin/orders/:id/invoice returns PDF", async () => {
    const token = await signToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/orders/order-1/invoice",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("facture-1042");
    // PDF starts with %PDF
    expect(res.rawPayload.toString().substring(0, 4)).toBe("%PDF");
  });

  it("returns 404 for unknown order", async () => {
    const token = await signToken(app);
    (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/orders/unknown/invoice",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for CLIENT", async () => {
    const token = await signToken(app, "CLIENT");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/orders/order-1/invoice",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
