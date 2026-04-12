/**
 * Site settings routes — admin-editable configuration stored in DB.
 *
 * GET /admin/settings — read current settings (public, cached for frontend)
 * PUT /admin/settings — update settings (ADMIN+ only)
 *
 * Replaces env-var-only approach so non-technical site owners
 * can edit legal info, contact details, etc. from the admin panel.
 */
import type { FastifyInstance } from "fastify";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { z } from "zod";
import { requireRole } from "../../plugins/auth.js";

const SETTINGS_ID = "default"; // Singleton row

const updateSettingsSchema = z.object({
  legal: z.object({
    siret: z.string().max(20).optional(),
    rcs: z.string().max(50).optional(),
    capital: z.string().max(30).optional(),
    legalForm: z.string().max(30).optional(),
    director: z.string().max(100).optional(),
    tvaIntracom: z.string().max(30).optional(),
  }).optional(),
  contact: z.object({
    email: z.string().email().max(255).optional(),
    phone: z.string().max(20).optional(),
    dpoEmail: z.string().email().max(255).optional(),
  }).optional(),
  branding: z.object({
    name: z.string().max(100).optional(),
    tagline: z.string().max(200).optional(),
  }).optional(),
});

export async function settingsRoutes(app: FastifyInstance) {
  // GET /admin/settings — Public (frontend needs this for mentions légales)
  app.get("/admin/settings", async () => {
    const row = await app.prisma.siteSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    return {
      success: true,
      data: row?.settings ?? {},
    };
  });

  // PUT /admin/settings — ADMIN+ only
  app.put(
    "/admin/settings",
    { preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN")] },
    async (request, reply) => {
      const parsed = updateSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Données invalides", details: parsed.error.flatten().fieldErrors },
        });
      }

      const userId = (request.user as { userId?: string; id?: string }).userId ?? (request.user as { id?: string }).id;

      // Merge with existing settings (don't overwrite unset fields)
      const existing = await app.prisma.siteSettings.findUnique({
        where: { id: SETTINGS_ID },
      });

      const currentSettings = (existing?.settings ?? {}) as Record<string, unknown>;
      const newSettings = { ...currentSettings };

      if (parsed.data.legal) {
        newSettings.legal = { ...(currentSettings.legal as Record<string, unknown> ?? {}), ...parsed.data.legal };
      }
      if (parsed.data.contact) {
        newSettings.contact = { ...(currentSettings.contact as Record<string, unknown> ?? {}), ...parsed.data.contact };
      }
      if (parsed.data.branding) {
        newSettings.branding = { ...(currentSettings.branding as Record<string, unknown> ?? {}), ...parsed.data.branding };
      }

      const row = await app.prisma.siteSettings.upsert({
        where: { id: SETTINGS_ID },
        create: {
          id: SETTINGS_ID,
          settings: newSettings as InputJsonValue,
          updatedBy: userId ?? null,
        },
        update: {
          settings: newSettings as InputJsonValue,
          updatedBy: userId ?? null,
        },
      });

      return { success: true, data: row.settings };
    },
  );
}
