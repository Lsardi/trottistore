import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { sendEmail } from "@trottistore/shared/notifications";
import { orderConfirmationEmail } from "../../emails/templates.js";

// ─── Constants ───────────────────────────────────────────────

const TVA_RATE = new Decimal(20);
const FREE_SHIPPING_THRESHOLD = new Decimal(100); // Free shipping above 100 EUR HT
const DEFAULT_SHIPPING_COST = new Decimal(6.9);

const PAYMENT_METHODS = [
  "CARD",
  "APPLE_PAY",
  "GOOGLE_PAY",
  "LINK",
  "BANK_TRANSFER",
  "INSTALLMENT_2X",
  "INSTALLMENT_3X",
  "INSTALLMENT_4X",
  "CASH",
  "CHECK",
] as const;

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

// ─── Schemas ─────────────────────────────────────────────────

const checkoutSchema = z.object({
  shippingAddressId: z.string().uuid(),
  billingAddressId: z.string().uuid().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  shippingMethod: z.enum(["DELIVERY", "STORE_PICKUP"]).optional().default("DELIVERY"),
  notes: z.string().max(1000).optional(),
  acceptedCgv: z.literal(true),
});

const guestAddressSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  street: z.string().min(1).max(255).trim(),
  street2: z.string().max(255).optional(),
  postalCode: z.string().min(1).max(20).trim(),
  city: z.string().min(1).max(100).trim(),
  country: z.string().length(2).default("FR"),
  phone: z.string().max(20).optional(),
});

const guestCheckoutSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  shippingAddress: guestAddressSchema,
  billingAddress: guestAddressSchema.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  shippingMethod: z.enum(["DELIVERY", "STORE_PICKUP"]).optional().default("DELIVERY"),
  notes: z.string().max(1000).optional(),
  acceptedCgv: z.literal(true),
});

const listOrdersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const adminListOrdersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "REFUNDED",
    ])
    .optional(),
  search: z.string().max(100).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ]),
  note: z.string().max(500).optional(),
});

const updateTrackingSchema = z.object({
  trackingNumber: z.string().min(1).max(100).trim(),
  note: z.string().max(500).optional(),
  markAsShipped: z.boolean().default(true),
});

const orderIdParamsSchema = z.object({
  id: z.string().uuid(),
});

// ─── Helpers ─────────────────────────────────────────────────

function getInstallmentCount(method: string): number | null {
  if (method === "INSTALLMENT_2X") return 2;
  if (method === "INSTALLMENT_3X") return 3;
  if (method === "INSTALLMENT_4X") return 4;
  return null;
}

function generateBankReference(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TS-${year}-${rand}`;
}

interface CartItem {
  productId: string;
  variantId: string | null;
  quantity: number;
}

interface Cart {
  items: CartItem[];
  updatedAt: string;
}

interface RequestUser {
  id: string;
  userId: string;
  email: string;
  role: string;
}

type AuthenticatedRequest = FastifyRequest & { user: RequestUser };

function getRequestUser(request: FastifyRequest): RequestUser | null {
  const maybeUser = request.user as Partial<RequestUser> | undefined;
  if (!maybeUser) return null;
  if (
    typeof maybeUser.id !== "string" ||
    typeof maybeUser.userId !== "string" ||
    typeof maybeUser.email !== "string" ||
    typeof maybeUser.role !== "string"
  ) {
    return null;
  }

  return {
    id: maybeUser.id,
    userId: maybeUser.userId,
    email: maybeUser.email,
    role: maybeUser.role,
  };
}

function getCartKey(request: FastifyRequest): string {
  const user = getRequestUser(request);
  const userId = user?.id ?? user?.userId;
  if (userId) return `cart:${userId}`;
  const sessionHeader = request.headers["x-session-id"];
  const sessionId =
    typeof sessionHeader === "string"
      ? sessionHeader
      : Array.isArray(sessionHeader) && typeof sessionHeader[0] === "string"
        ? sessionHeader[0]
        : request.cookies?.sessionId;
  if (!sessionId) {
    throw {
      statusCode: 400,
      code: "MISSING_SESSION_ID",
      message: "Missing session identifier",
    };
  }
  return `cart:session:${sessionId}`;
}

function getSessionIdFromCartKey(cartKey: string): string | null {
  if (!cartKey.startsWith("cart:session:")) return null;
  return cartKey.slice("cart:session:".length) || null;
}

function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): request is AuthenticatedRequest {
  const user = getRequestUser(request);
  const userId = user?.id ?? user?.userId;
  if (!userId) {
    reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return false;
  }
  return true;
}

function isBackofficeRole(role?: string): boolean {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "MANAGER";
}

// ─── Routes ──────────────────────────────────────────────────

export async function orderRoutes(app: FastifyInstance) {
  // All order routes require authentication, except /orders/guest.
  // Fallback to route-level `requireAuth` checks if not present (e.g. isolated tests).
  // TODO(tech-debt): align tests with production auth path by mocking/decorating `authenticate`.
  app.addHook("onRequest", async (request, reply) => {
    // Skip auth for guest checkout
    const path = request.url.split("?")[0];
    if (path.endsWith("/orders/guest")) return;

    const authenticate = (
      app as FastifyInstance & {
        authenticate?: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
      }
    ).authenticate;

    if (typeof authenticate === "function") {
      await authenticate(request, reply);
    }
  });

  // POST /orders — Checkout: create order from cart
  app.post("/orders", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const user = request.user;
    const userId = user.id ?? user.userId;
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid checkout data",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { shippingAddressId, billingAddressId, paymentMethod, shippingMethod, notes } =
      parsed.data;

    // 1. Get cart from Redis
    const cartKey = getCartKey(request);
    const raw = await app.redis.get(cartKey);
    const cart: Cart = raw
      ? JSON.parse(raw)
      : { items: [], updatedAt: new Date().toISOString() };

    if (cart.items.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: "EMPTY_CART", message: "Cart is empty" },
      });
    }

    // 2. Validate addresses belong to user
    const addressIds = [
      shippingAddressId,
      ...(billingAddressId ? [billingAddressId] : []),
    ];
    const addresses = await app.prisma.address.findMany({
      where: { id: { in: addressIds }, userId },
    });

    const shippingAddr = addresses.find((a) => a.id === shippingAddressId);
    if (!shippingAddr) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "ADDRESS_NOT_FOUND",
          message: "Shipping address not found",
        },
      });
    }

    const billingAddr = billingAddressId
      ? addresses.find((a) => a.id === billingAddressId)
      : shippingAddr;
    if (!billingAddr) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "ADDRESS_NOT_FOUND",
          message: "Billing address not found",
        },
      });
    }

    // 3. Fetch product & variant data and validate stock
    const productIds = [
      ...new Set(cart.items.map((i) => i.productId)),
    ];
    const variantIds = cart.items
      .map((i) => i.variantId)
      .filter((id): id is string => id !== null);

    const [products, variants] = await Promise.all([
      app.prisma.product.findMany({
        where: { id: { in: productIds }, status: "ACTIVE" },
      }),
      variantIds.length > 0
        ? app.prisma.productVariant.findMany({
            where: { id: { in: variantIds }, isActive: true },
          })
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Validate all items
    const orderItemsData: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      unitPriceHt: Decimal;
      tvaRate: Decimal;
      totalHt: Decimal;
    }> = [];

    for (const item of cart.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "PRODUCT_UNAVAILABLE",
            message: `Product ${item.productId} is no longer available`,
          },
        });
      }

      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.productId !== item.productId) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "VARIANT_UNAVAILABLE",
              message: `Variant ${item.variantId} is no longer available`,
            },
          });
        }

        const available = variant.stockQuantity - variant.stockReserved;
        if (available < item.quantity) {
          return reply.status(409).send({
            success: false,
            error: {
              code: "INSUFFICIENT_STOCK",
              message: `Insufficient stock for variant ${variant.sku}: ${available} available, ${item.quantity} requested`,
            },
          });
        }
      }

      const unitPriceHt =
        item.variantId && variantMap.get(item.variantId)?.priceOverride
          ? variantMap.get(item.variantId)!.priceOverride!
          : product.priceHt;
      const totalHt = new Decimal(unitPriceHt).mul(item.quantity);

      orderItemsData.push({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceHt: new Decimal(unitPriceHt),
        tvaRate: product.tvaRate,
        totalHt,
      });
    }

    // 4. Calculate totals
    const subtotalHt = orderItemsData.reduce(
      (sum, item) => sum.add(item.totalHt),
      new Decimal(0)
    );

    const tvaAmount = subtotalHt.mul(TVA_RATE).div(100);
    const shippingCost = subtotalHt.gte(FREE_SHIPPING_THRESHOLD)
      ? new Decimal(0)
      : DEFAULT_SHIPPING_COST;
    const totalTtc = subtotalHt.add(tvaAmount).add(shippingCost);

    // 5. Determine initial payment status
    const isInstallment = getInstallmentCount(paymentMethod) !== null;
    const isBankTransfer = paymentMethod === "BANK_TRANSFER";
    const paymentStatus =
      isInstallment || isBankTransfer ? "PENDING" : "PENDING";

    // 6. Serialize addresses as JSON
    const shippingAddressJson = {
      firstName: shippingAddr.firstName,
      lastName: shippingAddr.lastName,
      company: shippingAddr.company,
      street: shippingAddr.street,
      street2: shippingAddr.street2,
      city: shippingAddr.city,
      postalCode: shippingAddr.postalCode,
      country: shippingAddr.country,
      phone: shippingAddr.phone,
    };

    const billingAddressJson = {
      firstName: billingAddr.firstName,
      lastName: billingAddr.lastName,
      company: billingAddr.company,
      street: billingAddr.street,
      street2: billingAddr.street2,
      city: billingAddr.city,
      postalCode: billingAddr.postalCode,
      country: billingAddr.country,
      phone: billingAddr.phone,
    };

    // 7. Create order in a transaction
    const order = await app.prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          customerId: userId,
          status: "PENDING",
          paymentMethod,
          paymentStatus,
          shippingMethod,
          shippingAddress: shippingAddressJson,
          billingAddress: billingAddressJson,
          subtotalHt,
          tvaAmount,
          shippingCost,
          totalTtc,
          notes: notes ?? null,
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPriceHt: item.unitPriceHt,
              tvaRate: item.tvaRate,
              totalHt: item.totalHt,
            })),
          },
          statusHistory: {
            create: {
              fromStatus: "NEW",
              toStatus: "PENDING",
              note: "Order created",
              changedBy: userId,
            },
          },
        },
        include: {
          items: true,
          statusHistory: true,
        },
      });

      // Decrement/reserve stock for each variant
      for (const item of cart.items) {
        if (!item.variantId) continue;

        if (isInstallment) {
          // For installment payments, reserve stock instead of decrementing
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockReserved: { increment: item.quantity } },
          });
        } else {
          // For immediate payments, decrement stock
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }
      }

      // Create installment records if applicable
      const installmentCount = getInstallmentCount(paymentMethod);
      if (installmentCount) {
        const installmentAmount = totalTtc.div(installmentCount);
        const now = new Date();

        for (let i = 1; i <= installmentCount; i++) {
          const dueDate = new Date(now);
          dueDate.setMonth(dueDate.getMonth() + (i - 1)); // First due now, then monthly

          await tx.paymentInstallment.create({
            data: {
              orderId: newOrder.id,
              installmentNumber: i,
              totalInstallments: installmentCount,
              amountDue: installmentAmount,
              dueDate,
              status: i === 1 ? "PENDING" : "PENDING",
            },
          });
        }
      }

      // Create payment record for bank transfer
      if (isBankTransfer) {
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            provider: "internal",
            amount: totalTtc,
            method: "BANK_TRANSFER",
            status: "PENDING",
            bankRef: generateBankReference(),
          },
        });
      }

      return newOrder;
    });

    // 8. Clear cart in Redis
    await app.redis.del(cartKey);

    // 9. Fetch the full order to return
    const fullOrder = await app.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, slug: true, sku: true },
            },
            variant: {
              select: { name: true, sku: true },
            },
          },
        },
        payments: true,
        installments: { orderBy: { installmentNumber: "asc" } },
        statusHistory: { orderBy: { changedAt: "desc" } },
      },
    });

    // 10. Send confirmation email (non-blocking)
    if (fullOrder) {
      const customerEmail = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
      if (customerEmail?.email) {
        const { subject, html } = orderConfirmationEmail({
          orderNumber: fullOrder.orderNumber,
          customerName: customerEmail.firstName || "Client",
          items: fullOrder.items.map((i) => ({
            name: i.product?.name || "Produit",
            quantity: i.quantity,
            unitPrice: Number(i.unitPriceHt).toFixed(2),
          })),
          subtotalHt: Number(fullOrder.subtotalHt).toFixed(2),
          shippingCost: Number(fullOrder.shippingCost).toFixed(2),
          totalTtc: Number(fullOrder.totalTtc).toFixed(2),
          paymentMethod: fullOrder.paymentMethod,
          shippingAddress: `${shippingAddr.street}, ${shippingAddr.postalCode} ${shippingAddr.city}`,
        });
        sendEmail(customerEmail.email, subject, html).catch((e: unknown) =>
          app.log.error({ err: e }, "Failed to send order confirmation email"),
        );
      }
    }

    return reply.status(201).send({
      success: true,
      data: fullOrder,
    });
  });

  // POST /orders/guest — Guest checkout: create order without account
  app.post("/orders/guest", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const parsed = guestCheckoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid guest checkout data",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { email, shippingAddress, billingAddress, paymentMethod, shippingMethod, notes } = parsed.data;

    // Get cart from session key (same key strategy as cart routes)
    let cartKey: string;
    try {
      cartKey = getCartKey(request);
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_SESSION", message: "Missing x-session-id header" },
      });
    }
    const raw = await app.redis.get(cartKey);
    const cart: Cart = raw
      ? JSON.parse(raw)
      : { items: [], updatedAt: new Date().toISOString() };

    if (cart.items.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: "EMPTY_CART", message: "Cart is empty" },
      });
    }

    // Validate products and stock (same logic as authenticated checkout)
    const productIds = [...new Set(cart.items.map((i) => i.productId))];
    const variantIds = cart.items.map((i) => i.variantId).filter((id): id is string => id !== null);

    const [products, variants] = await Promise.all([
      app.prisma.product.findMany({ where: { id: { in: productIds }, status: "ACTIVE" } }),
      variantIds.length > 0
        ? app.prisma.productVariant.findMany({ where: { id: { in: variantIds }, isActive: true } })
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const orderItemsData: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      unitPriceHt: Decimal;
      tvaRate: Decimal;
      totalHt: Decimal;
    }> = [];

    for (const item of cart.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return reply.status(400).send({
          success: false,
          error: { code: "PRODUCT_UNAVAILABLE", message: `Product ${item.productId} is no longer available` },
        });
      }

      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.productId !== item.productId) {
          return reply.status(400).send({
            success: false,
            error: { code: "VARIANT_UNAVAILABLE", message: `Variant ${item.variantId} is no longer available` },
          });
        }
        const available = variant.stockQuantity - variant.stockReserved;
        if (available < item.quantity) {
          return reply.status(409).send({
            success: false,
            error: { code: "INSUFFICIENT_STOCK", message: `Insufficient stock for variant ${variant.sku}` },
          });
        }
      }

      const unitPriceHt = item.variantId && variantMap.get(item.variantId)?.priceOverride
        ? variantMap.get(item.variantId)!.priceOverride!
        : product.priceHt;
      const totalHt = new Decimal(unitPriceHt).mul(item.quantity);

      orderItemsData.push({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceHt: new Decimal(unitPriceHt),
        tvaRate: product.tvaRate,
        totalHt,
      });
    }

    // Calculate totals
    const subtotalHt = orderItemsData.reduce((sum, item) => sum.add(item.totalHt), new Decimal(0));
    const tvaAmount = subtotalHt.mul(TVA_RATE).div(100);
    const shippingCost = subtotalHt.gte(FREE_SHIPPING_THRESHOLD) ? new Decimal(0) : DEFAULT_SHIPPING_COST;
    const totalTtc = subtotalHt.add(tvaAmount).add(shippingCost);

    const isInstallment = getInstallmentCount(paymentMethod) !== null;
    const isBankTransfer = paymentMethod === "BANK_TRANSFER";

    const shippingAddressJson = { ...shippingAddress };
    const billingAddressJson = billingAddress ? { ...billingAddress } : { ...shippingAddress };

    // Avoid silently attaching unauthenticated guest orders to an existing account email.
    const existingUser = await app.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: {
          code: "EMAIL_ALREADY_REGISTERED",
          message: "An account already exists with this email. Please sign in to place this order.",
        },
      });
    }

    // Create guest user + address + order in a single transaction
    const order = await app.prisma.$transaction(async (tx) => {
      // Create guest user (random password, they can claim the account later)
      const guestUser = await tx.user.create({
        data: {
          email,
          passwordHash: `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          phone: shippingAddress.phone || null,
          role: "CLIENT",
          emailVerified: false,
        },
      });

      // Create CRM profile for guest
      await tx.customerProfile.create({
        data: {
          userId: guestUser.id,
          loyaltyTier: "BRONZE",
          loyaltyPoints: 0,
          totalOrders: 1,
          totalSpent: Number(totalTtc),
          source: "WEBSITE",
        },
      }).catch(() => {}); // ignore if profile table doesn't exist or constraint

      // Create shipping address
      const addr = await tx.address.create({
        data: {
          userId: guestUser.id,
          ...shippingAddress,
          street2: shippingAddress.street2 || null,
          phone: shippingAddress.phone || null,
          label: "Livraison",
          type: "SHIPPING",
          isDefault: true,
        },
      });

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          customerId: guestUser.id,
          status: "PENDING",
          paymentMethod,
          paymentStatus: "PENDING",
          shippingMethod,
          shippingAddress: shippingAddressJson,
          billingAddress: billingAddressJson,
          subtotalHt,
          tvaAmount,
          shippingCost,
          totalTtc,
          notes: notes ?? null,
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPriceHt: item.unitPriceHt,
              tvaRate: item.tvaRate,
              totalHt: item.totalHt,
            })),
          },
          statusHistory: {
            create: {
              fromStatus: "NEW",
              toStatus: "PENDING",
              note: "Guest order created",
              changedBy: guestUser.id,
            },
          },
        },
        include: { items: true, statusHistory: true },
      });

      // Decrement stock
      for (const item of cart.items) {
        if (!item.variantId) continue;
        if (isInstallment) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockReserved: { increment: item.quantity } },
          });
        } else {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }
      }

      // Create installment records if applicable
      const installmentCount = getInstallmentCount(paymentMethod);
      if (installmentCount) {
        const installmentAmount = totalTtc.div(installmentCount);
        const now = new Date();
        for (let i = 1; i <= installmentCount; i++) {
          const dueDate = new Date(now);
          dueDate.setMonth(dueDate.getMonth() + (i - 1));
          await tx.paymentInstallment.create({
            data: {
              orderId: newOrder.id,
              installmentNumber: i,
              totalInstallments: installmentCount,
              amountDue: installmentAmount,
              dueDate,
              status: "PENDING",
            },
          });
        }
      }

      if (isBankTransfer) {
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            provider: "internal",
            amount: totalTtc,
            method: "BANK_TRANSFER",
            status: "PENDING",
            bankRef: generateBankReference(),
          },
        });
      }

      return newOrder;
    });

    // Bind guest order to session for subsequent guest Stripe payment-intent calls.
    // Short TTL to limit replay surface.
    const guestSessionId = getSessionIdFromCartKey(cartKey);
    if (guestSessionId) {
      await app.redis.set(`checkout:guest-order:${order.id}`, guestSessionId, "EX", 60 * 30);
    }

    // Clear cart
    await app.redis.del(cartKey);

    // Fetch full order
    const fullOrder = await app.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            product: { select: { name: true, slug: true, sku: true } },
            variant: { select: { name: true, sku: true } },
          },
        },
        payments: true,
        installments: { orderBy: { installmentNumber: "asc" } },
        statusHistory: { orderBy: { changedAt: "desc" } },
      },
    });

    // Send guest confirmation email (non-blocking)
    if (fullOrder && email) {
      const { subject, html } = orderConfirmationEmail({
        orderNumber: fullOrder.orderNumber,
        customerName: shippingAddress.firstName,
        items: fullOrder.items.map((i: { product?: { name?: string }; quantity: number; unitPriceHt: unknown }) => ({
          name: i.product?.name || "Produit",
          quantity: i.quantity,
          unitPrice: Number(i.unitPriceHt).toFixed(2),
        })),
        subtotalHt: Number(fullOrder.subtotalHt).toFixed(2),
        shippingCost: Number(fullOrder.shippingCost).toFixed(2),
        totalTtc: Number(fullOrder.totalTtc).toFixed(2),
        paymentMethod: fullOrder.paymentMethod,
        shippingAddress: `${shippingAddress.street}, ${shippingAddress.postalCode} ${shippingAddress.city}`,
      });
      sendEmail(email, subject, html).catch((e: unknown) =>
        app.log.error({ err: e }, "Failed to send guest order confirmation email"),
      );
    }

    return reply.status(201).send({
      success: true,
      data: fullOrder,
    });
  });

  // GET /admin/orders — Admin/backoffice list orders
  app.get("/admin/orders", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const user = request.user;
    if (!isBackofficeRole(user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Backoffice access required" },
      });
    }

    const parsed = adminListOrdersSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { page, limit, status, search } = parsed.data;
    const skip = (page - 1) * limit;
    const normalizedSearch = search?.trim();

    const where = {
      ...(status ? { status } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { trackingNumber: { contains: normalizedSearch, mode: "insensitive" as const } },
              { customer: { email: { contains: normalizedSearch, mode: "insensitive" as const } } },
              ...(Number.isFinite(Number(normalizedSearch))
                ? [{ orderNumber: Number(normalizedSearch) }]
                : []),
            ],
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      app.prisma.order.findMany({
        where,
        include: {
          customer: {
            select: { id: true, email: true, firstName: true, lastName: true, phone: true },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      app.prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        shippingMethod: order.shippingMethod,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        totalTtc: order.totalTtc,
        itemsCount: order._count.items,
        createdAt: order.createdAt,
        customer: order.customer,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  });

  // GET /admin/orders/:id — Admin/backoffice order detail
  app.get("/admin/orders/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const user = request.user;
    if (!isBackofficeRole(user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Backoffice access required" },
      });
    }

    const params = orderIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid order identifier",
          details: params.error.flatten().fieldErrors,
        },
      });
    }

    const order = await app.prisma.order.findUnique({
      where: { id: params.data.id },
      include: {
        customer: {
          select: { id: true, email: true, firstName: true, lastName: true, phone: true },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                sku: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true, alt: true },
                },
              },
            },
            variant: {
              select: { id: true, name: true, sku: true, attributes: true },
            },
          },
        },
        payments: { orderBy: { createdAt: "desc" } },
        installments: { orderBy: { installmentNumber: "asc" } },
        statusHistory: { orderBy: { changedAt: "desc" } },
      },
    });

    if (!order) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Order not found" },
      });
    }

    return { success: true, data: order };
  });

  // PUT /admin/orders/:id/tracking — update parcel tracking info
  app.put("/admin/orders/:id/tracking", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const user = request.user;
    const userId = user.id ?? user.userId;
    if (!isBackofficeRole(user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Backoffice access required" },
      });
    }

    const params = orderIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid order identifier",
          details: params.error.flatten().fieldErrors,
        },
      });
    }

    const parsed = updateTrackingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid tracking update",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { id } = params.data;
    const { trackingNumber, note, markAsShipped } = parsed.data;

    const order = await app.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, trackingNumber: true },
    });

    if (!order) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Order not found" },
      });
    }

    const shouldTransitionToShipped =
      markAsShipped &&
      order.status !== "SHIPPED" &&
      order.status !== "DELIVERED" &&
      order.status !== "CANCELLED" &&
      order.status !== "REFUNDED" &&
      (VALID_STATUS_TRANSITIONS[order.status] ?? []).includes("SHIPPED");

    const updatedOrder = await app.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          trackingNumber,
          ...(shouldTransitionToShipped
            ? { status: "SHIPPED", shippedAt: new Date() }
            : {}),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: shouldTransitionToShipped ? "SHIPPED" : order.status,
          note:
            note ??
            `Tracking updated: ${trackingNumber}${
              shouldTransitionToShipped ? " (status set to SHIPPED)" : ""
            }`,
          changedBy: userId,
        },
      });

      return updated;
    });

    return { success: true, data: updatedOrder };
  });

  // GET /orders — List user's orders (paginated)
  app.get("/orders", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const user = request.user;
    const userId = user.id ?? user.userId;
    const parsed = listOrdersSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where = { customerId: userId };

    const [orders, total] = await Promise.all([
      app.prisma.order.findMany({
        where,
        include: {
          items: {
            select: { id: true },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      app.prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const data = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalTtc: order.totalTtc,
      itemsCount: order._count.items,
      createdAt: order.createdAt,
    }));

    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  });

  // GET /orders/:id — Full order detail
  app.get("/orders/:id", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const user = request.user;
    const userId = user.id ?? user.userId;
    const params = orderIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid order identifier",
          details: params.error.flatten().fieldErrors,
        },
      });
    }
    const { id } = params.data;

    const order = await app.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                slug: true,
                sku: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true, alt: true },
                },
              },
            },
            variant: {
              select: { name: true, sku: true, attributes: true },
            },
          },
        },
        payments: { orderBy: { createdAt: "desc" } },
        installments: { orderBy: { installmentNumber: "asc" } },
        statusHistory: { orderBy: { changedAt: "desc" } },
      },
    });

    if (!order) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Order not found" },
      });
    }

    // Must belong to the requesting user or user is admin
    if (order.customerId !== userId && user.role !== "ADMIN") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied" },
      });
    }

    return { success: true, data: order };
  });

  // PUT /orders/:id/status — Backoffice: change order status (legacy path)
  app.put("/orders/:id/status", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const user = request.user;
    const userId = user.id ?? user.userId;
    if (!isBackofficeRole(user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Backoffice access required" },
      });
    }

    const params = orderIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid order identifier",
          details: params.error.flatten().fieldErrors,
        },
      });
    }
    const { id } = params.data;
    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid status update",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { status: newStatus, note } = parsed.data;

    const order = await app.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!order) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Order not found" },
      });
    }

    // Validate status transition
    const allowedNext = VALID_STATUS_TRANSITIONS[order.status];
    if (!allowedNext || !allowedNext.includes(newStatus)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Cannot transition from ${order.status} to ${newStatus}. Allowed: ${(allowedNext ?? []).join(", ") || "none"}`,
        },
      });
    }

    // Update order status in a transaction
    const updated = await app.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === "SHIPPED"
            ? { shippedAt: new Date() }
            : {}),
          ...(newStatus === "DELIVERED"
            ? { deliveredAt: new Date() }
            : {}),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: newStatus,
          note: note ?? null,
          changedBy: userId,
        },
      });

      // If cancelled, release reserved stock
      if (newStatus === "CANCELLED") {
        const items = await tx.orderItem.findMany({
          where: { orderId: id },
        });

        for (const item of items) {
          if (!item.variantId) continue;

          // Check if this was an installment order (stock was reserved, not decremented)
          if (
            updatedOrder.paymentMethod.startsWith("INSTALLMENT_")
          ) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                stockReserved: { decrement: item.quantity },
              },
            });
          } else {
            // Restore stock for non-installment orders
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                stockQuantity: { increment: item.quantity },
              },
            });
          }
        }

        // Cancel pending installments
        await tx.paymentInstallment.updateMany({
          where: { orderId: id, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
      }

      return updatedOrder;
    });

    return { success: true, data: updated };
  });

  // PUT /admin/orders/:id/status — Backoffice: change order status
  app.put("/admin/orders/:id/status", async (request, reply) => {
    if (!requireAuth(request, reply)) return;

    const user = request.user;
    const userId = user.id ?? user.userId;
    if (!isBackofficeRole(user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Backoffice access required" },
      });
    }

    const params = orderIdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid order identifier",
          details: params.error.flatten().fieldErrors,
        },
      });
    }
    const { id } = params.data;
    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid status update",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { status: newStatus, note } = parsed.data;

    const order = await app.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!order) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Order not found" },
      });
    }

    const allowedNext = VALID_STATUS_TRANSITIONS[order.status];
    if (!allowedNext || !allowedNext.includes(newStatus)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Cannot transition from ${order.status} to ${newStatus}. Allowed: ${(allowedNext ?? []).join(", ") || "none"}`,
        },
      });
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === "SHIPPED" ? { shippedAt: new Date() } : {}),
          ...(newStatus === "DELIVERED" ? { deliveredAt: new Date() } : {}),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: newStatus,
          note: note ?? null,
          changedBy: userId,
        },
      });

      if (newStatus === "CANCELLED") {
        const items = await tx.orderItem.findMany({ where: { orderId: id } });

        for (const item of items) {
          if (!item.variantId) continue;
          if (updatedOrder.paymentMethod.startsWith("INSTALLMENT_")) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockReserved: { decrement: item.quantity } },
            });
          } else {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }

        await tx.paymentInstallment.updateMany({
          where: { orderId: id, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
      }

      return updatedOrder;
    });

    return { success: true, data: updated };
  });

  // ── POST /admin/orders/:id/refund — Refund an order (partial or full) ──
  app.post("/admin/orders/:id/refund", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const user = request.user;
    if (!isBackofficeRole(user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Backoffice access required" },
      });
    }

    const id = orderIdParamsSchema.parse(request.params).id;
    const body = z.object({
      amount: z.number().positive().optional(), // Partial refund amount. If omitted = full refund.
      reason: z.string().max(500).optional(),
      restockItems: z.boolean().default(true),
    }).parse(request.body);

    const order = await app.prisma.order.findUnique({
      where: { id },
      include: {
        payments: { where: { status: "CONFIRMED", provider: "stripe" } },
        items: { select: { variantId: true, quantity: true } },
      },
    });

    if (!order) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Commande introuvable" },
      });
    }

    if (order.status === "REFUNDED") {
      return reply.status(400).send({
        success: false,
        error: { code: "ALREADY_REFUNDED", message: "Cette commande a déjà été remboursée" },
      });
    }

    const refundAmount = body.amount ?? Number(order.totalTtc);
    const isFullRefund = !body.amount || body.amount >= Number(order.totalTtc);

    // Attempt Stripe refund if a Stripe payment exists
    const stripePayment = order.payments[0];
    let stripeRefundId: string | null = null;

    if (stripePayment?.providerRef && process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const refund = await stripe.refunds.create({
          payment_intent: stripePayment.providerRef,
          amount: Math.round(refundAmount * 100),
          reason: "requested_by_customer",
        });
        stripeRefundId = refund.id;
      } catch (err) {
        app.log.error({ err, orderId: id }, "Stripe refund failed");
        return reply.status(502).send({
          success: false,
          error: { code: "STRIPE_REFUND_FAILED", message: "Le remboursement Stripe a échoué" },
        });
      }
    }

    // Update order in transaction
    const userId = user.id ?? user.userId;
    await app.prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({
        where: { id },
        data: {
          status: isFullRefund ? "REFUNDED" : order.status,
          paymentStatus: isFullRefund ? "REFUNDED" : "PARTIAL",
        },
      });

      // Create payment record for refund
      await tx.payment.create({
        data: {
          orderId: id,
          provider: stripeRefundId ? "stripe" : "internal",
          providerRef: stripeRefundId,
          amount: -refundAmount, // Negative = refund
          method: order.paymentMethod,
          status: "CONFIRMED",
          receivedAt: new Date(),
        },
      });

      // Status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: isFullRefund ? "REFUNDED" : order.status,
          note: `Remboursement ${isFullRefund ? "total" : "partiel"}: ${refundAmount.toFixed(2)}€${body.reason ? ` — ${body.reason}` : ""}`,
          changedBy: userId,
        },
      });

      // Restock items if requested
      if (body.restockItems && isFullRefund) {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }
      }
    });

    return {
      success: true,
      data: {
        orderId: id,
        refundAmount,
        isFullRefund,
        stripeRefundId,
        restocked: body.restockItems && isFullRefund,
      },
    };
  });

  // ── POST /admin/orders/:id/notes — Add internal note to order ──
  app.post("/admin/orders/:id/notes", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const user = request.user;
    if (!isBackofficeRole(user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Backoffice access required" },
      });
    }

    const id = orderIdParamsSchema.parse(request.params).id;
    const body = z.object({
      note: z.string().min(1).max(2000),
    }).parse(request.body);

    const order = await app.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!order) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Commande introuvable" },
      });
    }

    const userId = user.id ?? user.userId;
    const entry = await app.prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        fromStatus: order.status,
        toStatus: order.status, // No status change — just a note
        note: body.note,
        changedBy: userId,
      },
    });

    return { success: true, data: entry };
  });

  // ── POST /admin/orders — Create manual order (in-store, phone) ──
  app.post("/admin/orders", async (request, reply) => {
    if (!requireAuth(request, reply)) return;
    const user = request.user;
    if (!isBackofficeRole(user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Backoffice access required" },
      });
    }

    const body = z.object({
      customerId: z.string().uuid(),
      items: z.array(z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().positive(),
      })).min(1),
      paymentMethod: z.enum(["CASH", "CHECK", "CARD", "BANK_TRANSFER"]),
      shippingMethod: z.enum(["DELIVERY", "STORE_PICKUP"]).default("STORE_PICKUP"),
      notes: z.string().max(1000).optional(),
    }).parse(request.body);

    // Validate customer exists
    const customer = await app.prisma.user.findUnique({
      where: { id: body.customerId },
      select: { id: true, status: true },
    });
    if (!customer || customer.status !== "ACTIVE") {
      return reply.status(404).send({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "Client introuvable ou inactif" },
      });
    }

    // Fetch products and variants
    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const variantIds = body.items.map((i) => i.variantId).filter((id): id is string => !!id);

    const [products, variants] = await Promise.all([
      app.prisma.product.findMany({ where: { id: { in: productIds }, status: "ACTIVE" } }),
      variantIds.length > 0
        ? app.prisma.productVariant.findMany({ where: { id: { in: variantIds }, isActive: true } })
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Build items and calculate totals
    const orderItems: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      unitPriceHt: typeof Decimal.prototype;
      tvaRate: typeof Decimal.prototype;
      totalHt: typeof Decimal.prototype;
    }> = [];

    for (const item of body.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return reply.status(400).send({
          success: false,
          error: { code: "PRODUCT_UNAVAILABLE", message: `Produit ${item.productId} introuvable` },
        });
      }

      const unitPriceHt = item.variantId && variantMap.get(item.variantId)?.priceOverride
        ? variantMap.get(item.variantId)!.priceOverride!
        : product.priceHt;

      orderItems.push({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPriceHt: new Decimal(unitPriceHt),
        tvaRate: product.tvaRate,
        totalHt: new Decimal(unitPriceHt).mul(item.quantity),
      });
    }

    const subtotalHt = orderItems.reduce((sum, i) => sum.add(i.totalHt), new Decimal(0));
    const tvaAmount = subtotalHt.mul(TVA_RATE).div(100);
    const shippingCost = body.shippingMethod === "STORE_PICKUP" ? new Decimal(0)
      : subtotalHt.gte(FREE_SHIPPING_THRESHOLD) ? new Decimal(0) : DEFAULT_SHIPPING_COST;
    const totalTtc = subtotalHt.add(tvaAmount).add(shippingCost);

    // Create order in transaction
    const userId = user.id ?? user.userId;
    const order = await app.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          customerId: body.customerId,
          status: "CONFIRMED", // Manual orders are confirmed immediately
          paymentMethod: body.paymentMethod,
          paymentStatus: body.paymentMethod === "BANK_TRANSFER" ? "PENDING" : "PAID",
          shippingMethod: body.shippingMethod,
          shippingAddress: {}, // Store pickup = no address needed
          billingAddress: {},
          subtotalHt,
          tvaAmount,
          shippingCost,
          totalTtc,
          notes: body.notes ? `[Commande manuelle] ${body.notes}` : "[Commande manuelle]",
          items: {
            create: orderItems.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              quantity: i.quantity,
              unitPriceHt: i.unitPriceHt,
              tvaRate: i.tvaRate,
              totalHt: i.totalHt,
            })),
          },
          statusHistory: {
            create: {
              fromStatus: "NEW",
              toStatus: "CONFIRMED",
              note: `Commande manuelle créée par ${user.email}`,
              changedBy: userId,
            },
          },
        },
        include: { items: true },
      });

      // Decrement stock
      for (const item of body.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }
      }

      return newOrder;
    });

    return reply.status(201).send({ success: true, data: order });
  });
}
