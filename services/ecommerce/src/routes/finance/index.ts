import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../../plugins/auth.js";
import { runFinancialReconciliation } from "../../lib/finance-reconciliation.js";

export async function financeRoutes(app: FastifyInstance) {
  app.get("/admin/finance/reconciliation", {
    preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN", "MANAGER")],
  }, async (request, reply) => {
    const parsed = z.object({
      includeDetails: z.coerce.boolean().default(true),
    }).safeParse(request.query);

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

    const report = await runFinancialReconciliation(app);
    return {
      success: true,
      data: parsed.data.includeDetails
        ? report
        : {
            generatedAt: report.generatedAt,
            discrepanciesCount: report.discrepanciesCount,
            orphanPaymentsCount: report.orphanPaymentsCount,
            stalePendingPaymentsCount: report.stalePendingPaymentsCount,
          },
    };
  });

  app.post("/admin/finance/reconciliation/run", {
    preHandler: [app.authenticate, requireRole("SUPERADMIN", "ADMIN", "MANAGER")],
  }, async (request) => {
    const userId = (request.user as { userId?: string; id?: string }).userId ?? (request.user as { id?: string }).id;
    app.log.info({ userId }, "Financial reconciliation started");
    const report = await runFinancialReconciliation(app);
    app.log.info({ userId, discrepancies: report.discrepanciesCount, orphanPayments: report.orphanPaymentsCount }, "Financial reconciliation completed");
    return { success: true, data: report };
  });
}
