import type { FastifyInstance } from "fastify";
import { z } from "zod";

const categoryProductsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(["price_asc", "price_desc", "newest", "name"])
    .default("newest"),
});

export async function categoryRoutes(app: FastifyInstance) {
  // GET /categories — Category tree with product counts
  app.get("/categories", async (_request, _reply) => {
    const categories = await app.prisma.category.findMany({
      where: { isActive: true },
      include: {
        children: {
          where: { isActive: true },
          include: {
            _count: {
              select: { products: true },
            },
          },
          orderBy: { position: "asc" },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: { position: "asc" },
    });

    // Build tree: only return root categories (parentId === null)
    // Children are already included via the relation
    const roots = categories
      .filter((c) => c.parentId === null)
      .map((root) => ({
        id: root.id,
        name: root.name,
        slug: root.slug,
        description: root.description,
        imageUrl: root.imageUrl,
        position: root.position,
        productCount: root._count.products,
        children: root.children.map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          description: child.description,
          imageUrl: child.imageUrl,
          position: child.position,
          productCount: child._count.products,
        })),
      }));

    return { success: true, data: roots };
  });

  // GET /categories/:slug — Category detail with paginated products
  app.get("/categories/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parsed = categoryProductsSchema.safeParse(request.query);
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

    const { page, limit, sort } = parsed.data;
    const skip = (page - 1) * limit;

    // Find the category
    const category = await app.prisma.category.findUnique({
      where: { slug },
      include: {
        children: {
          where: { isActive: true },
          select: { id: true, name: true, slug: true, imageUrl: true },
          orderBy: { position: "asc" },
        },
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!category || !category.isActive) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Category '${slug}' not found`,
        },
      });
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

    // Fetch products in this category
    const productWhere = {
      status: "ACTIVE" as const,
      categories: {
        some: { categoryId: category.id },
      },
    };

    const [products, total] = await Promise.all([
      app.prisma.product.findMany({
        where: productWhere,
        include: {
          brand: { select: { id: true, name: true, slug: true } },
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
      app.prisma.product.count({ where: productWhere }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          imageUrl: category.imageUrl,
          metaTitle: category.metaTitle,
          metaDesc: category.metaDesc,
          parent: category.parent,
          children: category.children,
        },
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    };
  });
}
