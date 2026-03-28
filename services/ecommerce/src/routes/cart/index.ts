import type { FastifyInstance } from "fastify";
import { z } from "zod";

// ─── Types ───────────────────────────────────────────────────

interface CartItem {
  productId: string;
  variantId: string | null;
  quantity: number;
}

interface Cart {
  items: CartItem[];
  updatedAt: string;
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

function getCartKey(request: any): string {
  const user = (request as any).user;
  const userId = user?.id ?? user?.userId;
  if (userId) return `cart:${userId}`;
  // Fallback to session-based cart for unauthenticated users
  const sessionId =
    (request.headers["x-session-id"] as string) ??
    (request.cookies?.sessionId as string | undefined);
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
  // GET /cart — current cart with enriched product data
  app.get("/cart", async (request, reply) => {
    const key = getCartKey(request);
    const cart = await getCart(app, key);
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
    const { productId } = request.params as { productId: string };
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
    const { productId } = request.params as { productId: string };
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
}
