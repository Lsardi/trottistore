import type { FastifyInstance } from "fastify";
import { checkoutMetrics } from "../plugins/metrics.js";

export type FinancialReconciliationReport = {
  generatedAt: string;
  discrepanciesCount: number;
  orphanPaymentsCount: number;
  stalePendingPaymentsCount: number;
  details: {
    discrepancies: Array<{ orderId: string; orderNumber: number; orderTotalCents: number; netPaidCents: number }>;
    orphanPayments: Array<{ paymentId: string; provider: string; providerRef: string | null; amountCents: number }>;
    stalePendingPayments: Array<{ paymentId: string; orderId: string; ageHours: number }>;
  };
};

type DiscrepancyRow = {
  orderId: string;
  orderNumber: number;
  orderTotalCents: number;
  netPaidCents: number;
};

type OrphanPaymentRow = {
  paymentId: string;
  provider: string;
  providerRef: string | null;
  amountCents: number;
};

type StalePendingRow = {
  paymentId: string;
  orderId: string;
  ageHours: number;
};

export async function runFinancialReconciliation(
  app: FastifyInstance,
): Promise<FinancialReconciliationReport> {
  const discrepancies = await app.prisma.$queryRaw<DiscrepancyRow[]>`
    SELECT
      o.id AS "orderId",
      o.order_number AS "orderNumber",
      CAST(ROUND(o.total_ttc * 100) AS INTEGER) AS "orderTotalCents",
      CAST(
        COALESCE(
          ROUND(
            SUM(
              CASE
                WHEN p.status = 'CONFIRMED' THEN p.amount
                ELSE 0
              END
            ) * 100
          ),
          0
        ) AS INTEGER
      ) AS "netPaidCents"
    FROM ecommerce.orders o
    LEFT JOIN ecommerce.payments p ON p.order_id = o.id
    WHERE o.payment_status IN ('PAID', 'PARTIAL', 'REFUNDED')
    GROUP BY o.id, o.order_number, o.total_ttc
    HAVING ABS(
      CAST(ROUND(o.total_ttc * 100) AS INTEGER)
      - CAST(COALESCE(ROUND(SUM(CASE WHEN p.status = 'CONFIRMED' THEN p.amount ELSE 0 END) * 100), 0) AS INTEGER)
    ) > 1
    ORDER BY o.order_number DESC
    LIMIT 100
  `;

  const orphanPayments = await app.prisma.$queryRaw<OrphanPaymentRow[]>`
    SELECT
      p.id AS "paymentId",
      p.provider AS "provider",
      p.provider_ref AS "providerRef",
      CAST(ROUND(p.amount * 100) AS INTEGER) AS "amountCents"
    FROM ecommerce.payments p
    LEFT JOIN ecommerce.orders o ON o.id = p.order_id
    WHERE o.id IS NULL
    ORDER BY p.created_at DESC
    LIMIT 100
  `;

  const stalePendingPayments = await app.prisma.$queryRaw<StalePendingRow[]>`
    SELECT
      p.id AS "paymentId",
      p.order_id AS "orderId",
      EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 AS "ageHours"
    FROM ecommerce.payments p
    WHERE p.status = 'PENDING'
      AND p.created_at < NOW() - INTERVAL '24 hours'
    ORDER BY p.created_at ASC
    LIMIT 100
  `;

  checkoutMetrics.reconciliationDiscrepancies.set(discrepancies.length);
  checkoutMetrics.orphanPayments.set(orphanPayments.length);
  checkoutMetrics.stalePendingPayments.set(stalePendingPayments.length);

  return {
    generatedAt: new Date().toISOString(),
    discrepanciesCount: discrepancies.length,
    orphanPaymentsCount: orphanPayments.length,
    stalePendingPaymentsCount: stalePendingPayments.length,
    details: {
      discrepancies,
      orphanPayments,
      stalePendingPayments,
    },
  };
}
