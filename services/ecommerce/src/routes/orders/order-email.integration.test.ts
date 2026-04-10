/**
 * Integration test: order creation → confirmation email sent.
 *
 * Full flow: authenticated user with cart in Redis → POST /orders
 * → order created in DB → sendEmail called with correct recipient,
 * subject containing order number, HTML containing items and totals.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { Decimal } from "@prisma/client/runtime/library";
import { ZodError } from "zod";
import { authPlugin } from "../../plugins/auth.js";
import { orderRoutes } from "./index.js";

// ---------------------------------------------------------------------------
// Mock sendEmail — capture all calls
// ---------------------------------------------------------------------------

const mockSendEmail = vi.fn().mockResolvedValue(true);
vi.mock("@trottistore/shared/notifications", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const USER_ID = "00000000-0000-0000-0000-000000000001";
const ADDRESS_ID = "00000000-0000-0000-0000-000000000010";
const PRODUCT_ID = "00000000-0000-0000-0000-000000000020";
const VARIANT_ID = "00000000-0000-0000-0000-000000000030";

const MOCK_ADDRESS = {
  id: ADDRESS_ID,
  userId: USER_ID,
  type: "SHIPPING",
  firstName: "Alice",
  lastName: "Dupont",
  company: null,
  street: "18 bis Rue Méchin",
  street2: null,
  city: "L'Île-Saint-Denis",
  postalCode: "93450",
  country: "FR",
  phone: "0612345678",
  isDefault: true,
};

const MOCK_PRODUCT = {
  id: PRODUCT_ID,
  sku: "TROTT-X1",
  name: "Xiaomi Pro 2",
  slug: "xiaomi-pro-2",
  priceHt: new Decimal(399),
  tvaRate: new Decimal(20),
  status: "ACTIVE",
};

const MOCK_VARIANT = {
  id: VARIANT_ID,
  productId: PRODUCT_ID,
  sku: "TROTT-X1-DEFAULT",
  name: "Default",
  priceOverride: null,
  stockQuantity: 10,
  stockReserved: 0,
  isActive: true,
};

const MOCK_CART = {
  items: [
    { productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 },
  ],
  updatedAt: new Date().toISOString(),
};

const MOCK_ORDER = {
  id: "order-new-1",
  orderNumber: 1042,
  customerId: USER_ID,
  status: "PENDING",
  paymentMethod: "CARD",
  paymentStatus: "PENDING",
  subtotalHt: new Decimal(399),
  tvaAmount: new Decimal(79.8),
  shippingCost: new Decimal(0),
  totalTtc: new Decimal(478.8),
  shippingMethod: "DELIVERY",
  shippingAddress: {},
  billingAddress: {},
  items: [
    {
      id: "item-1",
      productId: PRODUCT_ID,
      variantId: VARIANT_ID,
      quantity: 1,
      unitPriceHt: new Decimal(399),
      tvaRate: new Decimal(20),
      totalHt: new Decimal(399),
      product: { name: "Xiaomi Pro 2", slug: "xiaomi-pro-2", sku: "TROTT-X1" },
      variant: { name: "Default", sku: "TROTT-X1-DEFAULT" },
    },
  ],
  payments: [],
  installments: [],
  statusHistory: [],
};

// ---------------------------------------------------------------------------
// App builder with full mock chain
// ---------------------------------------------------------------------------

function buildApp(): FastifyInstance {
  process.env.JWT_ACCESS_SECRET = "test-secret";
  process.env.COOKIE_SECRET = "test-cookie-secret";

  const app = Fastify({ logger: false });

  app.decorate("prisma", {
    address: {
      findMany: vi.fn().mockResolvedValue([MOCK_ADDRESS]),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([MOCK_PRODUCT]),
    },
    productVariant: {
      findMany: vi.fn().mockResolvedValue([MOCK_VARIANT]),
      update: vi.fn().mockResolvedValue(MOCK_VARIANT),
    },
    order: {
      create: vi.fn().mockResolvedValue(MOCK_ORDER),
      findUnique: vi.fn().mockResolvedValue(MOCK_ORDER),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue(MOCK_ORDER),
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
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: USER_ID,
        email: "alice@trottistore.fr",
        firstName: "Alice",
      }),
    },
    $transaction: vi.fn(async (fn: any) => {
      if (typeof fn === "function") return fn(app.prisma);
      return Promise.all(fn);
    }),
  });

  app.decorate("redis", {
    get: vi.fn().mockResolvedValue(JSON.stringify(MOCK_CART)),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
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

async function getAuthToken(app: FastifyInstance): Promise<string> {
  return app.jwt.sign({ sub: USER_ID, email: "alice@trottistore.fr", role: "CLIENT" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Order creation → confirmation email", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.register(authPlugin);
    await app.register(orderRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set default mocks that get cleared
    (app.redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(MOCK_CART));
    (app.prisma.address.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_ADDRESS]);
    (app.prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_PRODUCT]);
    (app.prisma.productVariant.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_VARIANT]);
    (app.prisma.order.create as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_ORDER);
    (app.prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_ORDER);
    (app.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: USER_ID,
      email: "alice@trottistore.fr",
      firstName: "Alice",
    });
  });

  it("creates order and sends confirmation email with correct data", async () => {
    const token = await getAuthToken(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        shippingAddressId: ADDRESS_ID,
        paymentMethod: "CARD",
        acceptedCgv: true,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().success).toBe(true);

    // Wait for non-blocking email
    await new Promise((r) => setTimeout(r, 100));

    // Verify sendEmail was called
    expect(mockSendEmail).toHaveBeenCalledOnce();

    const [to, subject, html] = mockSendEmail.mock.calls[0];

    // Correct recipient
    expect(to).toBe("alice@trottistore.fr");

    // Subject contains order number
    expect(subject).toContain("1042");
    expect(subject).toContain("Confirmation");

    // HTML contains key order data
    expect(html).toContain("Alice");          // Customer name
    expect(html).toContain("Xiaomi Pro 2");   // Product name
    expect(html).toContain("478.8");          // Total TTC (or formatted)
    expect(html).toContain("93450");          // Postal code from address
  });

  it("clears cart after order creation", async () => {
    const token = await getAuthToken(app);

    await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        shippingAddressId: ADDRESS_ID,
        paymentMethod: "CARD",
        acceptedCgv: true,
      },
    });

    expect(app.redis.del).toHaveBeenCalled();
  });

  it("does NOT send email if order creation fails (empty cart)", async () => {
    const token = await getAuthToken(app);

    // Empty cart
    (app.redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      JSON.stringify({ items: [], updatedAt: new Date().toISOString() }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        shippingAddressId: ADDRESS_ID,
        paymentMethod: "CARD",
        acceptedCgv: true,
      },
    });

    expect(res.statusCode).toBe(400);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
