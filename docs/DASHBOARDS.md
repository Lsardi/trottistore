# Incident-Ready Dashboards — TrottiStore

Grafana dashboard specifications for 3 critical domains. Each panel is designed to answer a specific incident question.

## Dashboard 1: Payments & Checkout

**Purpose:** "Is checkout working? Are we losing money?"

### Panels

| Panel | Query | Type | Alert Threshold |
|---|---|---|---|
| Orders/hour | `rate(trottistore_orders_created_total[1h])` | Graph | < 1 in business hours |
| Payment success rate | `trottistore_payments_confirmed_total / (confirmed + failed)` | Gauge | < 95% |
| Payment failures | `increase(trottistore_payments_failed_total[5m])` | Graph | > 3 in 5min |
| Webhook events | `rate(trottistore_stripe_webhook_events_total[5m])` by result | Stacked | Any error |
| Checkout errors | `topk(5, increase(trottistore_checkout_errors_total[1h]))` by error_code | Table | > 10/hour |
| Average order value | `trottistore_order_amount_eur` histogram | Graph | Sudden change |
| PaymentIntent latency | `trottistore_http_request_duration_seconds{route="/api/v1/checkout/payment-intent"}` p95 | Graph | > 2s |
| DLQ size | `trottistore_webhook_dlq_size` | Gauge | > 0 |

### Incident Actions
- **Orders/hour drops to 0**: Check checkout config endpoint, Stripe status, service health
- **Payment failures spike**: Check Stripe dashboard, webhook logs
- **DLQ > 0**: Replay via POST /admin/checkout/webhooks/dlq/replay

## Dashboard 2: Fulfillment & Orders

**Purpose:** "Are orders progressing through the pipeline?"

### Panels

| Panel | Query | Type |
|---|---|---|
| Orders by status | `count by (status) (trottistore_order_status_transitions_total)` | Pie chart |
| Status transitions/hour | `rate(trottistore_order_status_transitions_total[1h])` by from/to | Heatmap |
| Stuck orders (PENDING > 1h) | `trottistore_stale_pending_payments` | Gauge |
| Refund rate (24h) | `increase(trottistore_refunds_total{type="full"}[24h]) / increase(trottistore_orders_created_total[24h])` | Gauge |
| Refunds by type | `increase(trottistore_refunds_total[24h])` by type | Bar |
| Cancel rate | `increase(trottistore_order_status_transitions_total{to_status="CANCELLED"}[24h])` | Gauge |
| Stock alerts | Custom query on product_variants with low stock | Table |

### Incident Actions
- **Stuck PENDING orders**: Check webhook delivery, manual confirm if needed
- **High refund rate**: Review refund reasons, check product quality
- **High cancel rate**: Check stock availability, checkout UX

## Dashboard 3: Finance & Reconciliation

**Purpose:** "Does the money add up?"

### Panels

| Panel | Query | Type |
|---|---|---|
| Reconciliation discrepancies | `trottistore_reconciliation_discrepancies` | Gauge (RED if > 0) |
| Orphan payments | `trottistore_orphan_payments` | Gauge |
| Ledger entries/hour | `rate(trottistore_ledger_entries_total[1h])` by operation | Stacked graph |
| Revenue today | `sum(increase(trottistore_order_amount_eur_sum[24h]))` | Stat |
| Refund total today | `sum(increase(trottistore_refunds_total[24h]))` | Stat |
| Net revenue | Revenue - Refunds | Stat |
| Last reconciliation | Timestamp of last reconciliation job run | Stat |

### Incident Actions
- **Discrepancies > 0**: Run manual reconciliation, check Stripe dashboard
- **Orphan payments**: Match to orders manually, investigate webhook gaps

## Setup

### Grafana Provisioning

```bash
# Copy dashboard JSONs to Grafana provisioning directory
cp infra/grafana/dashboards/*.json /etc/grafana/provisioning/dashboards/

# Or import via Grafana UI:
# 1. Go to Dashboards > Import
# 2. Upload JSON file
# 3. Select Prometheus as data source
```

### Data Source Requirements
- Prometheus: scraping all 4 services on /metrics
- Refresh interval: 10s for real-time panels, 1m for aggregations
