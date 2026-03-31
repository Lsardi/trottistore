import type { FastifyInstance } from "fastify";
import { z } from "zod";

const proLeadBodySchema = z.object({
  company: z.string().trim().min(2).max(200),
  contact: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  fleetSize: z.string().trim().max(50).optional().or(z.literal("")),
  message: z.string().trim().max(5000).optional().or(z.literal("")),
});

const stockAlertBodySchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  email: z.string().trim().email().max(255),
});

export async function leadRoutes(app: FastifyInstance) {
  // POST /leads/pro — capture demande devis B2B
  app.post("/leads/pro", async (request, reply) => {
    const parsed = proLeadBodySchema.safeParse(request.body);
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

    const payload = parsed.data;
    const lead = await app.prisma.proLead.create({
      data: {
        company: payload.company,
        contactName: payload.contact,
        email: payload.email.toLowerCase(),
        phone: payload.phone || null,
        fleetSize: payload.fleetSize || null,
        message: payload.message || null,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: lead,
    };
  });

  // POST /stock-alerts — alerte retour en stock (idempotent)
  app.post("/stock-alerts", async (request, reply) => {
    const parsed = stockAlertBodySchema.safeParse(request.body);
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

    const { productId, variantId, email } = parsed.data;

    const product = await app.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    });
    if (!product || product.status !== "ACTIVE") {
      return reply.status(404).send({
        success: false,
        error: {
          code: "PRODUCT_NOT_FOUND",
          message: "Product not found or not available",
        },
      });
    }

    if (variantId) {
      const variant = await app.prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, isActive: true },
      });
      if (!variant || variant.productId !== productId || !variant.isActive) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "VARIANT_NOT_FOUND",
            message: "Variant not found or not active",
          },
        });
      }
    }

    const alert = await app.prisma.stockAlert.upsert({
      where: {
        productId_email: {
          productId,
          email: email.toLowerCase(),
        },
      },
      create: {
        productId,
        variantId: variantId ?? null,
        email: email.toLowerCase(),
        status: "ACTIVE",
      },
      update: {
        variantId: variantId ?? null,
        status: "ACTIVE",
        notifiedAt: null,
      },
      select: {
        id: true,
        productId: true,
        variantId: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: alert,
    };
  });
}
