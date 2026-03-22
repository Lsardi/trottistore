import type { FastifyInstance } from "fastify";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  brand: z.string().optional(),
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  sort: z.enum(["price_asc", "price_desc", "newest", "name"]).default("newest"),
});

export async function productRoutes(app: FastifyInstance) {
  // GET /api/v1/products — Liste paginée
  app.get("/products", async (request, reply) => {
    const query = querySchema.parse(request.query);
    const { page, limit, category, brand, search, status, sort } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    else where.status = "ACTIVE";
    if (brand) where.brand = { slug: brand };
    if (category) where.categories = { some: { category: { slug: category } } };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, string> = {};
    switch (sort) {
      case "price_asc": orderBy.priceHt = "asc"; break;
      case "price_desc": orderBy.priceHt = "desc"; break;
      case "name": orderBy.name = "asc"; break;
      default: orderBy.createdAt = "desc";
    }

    const [products, total] = await Promise.all([
      app.prisma.product.findMany({
        where: where as any,
        include: {
          brand: { select: { id: true, name: true, slug: true } },
          categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
          images: { where: { isPrimary: true }, take: 1 },
          variants: { select: { id: true, sku: true, name: true, stockQuantity: true, priceOverride: true } },
        },
        orderBy: orderBy as any,
        skip,
        take: limit,
      }),
      app.prisma.product.count({ where: where as any }),
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

  // GET /api/v1/products/:slug — Détail produit
  app.get("/products/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const product = await app.prisma.product.findUnique({
      where: { slug },
      include: {
        brand: true,
        categories: { include: { category: true } },
        images: { orderBy: { position: "asc" } },
        variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!product) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: `Produit '${slug}' introuvable` },
      });
    }

    return { success: true, data: product };
  });

  // GET /api/v1/categories — Arbre des catégories
  app.get("/categories", async () => {
    const categories = await app.prisma.category.findMany({
      where: { isActive: true },
      include: {
        children: { where: { isActive: true }, orderBy: { position: "asc" } },
        _count: { select: { products: true } },
      },
      orderBy: { position: "asc" },
    });

    // Filtrer les racines (parentId = null)
    const roots = categories.filter((c) => c.parentId === null);

    return { success: true, data: roots };
  });
}
