import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import client from "prom-client";

// Default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ prefix: "trottistore_" });

// ─── HTTP metrics ────────────────────────────────────────

const httpRequestsTotal = new client.Counter({
  name: "trottistore_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const httpRequestDuration = new client.Histogram({
  name: "trottistore_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// ─── Business metrics (checkout/payment/fulfillment) ─────

export const checkoutMetrics = {
  ordersCreated: new client.Counter({
    name: "trottistore_orders_created_total",
    help: "Total orders created",
    labelNames: ["payment_method", "shipping_method", "type"], // type: auth|guest
  }),

  paymentIntentsCreated: new client.Counter({
    name: "trottistore_payment_intents_total",
    help: "Total Stripe PaymentIntents created",
    labelNames: ["flow"], // cart-first|order-first
  }),

  webhookEvents: new client.Counter({
    name: "trottistore_stripe_webhook_events_total",
    help: "Stripe webhook events received",
    labelNames: ["event_type", "result"], // result: success|error|ignored
  }),

  webhookRetries: new client.Counter({
    name: "trottistore_stripe_webhook_retries_total",
    help: "Stripe webhook processing retries",
    labelNames: ["event_type", "result"], // result: success|failed
  }),

  webhookDlq: new client.Counter({
    name: "trottistore_stripe_webhook_dlq_total",
    help: "Stripe webhook events moved to DLQ",
    labelNames: ["event_type"],
  }),

  webhookReplay: new client.Counter({
    name: "trottistore_stripe_webhook_replay_total",
    help: "Stripe webhook DLQ replay attempts",
    labelNames: ["result"], // result: success|failed
  }),

  paymentConfirmed: new client.Counter({
    name: "trottistore_payments_confirmed_total",
    help: "Total payments confirmed (via webhook)",
  }),

  paymentFailed: new client.Counter({
    name: "trottistore_payments_failed_total",
    help: "Total payments failed (via webhook)",
  }),

  refundsProcessed: new client.Counter({
    name: "trottistore_refunds_total",
    help: "Total refunds processed",
    labelNames: ["type", "result"], // type: full|partial, result: success|stripe_error
  }),

  orderStatusTransitions: new client.Counter({
    name: "trottistore_order_status_transitions_total",
    help: "Order status transitions",
    labelNames: ["from_status", "to_status"],
  }),

  checkoutErrors: new client.Counter({
    name: "trottistore_checkout_errors_total",
    help: "Checkout errors by type",
    labelNames: ["error_code"], // EMPTY_CART, INSUFFICIENT_STOCK, STRIPE_ERROR, etc.
  }),

  orderAmountEur: new client.Histogram({
    name: "trottistore_order_amount_eur",
    help: "Order amounts in EUR",
    buckets: [10, 25, 50, 100, 200, 500, 1000, 2000],
  }),

  // Financial controls gauges (set by reconciliation job)
  reconciliationDiscrepancies: new client.Gauge({
    name: "trottistore_reconciliation_discrepancies",
    help: "Number of orders with payment/charge mismatch",
  }),

  orphanPayments: new client.Gauge({
    name: "trottistore_orphan_payments",
    help: "Payments without matching order",
  }),

  stalePendingPayments: new client.Gauge({
    name: "trottistore_stale_pending_payments",
    help: "Payments stuck in PENDING > 24h",
  }),

  ledgerEntries: new client.Counter({
    name: "trottistore_ledger_entries_total",
    help: "Financial ledger entries created",
    labelNames: ["operation"], // CHARGE, REFUND_FULL, REFUND_PARTIAL, CANCEL, MANUAL_CONFIRM
  }),
};

function resolveRouteLabel(request: { routeOptions?: { url?: string } }): string {
  return request.routeOptions?.url || "__unmatched__";
}

export const metricsPlugin = fp(async (app: FastifyInstance) => {
  // Track request duration and count
  app.addHook("onResponse", (request, reply, done) => {
    const route = resolveRouteLabel(request);
    if (route === "/metrics" || route === "/health" || route === "/ready") {
      done();
      return;
    }

    const labels = {
      method: request.method,
      route,
      status_code: reply.statusCode.toString(),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
    done();
  });

  // Expose /metrics endpoint
  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", client.register.contentType);
    return client.register.metrics();
  });
});
