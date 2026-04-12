# Idempotency Contracts — Cross-Service

TrottiStore uses a mono-DB multi-schema PostgreSQL architecture. All 4 services share the same database, so cross-service consistency is guaranteed by PostgreSQL transactions — no eventual consistency issues.

## Architecture

```
              PostgreSQL (1 instance, 4 schemas)
              ┌─────────────────────────────────┐
              │ shared.users                     │
              │ shared.audit_logs                │
              ├─────────────────────────────────┤
ecommerce ──> │ ecommerce.orders                 │
              │ ecommerce.payments               │
              │ ecommerce.products               │
              ├─────────────────────────────────┤
crm ────────> │ crm.customer_profiles            │
              │ crm.loyalty_points               │
              │ crm.email_campaigns              │
              ├─────────────────────────────────┤
sav ────────> │ sav.repair_tickets               │
              │ sav.notification_logs            │
              └─────────────────────────────────┘
```

## Idempotency Keys per Operation

| Operation | Key | Where enforced |
|---|---|---|
| Order creation | Redis NX lock on `checkout:{userId}:{checkoutToken}` | orders/index.ts |
| Stripe PaymentIntent | `providerRef` (unique on payments table) | checkout/index.ts |
| Stripe webhook | `payment.findFirst({ providerRef, status: CONFIRMED })` | checkout/index.ts handlePaymentSuccess |
| Refund | `payment.findFirst({ orderId, amount < 0, status: CONFIRMED })` | orders/index.ts refund route |
| Cancel restock | State machine: only PENDING/CONFIRMED/PREPARING can cancel | orders/index.ts |
| Loyalty points | `loyaltyPoint.findFirst({ profileId, referenceId, type: PURCHASE })` | checkout/index.ts awardLoyaltyPoints |
| Review | `@@unique([userId, productId])` DB constraint | reviews/index.ts |
| Campaign send | `@@unique([campaignId, customerId])` on CampaignSend | campaigns/index.ts |
| SAV notification | `notificationLog.findFirst({ triggerId, ticketId })` | triggers/index.ts |
| Password reset | Token hashed + `usedAt` timestamp (single-use) | auth/index.ts |

## Event Contracts

Domain events are typed in `packages/shared/src/events.ts`. Currently events are not emitted to a bus — they serve as documentation contracts for future event-driven architecture.

Each event has:
- `id`: UUID (unique per event)
- `metadata.correlationId`: traces a user action across services
- `metadata.causationId`: links to the parent event
- `version`: schema versioning for backward compatibility

## Cross-Service Data Flow

| Flow | Services | Consistency |
|---|---|---|
| Order created -> loyalty points | ecommerce (in same transaction) | ACID |
| Order created -> email confirmation | ecommerce -> shared/notifications | Best-effort (non-blocking) |
| Ticket created -> SAV notification | sav -> shared/notifications | Best-effort (feature-flagged) |
| Campaign send -> CRM | crm (in same process) | ACID |
| Admin user -> all services | shared.users (same DB) | ACID |

## When to Introduce an Event Bus

Current architecture handles up to ~1000 orders/day without issues. Consider an event bus (Redis Streams, NATS, or SQS) when:
- Services need to run on separate databases
- Event replay is needed for debugging
- More than 2 services need to react to the same event
- Write throughput exceeds PostgreSQL single-instance capacity
