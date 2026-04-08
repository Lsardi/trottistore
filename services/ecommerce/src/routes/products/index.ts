import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseSlugParam } from "@trottistore/shared";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categorySlug: z.string().optional(),
  brandSlug: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  inStock: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  sort: z
    .enum(["price_asc", "price_desc", "newest", "name"])
    .default("newest"),
});

export async function productRoutes(app: FastifyInstance) {
  // ─── GET /products — Paginated list with filters ───────────
  app.get("/products", async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: query.error.flatten().fieldErrors,
        },
      });
    }

    const {
      page,
      limit,
      categorySlug,
      brandSlug,
      search,
      minPrice,
      maxPrice,
      inStock,
      status,
      sort,
    } = query.data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: {
      status: "ACTIVE" | "DRAFT" | "ARCHIVED";
      brand?: { slug: string };
      categories?: {
        some: { category: { slug: string } };
      };
      OR?: Array<{
        name?: { contains: string; mode: "insensitive" };
        sku?: { contains: string; mode: "insensitive" };
        description?: { contains: string; mode: "insensitive" };
      }>;
      priceHt?: {
        gte?: number;
        lte?: number;
      };
      variants?: {
        some: {
          isActive: true;
          stockQuantity: { gt: number };
        };
      };
    } = {
      status: status ?? "ACTIVE",
    };

    // Status filter (defaults to ACTIVE for public)
    where.status = status ?? "ACTIVE";

    // Brand filter
    if (brandSlug) {
      where.brand = { slug: brandSlug };
    }

    // Category filter
    if (categorySlug) {
      where.categories = {
        some: { category: { slug: categorySlug } },
      };
    }

    // Full-text search on name, sku, description
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Price range filters
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.priceHt = {};
      if (minPrice !== undefined) {
        where.priceHt.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.priceHt.lte = maxPrice;
      }
    }

    // In-stock filter: at least one variant with available stock
    if (inStock === true) {
      where.variants = {
        some: {
          isActive: true,
          stockQuantity: { gt: 0 },
        },
      };
    }

    // Sort
    let orderBy:
      | { priceHt: "asc" }
      | { priceHt: "desc" }
      | { name: "asc" }
      | { createdAt: "desc" };
    switch (sort) {
      case "price_asc":
        orderBy = { priceHt: "asc" };
        break;
      case "price_desc":
        orderBy = { priceHt: "desc" };
        break;
      case "name":
        orderBy = { name: "asc" };
        break;
      default:
        orderBy = { createdAt: "desc" };
    }

    const [products, total] = await Promise.all([
      app.prisma.product.findMany({
        where,
        include: {
          brand: { select: { id: true, name: true, slug: true } },
          categories: {
            include: {
              category: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { id: true, url: true, alt: true },
          },
          variants: {
            where: { isActive: true },
            take: 1,
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              sku: true,
              name: true,
              stockQuantity: true,
              stockReserved: true,
              priceOverride: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      app.prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: products,
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

  // ─── GET /products/featured — Featured products ────────────
  app.get("/products/featured", async (_request, _reply) => {
    const products = await app.prisma.product.findMany({
      where: {
        isFeatured: true,
        status: "ACTIVE",
      },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
        categories: {
          include: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { id: true, url: true, alt: true },
        },
        variants: {
          where: { isActive: true },
          take: 1,
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            sku: true,
            name: true,
            stockQuantity: true,
            stockReserved: true,
            priceOverride: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    return { success: true, data: products };
  });

  // ─── GET /products/:slug — Product detail ──────────────────
  app.get("/products/:slug", async (request, reply) => {
    const slug = parseSlugParam(request.params);

    const product = await app.prisma.product.findUnique({
      where: { slug },
      include: {
        brand: true,
        categories: {
          include: { category: true },
        },
        images: { orderBy: { position: "asc" } },
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!product) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Product '${slug}' not found`,
        },
      });
    }

    return { success: true, data: product };
  });
}
