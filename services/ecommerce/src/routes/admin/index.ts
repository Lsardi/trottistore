import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../../plugins/auth";

// ─── Helpers ──────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Validation Schemas ──────────────────────────────────────

const createProductSchema = z.object({
  name: z.string().min(1).max(500),
  sku: z.string().min(1).max(100),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  brandId: z.string().uuid().optional().nullable(),
  priceHt: z.number().nonnegative(),
  tvaRate: z.number().min(0).max(100).default(20),
  weightGrams: z.number().int().nonnegative().optional().nullable(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).default("DRAFT"),
  isFeatured: z.boolean().default(false),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDesc: z.string().max(500).optional().nullable(),
  categories: z.array(z.string().uuid()).optional(),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        alt: z.string().max(300).optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  sku: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  priceHt: z.number().nonnegative().optional(),
  tvaRate: z.number().min(0).max(100).optional(),
  weightGrams: z.number().int().nonnegative().optional().nullable(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDesc: z.string().max(500).optional().nullable(),
  categories: z.array(z.string().uuid()).optional(),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        alt: z.string().max(300).optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .optional(),
});

const stockUpdateSchema = z.object({
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().nonnegative(),
});

const bulkPriceSchema = z.object({
  updates: z.array(
    z.object({
      productId: z.string().uuid(),
      priceHt: z.number().nonnegative(),
    })
  ),
});

const bulkStatusSchema = z.object({
  productIds: z.array(z.string().uuid()),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
});

// Full include for responses
const fullProductInclude = {
  brand: { select: { id: true, name: true, slug: true } },
  categories: {
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  },
  images: { orderBy: { position: "asc" as const } },
  variants: {
    where: { isActive: true },
    orderBy: { createdAt: "asc" as const },
  },
};

// ─── Admin Routes ────────────────────────────────────────────

export async function adminRoutes(app: FastifyInstance) {
  const adminOnly = {
    preHandler: [app.authenticate, requireRole("ADMIN")],
  };

  // ─── POST /admin/products — Create product ─────────────────
  app.post("/admin/products", adminOnly, async (request, reply) => {
    const parsed = createProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid product data",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { categories, images, ...productData } = parsed.data;
    const slug = slugify(productData.name);

    // Check unique slug
    const existingSlug = await app.prisma.product.findUnique({
      where: { slug },
    });
    const finalSlug = existingSlug
      ? `${slug}-${Date.now().toString(36)}`
      : slug;

    // Check unique SKU
    const existingSku = await app.prisma.product.findUnique({
      where: { sku: productData.sku },
    });
    if (existingSku) {
      return reply.status(409).send({
        success: false,
        error: {
          code: "DUPLICATE_SKU",
          message: `SKU '${productData.sku}' already exists`,
        },
      });
    }

    try {
      const product = await app.prisma.product.create({
        data: {
          ...productData,
          slug: finalSlug,
          // Create default variant
          variants: {
            create: {
              sku: `${productData.sku}-DEFAULT`,
              name: "Default",
              stockQuantity: 0,
            },
          },
          // Category associations
          ...(categories && categories.length > 0
            ? {
                categories: {
                  create: categories.map((categoryId) => ({
                    categoryId,
                  })),
                },
              }
            : {}),
          // Images
          ...(images && images.length > 0
            ? {
                images: {
                  create: images.map((img, index) => ({
                    url: img.url,
                    alt: img.alt || null,
                    position: index,
                    isPrimary: img.isPrimary ?? index === 0,
                  })),
                },
              }
            : {}),
        },
        include: fullProductInclude,
      });

      return reply.status(201).send({ success: true, data: product });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: {
          code: "CREATE_FAILED",
          message: "Failed to create product",
        },
      });
    }
  });

  // ─── PUT /admin/products/:id — Update product ─────────────
  app.put("/admin/products/:id", adminOnly, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid update data",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    // Verify product exists
    const existing = await app.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Product not found" },
      });
    }

    const { categories, images, ...updateData } = parsed.data;

    // Re-slug if name changed
    if (updateData.name && updateData.name !== existing.name) {
      const newSlug = slugify(updateData.name);
      const slugTaken = await app.prisma.product.findFirst({
        where: { slug: newSlug, id: { not: id } },
      });
      (updateData as any).slug = slugTaken
        ? `${newSlug}-${Date.now().toString(36)}`
        : newSlug;
    }

    // Check SKU uniqueness if changed
    if (updateData.sku && updateData.sku !== existing.sku) {
      const skuTaken = await app.prisma.product.findFirst({
        where: { sku: updateData.sku, id: { not: id } },
      });
      if (skuTaken) {
        return reply.status(409).send({
          success: false,
          error: {
            code: "DUPLICATE_SKU",
            message: `SKU '${updateData.sku}' already exists`,
          },
        });
      }
    }

    try {
      // Transaction: update product + categories + images
      const product = await app.prisma.$transaction(async (tx) => {
        // Replace categories if provided
        if (categories !== undefined) {
          await tx.productCategory.deleteMany({ where: { productId: id } });
          if (categories.length > 0) {
            await tx.productCategory.createMany({
              data: categories.map((categoryId) => ({
                productId: id,
                categoryId,
              })),
            });
          }
        }

        // Replace images if provided
        if (images !== undefined) {
          await tx.productImage.deleteMany({ where: { productId: id } });
          if (images.length > 0) {
            await tx.productImage.createMany({
              data: images.map((img, index) => ({
                productId: id,
                url: img.url,
                alt: img.alt || null,
                position: index,
                isPrimary: img.isPrimary ?? index === 0,
              })),
            });
          }
        }

        // Update product fields
        return tx.product.update({
          where: { id },
          data: updateData,
          include: fullProductInclude,
        });
      });

      return { success: true, data: product };
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: { code: "UPDATE_FAILED", message: "Failed to update product" },
      });
    }
  });

  // ─── DELETE /admin/products/:id — Delete / Archive product ─
  app.delete("/admin/products/:id", adminOnly, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { hard } = (request.query as { hard?: string }) || {};

    const existing = await app.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Product not found" },
      });
    }

    try {
      if (hard === "true") {
        // Hard delete — cascades through relations
        await app.prisma.product.delete({ where: { id } });
        return { success: true, message: "Product permanently deleted" };
      } else {
        // Soft delete — archive
        await app.prisma.product.update({
          where: { id },
          data: { status: "ARCHIVED" },
        });
        return { success: true, message: "Product archived" };
      }
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: { code: "DELETE_FAILED", message: "Failed to delete product" },
      });
    }
  });

  // ─── PATCH /admin/products/:id/stock — Quick stock update ──
  app.patch(
    "/admin/products/:id/stock",
    adminOnly,
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = stockUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid stock data",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { variantId, quantity } = parsed.data;

    try {
      let variant;
      if (variantId) {
        // Update specific variant
        variant = await app.prisma.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: quantity },
        });
      } else {
        // Update the default (first) variant
        const defaultVariant = await app.prisma.productVariant.findFirst({
          where: { productId: id, isActive: true },
          orderBy: { createdAt: "asc" },
        });
        if (!defaultVariant) {
          return reply.status(404).send({
            success: false,
            error: {
              code: "NO_VARIANT",
              message: "No active variant found for this product",
            },
          });
        }
        variant = await app.prisma.productVariant.update({
          where: { id: defaultVariant.id },
          data: { stockQuantity: quantity },
        });
      }

      return { success: true, data: variant };
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: {
          code: "STOCK_UPDATE_FAILED",
          message: "Failed to update stock",
        },
      });
    }
  });

  // ─── PATCH /admin/products/bulk-price — Bulk price update ──
  app.patch("/admin/products/bulk-price", adminOnly, async (request, reply) => {
    const parsed = bulkPriceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid bulk price data",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    try {
      const results = await app.prisma.$transaction(
        parsed.data.updates.map((u) =>
          app.prisma.product.update({
            where: { id: u.productId },
            data: { priceHt: u.priceHt },
          })
        )
      );

      return { success: true, data: { updatedCount: results.length } };
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: {
          code: "BULK_UPDATE_FAILED",
          message: "Failed to update prices",
        },
      });
    }
  });

  // ─── PATCH /admin/products/bulk-status — Bulk status update ─
  app.patch("/admin/products/bulk-status", adminOnly, async (request, reply) => {
    const parsed = bulkStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid bulk status data",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    try {
      const result = await app.prisma.product.updateMany({
        where: { id: { in: parsed.data.productIds } },
        data: { status: parsed.data.status },
      });

      return { success: true, data: { updatedCount: result.count } };
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: {
          code: "BULK_UPDATE_FAILED",
          message: "Failed to update statuses",
        },
      });
    }
  });

  // ─── GET /admin/products/:id — Get single product for editing
  app.get("/admin/products/:id", adminOnly, async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await app.prisma.product.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
        categories: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!product) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Product not found" },
      });
    }

    return { success: true, data: product };
  });

  // ─── POST /admin/products/:id/duplicate — Duplicate product ─
  app.post(
    "/admin/products/:id/duplicate",
    adminOnly,
    async (request, reply) => {
    const { id } = request.params as { id: string };

    const source = await app.prisma.product.findUnique({
      where: { id },
      include: {
        categories: true,
        images: { orderBy: { position: "asc" } },
        variants: { where: { isActive: true } },
      },
    });

    if (!source) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Source product not found" },
      });
    }

    const timestamp = Date.now().toString(36);
    const newSku = `${source.sku}-COPY-${timestamp}`;
    const newSlug = `${source.slug}-copy-${timestamp}`;

    try {
      const product = await app.prisma.product.create({
        data: {
          name: `${source.name} (copie)`,
          sku: newSku,
          slug: newSlug,
          description: source.description,
          shortDescription: source.shortDescription,
          brandId: source.brandId,
          priceHt: source.priceHt,
          tvaRate: source.tvaRate,
          weightGrams: source.weightGrams,
          status: "DRAFT",
          isFeatured: false,
          metaTitle: source.metaTitle,
          metaDesc: source.metaDesc,
          categories: {
            create: source.categories.map((c) => ({
              categoryId: c.categoryId,
            })),
          },
          images: {
            create: source.images.map((img, idx) => ({
              url: img.url,
              alt: img.alt,
              position: idx,
              isPrimary: img.isPrimary,
            })),
          },
          variants: {
            create: source.variants.map((v) => ({
              sku: `${v.sku}-COPY-${timestamp}`,
              name: v.name,
              priceOverride: v.priceOverride,
              stockQuantity: 0,
              attributes: v.attributes || undefined,
            })),
          },
        },
        include: fullProductInclude,
      });

      return reply.status(201).send({ success: true, data: product });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({
        success: false,
        error: {
          code: "DUPLICATE_FAILED",
          message: "Failed to duplicate product",
        },
      });
    }
  });
}
