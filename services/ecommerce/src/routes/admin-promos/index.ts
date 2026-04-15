// Admin discount codes — MVP scope: create, list, edit, delete.
// The public checkout side will land in a follow-up once the admin
// data is populated.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../../plugins/auth.js";

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, "Code must be uppercase letters, digits, _ or -")
    .transform((c) => c.toUpperCase()),
  label: z.string().max(200).optional().nullable(),
  kind: z.enum(["PERCENT", "FIXED"]),
  value: z.number().positive(),
  minCartHt: z.number().nonnegative().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial().omit({ code: true });

export async function adminPromoRoutes(app: FastifyInstance) {
  const adminOnly = {
    preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN", "MANAGER")],
  };

  app.get("/admin/discount-codes", adminOnly, async (request) => {
    const { active } = request.query as { active?: string };
    const where: { isActive?: boolean } = {};
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;
    const codes = await app.prisma.discountCode.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: codes };
  });

  app.post("/admin/discount-codes", adminOnly, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid discount code payload",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }
    if (parsed.data.kind === "PERCENT" && parsed.data.value > 100) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "PERCENT kind cannot exceed 100",
        },
      });
    }
    const existing = await app.prisma.discountCode.findUnique({
      where: { code: parsed.data.code },
    });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: {
          code: "CONFLICT",
          message: `Discount code '${parsed.data.code}' already exists`,
        },
      });
    }
    const created = await app.prisma.discountCode.create({
      data: {
        code: parsed.data.code,
        label: parsed.data.label ?? null,
        kind: parsed.data.kind,
        value: parsed.data.value,
        minCartHt: parsed.data.minCartHt ?? null,
        maxUses: parsed.data.maxUses ?? null,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return { success: true, data: created };
  });

  app.put("/admin/discount-codes/:id", adminOnly, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid discount code payload",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }
    const existing = await app.prisma.discountCode.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Discount code not found" },
      });
    }
    const updated = await app.prisma.discountCode.update({
      where: { id },
      data: {
        ...(parsed.data.label !== undefined && { label: parsed.data.label ?? null }),
        ...(parsed.data.kind !== undefined && { kind: parsed.data.kind }),
        ...(parsed.data.value !== undefined && { value: parsed.data.value }),
        ...(parsed.data.minCartHt !== undefined && { minCartHt: parsed.data.minCartHt ?? null }),
        ...(parsed.data.maxUses !== undefined && { maxUses: parsed.data.maxUses ?? null }),
        ...(parsed.data.startsAt !== undefined && {
          startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        }),
        ...(parsed.data.expiresAt !== undefined && {
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      },
    });
    return { success: true, data: updated };
  });

  app.delete("/admin/discount-codes/:id", adminOnly, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const existing = await app.prisma.discountCode.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Discount code not found" },
      });
    }
    if (existing.usedCount > 0) {
      // Used codes become accounting data — archive instead of delete.
      const archived = await app.prisma.discountCode.update({
        where: { id },
        data: { isActive: false },
      });
      return { success: true, data: archived, archived: true };
    }
    await app.prisma.discountCode.delete({ where: { id } });
    return { success: true };
  });
}
