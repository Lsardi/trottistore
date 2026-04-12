# SLO & Error Budget Operations (P5)

## Scope

This document operationalizes checkout reliability with measurable SLOs and burn-rate alerts.

Critical user journeys covered:
- `POST /api/v1/checkout/payment-intent`
- `POST /api/v1/checkout/webhook`
- `POST /api/v1/orders`
- `POST /api/v1/orders/guest`

## SLO Targets

1. Availability SLO (30d rolling): **99.9%**
2. Latency SLO (p95): **<= 1.2s** sustained, **<= 1.5s** short-term

Error budget math:
- monthly budget = `1 - 0.999 = 0.001` (0.1% bad requests)
- all burn rates are normalized by this 0.1% budget

## Recording Rules

Defined in [infra/slo-rules.yml](/Users/lyes/Desktop/trottistore.fr/infra/slo-rules.yml):
- `trottistore:slo_checkout_availability_30d`
- `trottistore:slo_checkout_error_budget_remaining_30d`
- `trottistore:slo_checkout_error_budget_burn_rate_5m`
- `trottistore:slo_checkout_error_budget_burn_rate_1h`
- `trottistore:slo_checkout_error_budget_burn_rate_6h`
- `trottistore:slo_checkout_latency_p95_5m`
- `trottistore:slo_checkout_latency_p95_30m`

## Alert Policy

Defined in [infra/alerting-rules.yml](/Users/lyes/Desktop/trottistore.fr/infra/alerting-rules.yml):

1. `SLOCheckoutErrorBudgetFastBurn` (critical)
- Trigger: burn rate > 14x on 5m and 1h
- Action: incident mode immediately, rollback/feature-flag suspected release

2. `SLOCheckoutErrorBudgetSlowBurn` (warning)
- Trigger: burn rate > 3x on 1h and 6h
- Action: mitigation in current shift, no risky deploys until stable

3. `SLOCheckoutErrorBudgetExhausted` (critical)
- Trigger: remaining error budget < 0
- Action: reliability freeze (only fixes), full postmortem required

4. `SLOCheckoutLatencyDegraded` (warning)
- Trigger: p95 > 1.5s (5m) and > 1.2s (30m)
- Action: inspect DB/Redis/Stripe dependencies and recent deploys

## On-Call Playbook (Short)

1. Confirm if issue is error-rate, latency, or both.
2. Correlate with deploy history and provider incidents (Stripe/PostgreSQL/Redis).
3. Apply fastest safe mitigation:
- rollback latest release
- disable non-critical features/flags
- scale service/resources if saturation
4. Verify burn-rate returns below 1x and p95 recovers.
5. Log timeline, root cause, and prevention actions in incident notes.
