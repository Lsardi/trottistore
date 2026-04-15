import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseProductIdParam } from "@trottistore/shared";

// ─── Types ───────────────────────────────────────────────────

interface CartItem {
  productId: string;
  variantId: string | null;
  quantity: number;
}

interface Cart {
  items: CartItem[];
  updatedAt: string;
  // Applied discount code, if any. The amount is computed server-side at
  // each /cart read so stale percentages can't leak through — only the
  // code identifier is persisted in Redis.
  discountCode?: string;
}

// ─── Schemas ─────────────────────────────────────────────────

const addItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive().max(99),
});

const updateItemSchema = z.object({
  quantity: z.number().int().min(0).max(99),
});

// ─── Helpers ─────────────────────────────────────────────────

interface RequestUser {
  id: string;
  userId: string;
}

function getRequestUser(request: FastifyRequest): RequestUser | null {
  const maybeUser = request.user as Partial<RequestUser> | undefined;
  if (!maybeUser) return null;
  if (typeof maybeUser.id !== "string" || typeof maybeUser.userId !== "string") {
    return null;
  }
  return { id: maybeUser.id, userId: maybeUser.userId };
}

function getCartKey(request: FastifyRequest): string {
  const user = getRequestUser(request);
  const userId = user?.id ?? user?.userId;
  if (userId) return `cart:${userId}`;
  // Fallback to session-based cart for unauthenticated users
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

async function getCart(app: FastifyInstance, key: string): Promise<Cart> {
  const raw = await app.redis.get(key);
  if (!raw) return { items: [], updatedAt: new Date().toISOString() };
  try {
    return JSON.parse(raw) as Cart;
  } catch {
    return { items: [], updatedAt: new Date().toISOString() };
  }
}

async function saveCart(
  app: FastifyInstance,
  key: string,
  cart: Cart
): Promise<void> {
  cart.updatedAt = new Date().toISOString();
  // TTL 7 days
  await app.redis.set(key, JSON.stringify(cart), "EX", 60 * 60 * 24 * 7);
}

// Look up a discount code, validate its window and min cart, and return
// either the applicable discount amount in € HT or null if the code
// doesn't apply right now. Never throws — a stale/invalid code on the
// cart just silently resolves to no discount.
async function resolveCartDiscount(
  app: FastifyInstance,
  code: string | undefined,
  subtotalHt: number,
): Promise<{
  code: string;
  label: string | null;
  kind: "PERCENT" | "FIXED";
  value: number;
  amount: number;
} | null> {
  if (!code) return null;
  const record = await app.prisma.discountCode.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!record) return null;
  if (!record.isActive) return null;
  const now = new Date();
  if (record.startsAt && record.startsAt > now) return null;
  if (record.expiresAt && record.expiresAt < now) return null;
  if (record.maxUses != null && record.usedCount >= record.maxUses) return null;
  if (record.minCartHt != null && subtotalHt < Number(record.minCartHt)) return null;
  const value = Number(record.value);
  let amount = 0;
  if (record.kind === "PERCENT") {
    amount = (subtotalHt * value) / 100;
  } else {
    amount = value;
  }
  // Clamp to the cart subtotal so a €50 code on a €30 cart still just
  // zeros the line and never produces a negative total.
  if (amount > subtotalHt) amount = subtotalHt;
  amount = Math.round(amount * 100) / 100;
  return {
    code: record.code,
    label: record.label,
    kind: record.kind as "PERCENT" | "FIXED",
    value,
    amount,
  };
}

async function enrichCartItems(app: FastifyInstance, cart: Cart) {
  if (cart.items.length === 0) return { items: [], totalHt: 0 };

  const productIds = [...new Set(cart.items.map((i) => i.productId))];
  const variantIds = cart.items
    .map((i) => i.variantId)
    .filter((id): id is string => id !== null);

  const [products, variants] = await Promise.all([
    app.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, alt: true },
        },
      },
    }),
    variantIds.length > 0
      ? app.prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
        })
      : Promise.resolve([]),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  let totalHt = 0;

  const enrichedItems = cart.items.map((item) => {
    const product = productMap.get(item.productId);
    const variant = item.variantId
      ? variantMap.get(item.variantId)
      : null;

    if (!product) {
      return { ...item, _removed: true };
    }

    const unitPriceHt = variant?.priceOverride
      ? Number(variant.priceOverride)
      : Number(product.priceHt);
    const lineTotalHt = unitPriceHt * item.quantity;
    totalHt += lineTotalHt;

    const availableStock = variant
      ? variant.stockQuantity - variant.stockReserved
      : null;

    return {
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      product: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        image: product.images[0] ?? null,
      },
      variant: variant
        ? {
            name: variant.name,
            sku: variant.sku,
            attributes: variant.attributes,
          }
        : null,
      unitPriceHt,
      lineTotalHt,
      availableStock,
    };
  });

  return { items: enrichedItems, totalHt };
}

// ─── Routes ──────────────────────────────────────────────────

export async function cartRoutes(app: FastifyInstance) {
  // Try to decode JWT if present (optional auth — anonymous carts still work)
  app.addHook("onRequest", async (request) => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const decoded = app.jwt.verify(token) as { sub: string; email: string; role: string };
        (request as unknown as { user: { id: string; userId: string } }).user = {
          id: decoded.sub,
          userId: decoded.sub,
        };
      } catch {
        // Invalid token — proceed as anonymous
      }
    }
  });

  // GET /cart — current cart with enriched product data
  app.get("/cart", async (request, reply) => {
    const key = getCartKey(request);
    const cart = await getCart(app, key);
    const enriched = await enrichCartItems(app, cart);
    const discount = await resolveCartDiscount(app, cart.discountCode, enriched.totalHt);
    // If a previously-applied code no longer resolves (expired, deactivated,
    // cart now below min), silently drop it from Redis so the client sees
    // consistent state.
    if (cart.discountCode && !discount) {
      cart.discountCode = undefined;
      await saveCart(app, key, cart);
    }
    const totalAfterDiscount = discount
      ? Math.max(0, enriched.totalHt - discount.amount)
      : enriched.totalHt;

    return {
      success: true,
      data: {
        items: enriched.items,
        itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
        subtotalHt: enriched.totalHt,
        totalHt: totalAfterDiscount,
        discount,
        updatedAt: cart.updatedAt,
      },
    };
  });

  // POST /cart/items — add item to cart
  app.post("/cart/items", async (request, reply) => {
    const parsed = addItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { productId, variantId, quantity } = parsed.data;

    // Validate product exists and is active
    const product = await app.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    });

    if (!product || product.status !== "ACTIVE") {
      return reply.status(404).send({
        success: false,
        error: { code: "PRODUCT_NOT_FOUND", message: "Product not found or not available" },
      });
    }

    // Validate variant exists and check stock
    if (variantId) {
      const variant = await app.prisma.productVariant.findUnique({
        where: { id: variantId },
        select: {
          id: true,
          productId: true,
          isActive: true,
          stockQuantity: true,
          stockReserved: true,
        },
      });

      if (!variant || variant.productId !== productId || !variant.isActive) {
        return reply.status(404).send({
          success: false,
          error: { code: "VARIANT_NOT_FOUND", message: "Variant not found or not active" },
        });
      }

      const available = variant.stockQuantity - variant.stockReserved;
      if (available < quantity) {
        return reply.status(409).send({
          success: false,
          error: {
            code: "INSUFFICIENT_STOCK",
            message: `Only ${available} units available`,
            availableStock: available,
          },
        });
      }
    }

    const key = getCartKey(request);
    const cart = await getCart(app, key);

    // Add or update item
    const existingIdx = cart.items.findIndex(
      (i) =>
        i.productId === productId &&
        (i.variantId ?? null) === (variantId ?? null)
    );

    if (existingIdx >= 0) {
      cart.items[existingIdx].quantity += quantity;
    } else {
      cart.items.push({
        productId,
        variantId: variantId ?? null,
        quantity,
      });
    }

    await saveCart(app, key, cart);
    const enriched = await enrichCartItems(app, cart);

    return {
      success: true,
      data: {
        items: enriched.items,
        itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
        totalHt: enriched.totalHt,
        updatedAt: cart.updatedAt,
      },
    };
  });

  // PUT /cart/items/:productId — update item quantity
  app.put("/cart/items/:productId", async (request, reply) => {
    const productId = parseProductIdParam(request.params);
    const parsed = updateItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { quantity } = parsed.data;
    const key = getCartKey(request);
    const cart = await getCart(app, key);

    if (quantity === 0) {
      // Remove item
      cart.items = cart.items.filter((i) => i.productId !== productId);
    } else {
      const existingIdx = cart.items.findIndex(
        (i) => i.productId === productId
      );
      if (existingIdx < 0) {
        return reply.status(404).send({
          success: false,
          error: { code: "ITEM_NOT_FOUND", message: "Item not in cart" },
        });
      }

      // Validate stock for new quantity
      const item = cart.items[existingIdx];
      if (item.variantId) {
        const variant = await app.prisma.productVariant.findUnique({
          where: { id: item.variantId },
          select: { stockQuantity: true, stockReserved: true },
        });
        if (variant) {
          const available = variant.stockQuantity - variant.stockReserved;
          if (available < quantity) {
            return reply.status(409).send({
              success: false,
              error: {
                code: "INSUFFICIENT_STOCK",
                message: `Only ${available} units available`,
                availableStock: available,
              },
            });
          }
        }
      }

      cart.items[existingIdx].quantity = quantity;
    }

    await saveCart(app, key, cart);
    const enriched = await enrichCartItems(app, cart);

    return {
      success: true,
      data: {
        items: enriched.items,
        itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
        totalHt: enriched.totalHt,
        updatedAt: cart.updatedAt,
      },
    };
  });

  // DELETE /cart/items/:productId — remove item from cart
  app.delete("/cart/items/:productId", async (request, reply) => {
    const productId = parseProductIdParam(request.params);
    const key = getCartKey(request);
    const cart = await getCart(app, key);

    const before = cart.items.length;
    cart.items = cart.items.filter((i) => i.productId !== productId);

    if (cart.items.length === before) {
      return reply.status(404).send({
        success: false,
        error: { code: "ITEM_NOT_FOUND", message: "Item not in cart" },
      });
    }

    await saveCart(app, key, cart);
    const enriched = await enrichCartItems(app, cart);

    return {
      success: true,
      data: {
        items: enriched.items,
        itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
        totalHt: enriched.totalHt,
        updatedAt: cart.updatedAt,
      },
    };
  });

  // DELETE /cart — clear entire cart
  app.delete("/cart", async (request, _reply) => {
    const key = getCartKey(request);
    await app.redis.del(key);

    return {
      success: true,
      data: { items: [], itemCount: 0, totalHt: 0, updatedAt: new Date().toISOString() },
    };
  });

  // ─── POST /cart/discount — apply a discount code to the current cart
  // Validates the code against the current cart subtotal and returns the
  // resolved discount. Stores only the code identifier in Redis; the
  // amount is recomputed at every /cart read so stale percentages can't
  // be exploited by clients replaying old responses.
  const applyDiscountSchema = z.object({
    code: z.string().trim().min(1).max(50),
  });

  app.post("/cart/discount", async (request, reply) => {
    const parsed = applyDiscountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Code manquant",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }
    const key = getCartKey(request);
    const cart = await getCart(app, key);
    if (cart.items.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: "EMPTY_CART", message: "Ton panier est vide." },
      });
    }
    const enriched = await enrichCartItems(app, cart);
    const discount = await resolveCartDiscount(app, parsed.data.code, enriched.totalHt);
    if (!discount) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "INVALID_DISCOUNT",
          message: "Code invalide, expiré ou non applicable à ce panier.",
        },
      });
    }
    cart.discountCode = discount.code;
    await saveCart(app, key, cart);
    return {
      success: true,
      data: {
        discount,
        subtotalHt: enriched.totalHt,
        totalHt: Math.max(0, enriched.totalHt - discount.amount),
      },
    };
  });

  // DELETE /cart/discount — detach any applied code without touching items.
  app.delete("/cart/discount", async (request) => {
    const key = getCartKey(request);
    const cart = await getCart(app, key);
    if (cart.discountCode) {
      cart.discountCode = undefined;
      await saveCart(app, key, cart);
    }
    const enriched = await enrichCartItems(app, cart);
    return {
      success: true,
      data: {
        discount: null,
        subtotalHt: enriched.totalHt,
        totalHt: enriched.totalHt,
      },
    };
  });
}
