import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { parseIdParam } from "@trottistore/shared";

const addressSchema = z.object({
  type: z.enum(["SHIPPING", "BILLING"]).default("SHIPPING"),
  label: z.string().max(100).optional(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  company: z.string().max(200).optional(),
  street: z.string().trim().min(1).max(500),
  street2: z.string().max(500).optional(),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(10),
  country: z.string().length(2).default("FR"),
  phone: z.string().max(20).optional(),
  isDefault: z.boolean().default(false),
});

type UserPayload = { id?: string; userId?: string; role?: string };

function getUserId(request: FastifyRequest): string | null {
  const user = request.user as UserPayload | undefined;
  return user?.id ?? user?.userId ?? null;
}

export async function addressRoutes(app: FastifyInstance) {
  // All address routes require authentication
  app.addHook("onRequest", async (request, reply) => {
    await app.authenticate(request, reply);
  });

  // GET /addresses — list user's addresses
  app.get("/addresses", async (request) => {
    const userId = getUserId(request)!;
    const addresses = await app.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return { success: true, data: addresses };
  });

  // POST /addresses — create address
  app.post("/addresses", async (request, reply) => {
    const userId = getUserId(request)!;
    const parsed = addressSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Donnees adresse invalides",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const data = parsed.data;

    // If setting as default, unset other defaults of same type
    if (data.isDefault) {
      await app.prisma.address.updateMany({
        where: { userId, type: data.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await app.prisma.address.create({
      data: {
        userId,
        type: data.type,
        label: data.label ?? null,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company ?? null,
        street: data.street,
        street2: data.street2 ?? null,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country,
        phone: data.phone ?? null,
        isDefault: data.isDefault,
      },
    });

    return reply.status(201).send({ success: true, data: address });
  });

  // PUT /addresses/:id — update address
  app.put("/addresses/:id", async (request, reply) => {
    const userId = getUserId(request)!;
    const id = parseIdParam(request.params);

    const existing = await app.prisma.address.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Adresse introuvable" },
      });
    }

    const parsed = addressSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Donnees adresse invalides",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Aucun champ a mettre a jour",
        },
      });
    }

    const nextType = data.type ?? existing.type;
    const nextIsDefault = data.isDefault ?? existing.isDefault;
    const shouldUnsetCurrentDefault =
      nextIsDefault &&
      (data.isDefault === true ||
        (existing.isDefault && data.type !== undefined && data.type !== existing.type));

    if (shouldUnsetCurrentDefault) {
      await app.prisma.address.updateMany({
        where: { userId, type: nextType, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await app.prisma.address.update({
      where: { id },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.label !== undefined && { label: data.label ?? null }),
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.company !== undefined && { company: data.company ?? null }),
        ...(data.street !== undefined && { street: data.street }),
        ...(data.street2 !== undefined && { street2: data.street2 ?? null }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.phone !== undefined && { phone: data.phone ?? null }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });

    return { success: true, data: updated };
  });

  // DELETE /addresses/:id — delete address
  app.delete("/addresses/:id", async (request, reply) => {
    const userId = getUserId(request)!;
    const id = parseIdParam(request.params);

    const existing = await app.prisma.address.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Adresse introuvable" },
      });
    }

    await app.prisma.address.delete({ where: { id } });
    return { success: true, message: "Adresse supprimee" };
  });
}
