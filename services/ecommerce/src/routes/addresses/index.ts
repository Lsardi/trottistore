import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

const addressTypeSchema = z.enum(["SHIPPING", "BILLING"]);

const baseAddressSchema = z.object({
  type: addressTypeSchema.default("SHIPPING"),
  label: z.string().max(100).trim().optional(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  company: z.string().max(200).trim().optional(),
  street: z.string().min(1).max(500).trim(),
  street2: z.string().max(500).trim().optional(),
  city: z.string().min(1).max(100).trim(),
  postalCode: z.string().min(2).max(10).trim(),
  country: z.literal("FR").default("FR"),
  phone: z.string().max(20).trim().optional(),
  isDefault: z.boolean().optional().default(false),
});

const createAddressSchema = baseAddressSchema;

const updateAddressSchema = baseAddressSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Aucune donnée à mettre à jour",
  );

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RequestUser = {
  id?: string;
  userId?: string;
};

function getUserId(request: FastifyRequest): string | null {
  const user = request.user as RequestUser | undefined;
  return user?.id ?? user?.userId ?? null;
}

export async function addressRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    await app.authenticate(request, reply);
  });

  app.post("/addresses", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentification requise" },
      });
    }

    const parsed = createAddressSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Données d'adresse invalides",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const data = parsed.data;

    const created = await app.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.address.updateMany({
          where: {
            userId,
            type: data.type,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
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
    });

    return reply.status(201).send({ success: true, data: created });
  });

  app.get("/addresses", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentification requise" },
      });
    }

    const addresses = await app.prisma.address.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { isDefault: "desc" }, { createdAt: "desc" }],
    });

    return reply.send({ success: true, data: addresses });
  });

  app.put("/addresses/:id", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentification requise" },
      });
    }

    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Identifiant d'adresse invalide",
          details: params.error.flatten().fieldErrors,
        },
      });
    }

    const parsed = updateAddressSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Données d'adresse invalides",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const existing = await app.prisma.address.findFirst({
      where: { id: params.data.id, userId },
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Adresse introuvable" },
      });
    }

    const input = parsed.data;
    const nextType = input.type ?? existing.type;

    const updated = await app.prisma.$transaction(async (tx) => {
      if (input.isDefault === true) {
        await tx.address.updateMany({
          where: {
            userId,
            type: nextType,
            isDefault: true,
            id: { not: existing.id },
          },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: existing.id },
        data: {
          type: input.type,
          label: input.label,
          firstName: input.firstName,
          lastName: input.lastName,
          company: input.company,
          street: input.street,
          street2: input.street2,
          city: input.city,
          postalCode: input.postalCode,
          country: input.country,
          phone: input.phone,
          isDefault: input.isDefault,
        },
      });
    });

    return reply.send({ success: true, data: updated });
  });

  app.delete("/addresses/:id", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentification requise" },
      });
    }

    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Identifiant d'adresse invalide",
          details: params.error.flatten().fieldErrors,
        },
      });
    }

    const existing = await app.prisma.address.findFirst({
      where: { id: params.data.id, userId },
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Adresse introuvable" },
      });
    }

    await app.prisma.address.delete({ where: { id: existing.id } });

    return reply.send({ success: true, data: { id: existing.id } });
  });
}
