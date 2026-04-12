# Financial Controls — TrottiStore

## 1. Financial Ledger (append-only)

Every monetary operation is recorded in `ecommerce.financial_ledger` as an immutable entry. No UPDATE or DELETE allowed on this table.

### Operations

| Operation | amountCents | Trigger |
|---|---|---|
| CHARGE | +positive | Order confirmed (webhook payment_intent.succeeded) |
| REFUND_FULL | -negative | Admin full refund |
| REFUND_PARTIAL | -negative | Admin partial refund |
| CANCEL | 0 | Order cancelled (stock restocked, no money moved) |
| MANUAL_CONFIRM | +positive | Admin manual order (cash/check) |

### Schema

```sql
-- Append-only: no UPDATE, no DELETE
-- Application enforces via Prisma (only create, never update/delete)
-- DB-level: consider a trigger to DENY UPDATE/DELETE in production

CREATE TABLE ecommerce.financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_number INTEGER NOT NULL,
  operation VARCHAR(30) NOT NULL,
  amount_cents INTEGER NOT NULL,    -- Always cents. Negative = refund.
  currency VARCHAR(3) DEFAULT 'EUR',
  provider VARCHAR(30) NOT NULL,    -- stripe, internal, manual
  provider_ref VARCHAR(255),        -- Stripe PI/Refund ID
  balance_before INTEGER,           -- Running balance (optional)
  balance_after INTEGER,
  performed_by UUID,                -- Admin user ID
  reason VARCHAR(500),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Usage in Code

```typescript
// After any financial operation, append to ledger:
await prisma.financialLedger.create({
  data: {
    orderId: order.id,
    orderNumber: order.orderNumber,
    operation: "REFUND_FULL",
    amountCents: -refundCents,
    currency: "EUR",
    provider: "stripe",
    providerRef: stripeRefundId,
    performedBy: adminUserId,
    reason: "Client insatisfait",
  },
});
```

### Reconciliation Query

```sql
-- Orders where sum(ledger) != order.totalTtc * 100
SELECT
  o.order_number,
  o.total_ttc * 100 AS expected_cents,
  COALESCE(SUM(fl.amount_cents), 0) AS actual_cents,
  (o.total_ttc * 100) - COALESCE(SUM(fl.amount_cents), 0) AS diff_cents
FROM ecommerce.orders o
LEFT JOIN ecommerce.financial_ledger fl ON fl.order_id = o.id
WHERE o.status IN ('CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'REFUNDED')
GROUP BY o.id, o.order_number, o.total_ttc
HAVING (o.total_ttc * 100) - COALESCE(SUM(fl.amount_cents), 0) != 0;
```

---

## 2. Financial Alerts

### Prometheus Rules (infra/alerting-rules.yml)

| Alert | Condition | Severity |
|---|---|---|
| PaymentAmountMismatch | Reconciliation job finds discrepancy | CRITICAL |
| OrphanPayment | Payment record without matching order | WARNING |
| RefundExceedsCharge | Refund amount > original charge | CRITICAL |
| UnreconciledPayments | Payments in PENDING > 24h | WARNING |
| HighRefundRate | Refund rate > 5% of orders in 24h | WARNING |

### Implementation

Reconciliation should run as a daily cron (or on-demand admin endpoint).
Alerts fire based on reconciliation job output + direct Prometheus metrics.

---

## 3. Controls Checklist

```
DAILY
  [ ] Reconciliation job runs (orders vs payments vs Stripe)
  [ ] Zero discrepancies in reconciliation report
  [ ] No orphan payments
  [ ] Refund rate within normal bounds (<5%)

WEEKLY
  [ ] Manual spot-check: pick 3 random orders, verify ledger entries
  [ ] Verify Stripe dashboard balance matches ledger sum
  [ ] Check for stale PENDING payments (>7 days)

MONTHLY
  [ ] Full reconciliation export for accounting
  [ ] Review refund reasons for patterns
  [ ] Verify backup integrity (restore test on staging)
```

---

## 4. Rules

- No one can modify a ledger entry after creation
- Every refund must have a reason
- Refund amount cannot exceed original charge
- Partial refunds: sum of all refunds cannot exceed original charge
- Manual confirmations require ADMIN+ role and are logged with performedBy
