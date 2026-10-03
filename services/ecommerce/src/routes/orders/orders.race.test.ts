import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { Decimal } from "@prisma/client/runtime/library";
import { orderRoutes } from "./index.js";

vi.mock("@trottistore/shared/notifications", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

const USER_ID = "00000000-0000-0000-0000-000000000001";
const CUSTOMER_ID = "00000000-0000-0000-0000-000000000002";
const SHIPPING_ADDRESS_ID = "00000000-0000-0000-0000-000000000010";
const PRODUCT_ID = "00000000-0000-0000-0000-000000000020";
const VARIANT_ID = "00000000-0000-0000-0000-000000000030";

type UserRole = "CLIENT" | "ADMIN";

function buildRaceApp(role: UserRole, stock: { quantity: number }): FastifyInstance {
  const app = Fastify({ logger: false });
  let orderCounter = 1000;

  app.decorateRequest("user", null);
  app.addHook("onRequest", async (request) => {
    (request as FastifyRequest & { user: unknown }).user = {
      id: USER_ID,
      userId: USER_ID,
      email: "client@trotti.test",
      role,
    };
  });

  const cartPayload = JSON.stringify({
    items: [
      { productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 },
    ],
    updatedAt: new Date().toISOString(),
  });

  const orderStore = new Map<string, {
    id: string;
    orderNumber: number;
    paymentMethod: string;
    subtotalHt: Decimal;
    tvaAmount: Decimal;
    shippingCost: Decimal;
    totalTtc: Decimal;
    items: Array<{ product: { name: string }; quantity: number; unitPriceHt: Decimal }>;
    payments: unknown[];
    installments: unknown[];
    statusHistory: unknown[];
  }>();

  const productVariantUpdate = vi.fn().mockImplementation(async (args: {
    data?: { stockQuantity?: { decrement?: number }; stockReserved?: { increment?: number } };
  }) => {
    const decrement = args.data?.stockQuantity?.decrement;
    if (typeof decrement === "number") {
      stock.quantity -= decrement;
    }
    return {
      id: VARIANT_ID,
      stockQuantity: stock.quantity,
      stockReserved: 0,
    };
  });

  const productVariantUpdateMany = vi.fn().mockImplementation(async (args: {
    where?: { stockQuantity?: { gte?: number } };
    data?: { stockQuantity?: { decrement?: number } };
  }) => {
    const minStock = args.where?.stockQuantity?.gte ?? 0;
    const decrement = args.data?.stockQuantity?.decrement ?? 0;
    if (stock.quantity < minStock) {
      return { count: 0 };
    }
    stock.quantity -= decrement;
    return { count: 1 };
  });

  const orderCreate = vi.fn().mockImplementation(async (args: {
    data?: {
      paymentMethod?: string;
      subtotalHt?: Decimal;
      tvaAmount?: Decimal;
      shippingCost?: Decimal;
      totalTtc?: Decimal;
    };
  }) => {
    orderCounter += 1;
    const id = `00000000-0000-0000-0000-${String(orderCounter).padStart(12, "0")}`;
    const created = {
      id,
      orderNumber: orderCounter,
      paymentMethod: args.data?.paymentMethod ?? "CARD",
      subtotalHt: args.data?.subtotalHt ?? new Decimal("19.99"),
      tvaAmount: args.data?.tvaAmount ?? new Decimal("4.00"),
      shippingCost: args.data?.shippingCost ?? new Decimal("6.90"),
      totalTtc: args.data?.totalTtc ?? new Decimal("30.89"),
      items: [{ product: { name: "Trotti" }, quantity: 1, unitPriceHt: new Decimal("19.99") }],
      payments: [],
      installments: [],
      statusHistory: [],
    };
    orderStore.set(id, created);
    return created;
  });

  const prisma = {
    address: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: SHIPPING_ADDRESS_ID,
          firstName: "Ada",
          lastName: "Lovelace",
          company: null,
          street: "1 rue de Paris",
          street2: null,
          city: "Paris",
          postalCode: "75001",
          country: "FR",
          phone: "0102030405",
        },
      ]),
      create: vi.fn().mockResolvedValue({ id: SHIPPING_ADDRESS_ID }),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: PRODUCT_ID,
          status: "ACTIVE",
          priceHt: new Decimal("19.99"),
          tvaRate: new Decimal(20),
        },
      ]),
    },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: VARIANT_ID,
          productId: PRODUCT_ID,
          sku: "VAR-1",
          isActive: true,
          stockQuantity: 1,
          stockReserved: 0,
          priceOverride: null,
        },
      ]),
      update: productVariantUpdate,
      updateMany: productVariantUpdateMany,
    },
    order: {
      create: orderCreate,
      findUnique: vi.fn().mockImplementation(async (args: { where?: { id?: string } }) => {
        const id = args.where?.id;
        return id ? orderStore.get(id) ?? null : null;
      }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue(null),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue(null),
    },
    paymentInstallment: {
      create: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    payment: {
      create: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: vi.fn().mockImplementation(async (args: { where?: { email?: string; id?: string } }) => {
        if (args.where?.email) return null;
        if (args.where?.id) {
          return {
            id: args.where.id,
            email: "client@trotti.test",
            firstName: "Ada",
            status: "ACTIVE",
          };
        }
        return null;
      }),
      create: vi.fn().mockResolvedValue({ id: CUSTOMER_ID }),
    },
    customerProfile: {
      create: vi.fn().mockResolvedValue(null),
    },
    financialLedger: {
      create: vi.fn().mockResolvedValue({ id: "ledger-1" }),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };

  app.decorate("prisma", prisma);
  app.decorate("redis", {
    get: vi.fn().mockResolvedValue(cartPayload),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  });

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: typeof error.code === "string" ? error.code : "REQUEST_ERROR",
        message: error.message,
      },
    });
  });

  return app;
}

describe("orders stock race protection", () => {
  let clientApp: FastifyInstance;
  let guestApp: FastifyInstance;
  let adminApp: FastifyInstance;
  const clientStock = { quantity: 1 };
  const guestStock = { quantity: 1 };
  const adminStock = { quantity: 1 };

  beforeAll(async () => {
    clientApp = buildRaceApp("CLIENT", clientStock);
    await clientApp.register(orderRoutes, { prefix: "/api/v1" });
    await clientApp.ready();

    guestApp = buildRaceApp("CLIENT", guestStock);
    await guestApp.register(orderRoutes, { prefix: "/api/v1" });
    await guestApp.ready();

    adminApp = buildRaceApp("ADMIN", adminStock);
    await adminApp.register(orderRoutes, { prefix: "/api/v1" });
    await adminApp.ready();
  });

  afterAll(async () => {
    await Promise.all([clientApp.close(), guestApp.close(), adminApp.close()]);
  });

  it("allows only one successful authenticated order when stock=1 under concurrency", async () => {
    const payload = {
      shippingAddressId: SHIPPING_ADDRESS_ID,
      paymentMethod: "CARD",
      acceptedCgv: true,
    };

    const [first, second] = await Promise.all([
      clientApp.inject({ method: "POST", url: "/api/v1/orders", payload }),
      clientApp.inject({ method: "POST", url: "/api/v1/orders", payload }),
    ]);

    const statusCodes = [first.statusCode, second.statusCode].sort((a, b) => a - b);
    expect(statusCodes).toEqual([201, 409]);
    expect(clientStock.quantity).toBeGreaterThanOrEqual(0);
  });

  it("allows only one successful guest order when stock=1 under concurrency", async () => {
    const payload = {
      email: "guest@example.test",
      shippingAddress: {
        firstName: "Grace",
        lastName: "Hopper",
        street: "2 avenue de Lyon",
        postalCode: "69001",
        city: "Lyon",
        country: "FR",
      },
      paymentMethod: "CARD",
      acceptedCgv: true,
    };

    const [first, second] = await Promise.all([
      guestApp.inject({
        method: "POST",
        url: "/api/v1/orders/guest",
        headers: { "x-session-id": "session-1" },
        payload,
      }),
      guestApp.inject({
        method: "POST",
        url: "/api/v1/orders/guest",
        headers: { "x-session-id": "session-1" },
        payload,
      }),
    ]);

    const statusCodes = [first.statusCode, second.statusCode].sort((a, b) => a - b);
    expect(statusCodes).toEqual([201, 409]);
    expect(guestStock.quantity).toBeGreaterThanOrEqual(0);
  });

  it("allows only one successful admin manual order when stock=1 under concurrency", async () => {
    const payload = {
      customerId: CUSTOMER_ID,
      items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 }],
      paymentMethod: "CARD",
      shippingMethod: "STORE_PICKUP",
    };

    const [first, second] = await Promise.all([
      adminApp.inject({ method: "POST", url: "/api/v1/admin/orders", payload }),
      adminApp.inject({ method: "POST", url: "/api/v1/admin/orders", payload }),
    ]);

    const statusCodes = [first.statusCode, second.statusCode].sort((a, b) => a - b);
    expect(statusCodes).toEqual([201, 409]);
    expect(adminStock.quantity).toBeGreaterThanOrEqual(0);
  });
});

describe("order pricing and inventory regressions", () => {
  const apps: FastifyInstance[] = [];
  async function fixture(role: UserRole = "CLIENT") {
    const app = buildRaceApp(role, { quantity: 20 });
    apps.push(app);
    await app.register(orderRoutes, { prefix: "/api/v1" });
    await app.ready();
    return app;
  }
  afterAll(async () => { await Promise.all(apps.map((app) => app.close())); });
  const connectedPayload = { shippingAddressId: SHIPPING_ADDRESS_ID, paymentMethod: "CARD", acceptedCgv: true };
  const guestPayload = { email: "guest@test.fr", shippingAddress: { firstName: "Ada", lastName: "Test", street: "1 rue Test", postalCode: "75001", city: "Paris" }, paymentMethod: "CARD", acceptedCgv: true };

  it.each([false, true])("requires a variant in checkout (guest=%s)", async (guest) => {
    const app = await fixture();
    vi.mocked(app.redis.get).mockResolvedValue(JSON.stringify({ items: [{ productId: PRODUCT_ID, variantId: null, quantity: 1 }] }));
    vi.mocked(app.prisma.product.findMany).mockResolvedValue([{ id: PRODUCT_ID, status: "ACTIVE", _count: { variants: 1 } }] as never);
    const res = await app.inject({ method: "POST", url: guest ? "/api/v1/orders/guest" : "/api/v1/orders", headers: { "x-session-id": "guest" }, payload: guest ? guestPayload : connectedPayload });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VARIANT_REQUIRED");
    expect(app.prisma.order.create).not.toHaveBeenCalled();
  });

  it.each([false, true])("charges no shipping for pickup (guest=%s)", async (guest) => {
    const app = await fixture();
    const res = await app.inject({ method: "POST", url: guest ? "/api/v1/orders/guest" : "/api/v1/orders", headers: { "x-session-id": "guest" }, payload: { ...(guest ? guestPayload : connectedPayload), shippingMethod: "STORE_PICKUP" } });
    expect(res.statusCode).toBe(201);
    expect(app.prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ shippingCost: new Decimal(0) }) }));
  });

  it("uses integer cents with the remainder on the final installment", async () => {
    const app = await fixture();
    const res = await app.inject({ method: "POST", url: "/api/v1/orders", payload: { ...connectedPayload, paymentMethod: "INSTALLMENT_3X", shippingMethod: "STORE_PICKUP" } });
    expect(res.statusCode).toBe(201);
    const calls = vi.mocked(app.prisma.paymentInstallment.create).mock.calls;
    const amounts = calls.map(([args]) => new Decimal(String(args.data.amountDue)).mul(100).toNumber());
    expect(amounts).toEqual([799, 799, 801]); // 19.99 HT, 20% VAT = 23.99 TTC
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(2399);
  });

  it("guards decrement against reserved stock in the atomic update", async () => {
    const app = await fixture();
    vi.mocked(app.prisma.productVariant.findMany).mockResolvedValueOnce([{ id: VARIANT_ID, productId: PRODUCT_ID, stockQuantity: 5, stockReserved: 4, isActive: true }] as never);
    const res = await app.inject({ method: "POST", url: "/api/v1/orders", payload: connectedPayload });
    expect(res.statusCode).toBe(201);
    expect(app.prisma.productVariant.updateMany).toHaveBeenCalledWith({ where: { id: VARIANT_ID, stockQuantity: { gte: 5 }, stockReserved: 4 }, data: { stockQuantity: { decrement: 1 } } });
  });

  it.each([false, true])("claims a discount atomically and persists the discounted total (guest=%s)", async (guest) => {
    const app = await fixture();
    app.prisma.discountCode = {
      findUnique: vi.fn().mockResolvedValue({ id: "discount", code: "TEN", kind: "PERCENT", value: new Decimal(10), isActive: true, maxUses: 1, usedCount: 0, minCartHt: null, startsAt: null, expiresAt: null }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    } as never;
    vi.mocked(app.redis.get).mockResolvedValue(JSON.stringify({ items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 }], discountCode: "TEN" }));
    const res = await app.inject({ method: "POST", url: guest ? "/api/v1/orders/guest" : "/api/v1/orders", headers: { "x-session-id": "guest" }, payload: { ...(guest ? guestPayload : connectedPayload), shippingMethod: "STORE_PICKUP" } });
    expect(res.statusCode).toBe(201);
    expect(app.prisma.discountCode.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ usedCount: { lt: 1 } }), data: { usedCount: { increment: 1 } } }));
    expect(app.prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subtotalHt: new Decimal("17.99"), tvaAmount: new Decimal("3.60"), totalTtc: new Decimal("21.59") }) }));
  });

  it("refuses an exhausted discount before creating an order", async () => {
    const app = await fixture();
    app.prisma.discountCode = { findUnique: vi.fn().mockResolvedValue({ id: "discount", isActive: true, kind: "FIXED", value: new Decimal(5), maxUses: 1, minCartHt: null, startsAt: null, expiresAt: null }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) } as never;
    vi.mocked(app.redis.get).mockResolvedValue(JSON.stringify({ items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 }], discountCode: "USED" }));
    const res = await app.inject({ method: "POST", url: "/api/v1/orders", payload: connectedPayload });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_DISCOUNT");
    expect(app.prisma.order.create).not.toHaveBeenCalled();
  });
});
