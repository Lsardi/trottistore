# Chaos Drills & Reliability Scorecard — TrottiStore

## Monthly Chaos Drill Program

### Schedule
- **When**: First Monday of each month, 10:00-12:00
- **Where**: Staging environment (never production for initial drills)
- **Who**: Tech lead + on-call engineer
- **Duration**: 2 hours max (including debrief)

### Drill Rotation

| Month | Drill | Scenario |
|---|---|---|
| 1 | Stripe outage | Set invalid STRIPE_SECRET_KEY, verify degraded behavior |
| 2 | Redis crash | Stop Redis, verify cart loss is graceful, orders survive |
| 3 | Database slowdown | Add 2s latency to PostgreSQL, verify timeouts + alerts |
| 4 | Webhook flood | Replay 100 webhooks in 10s, verify idempotency + DLQ |
| 5 | Service crash | Kill ecommerce service, verify other services survive |
| 6 | Full stack restart | Stop all + restart, verify recovery time |
| 7-12 | Repeat cycle | With production environment (after 6 months staging drills) |

### Drill Protocol

```
BEFORE (T-30min)
  [ ] Verify staging is up and seeded
  [ ] Verify monitoring/alerting is active
  [ ] Note current metrics baseline
  [ ] Notify team: "Chaos drill starting in 30 minutes"

EXECUTE (T+0)
  [ ] Inject failure (see scenario-specific steps)
  [ ] Start timer: T_detect (time to first alert)
  [ ] Start timer: T_respond (time to acknowledge)
  [ ] Start timer: T_resolve (time to full recovery)
  [ ] Document: what broke, what didn't, what surprised

RECOVER (T+resolve)
  [ ] Apply fix per INCIDENT_RUNBOOK.md
  [ ] Verify all services healthy
  [ ] Verify no data loss (or document expected loss)
  [ ] Verify alerts resolved

DEBRIEF (T+1h)
  [ ] Fill scorecard
  [ ] Update INCIDENT_RUNBOOK.md if gaps found
  [ ] Create issues for improvements discovered
  [ ] Schedule follow-up if MTTR exceeded SLO
```

## Reliability Scorecard

### Metrics Tracked

| Metric | Definition | Target | Measurement |
|---|---|---|---|
| **MTTD** | Mean Time To Detect (alert fires) | < 2 min | Timer from injection to first alert |
| **MTTR** | Mean Time To Resolve | < 15 min | Timer from injection to full recovery |
| **RTO** | Recovery Time Objective | < 5 min | Time from decision-to-fix to service restored |
| **RPO** | Recovery Point Objective | < 1 hour | Max data loss (backup frequency) |
| **Detection Rate** | % of failures detected by alerts | 100% | Did alert fire? |
| **Runbook Accuracy** | Did runbook steps work? | > 90% | Steps followed vs steps that needed improvisation |

### Scorecard Template

```
DRILL: [Scenario Name]
DATE: [YYYY-MM-DD]
ENVIRONMENT: [staging/production]

TIMING
  Injection:     [HH:MM:SS]
  First alert:   [HH:MM:SS] → MTTD = [X]s
  Acknowledged:  [HH:MM:SS] → MTTR start
  Fix applied:   [HH:MM:SS]
  Verified OK:   [HH:MM:SS] → MTTR = [X]min

DATA IMPACT
  Data lost:     [none / carts / X orders]
  RPO actual:    [Xs / Xmin]

ALERT COVERAGE
  Expected alerts:  [list]
  Fired correctly:  [list]
  Missing/late:     [list]

RUNBOOK ACCURACY
  Steps followed:   [X/Y]
  Improvised steps: [list]

SCORE: [PASS / PARTIAL / FAIL]

ACTIONS
  - [action item 1]
  - [action item 2]
```

### Historical Scores (fill after each drill)

| Date | Drill | MTTD | MTTR | RPO | Score | Notes |
|---|---|---|---|---|---|---|
| Pre-prod | Stripe down | TBD | TBD | 0 | TBD | First drill pending |
| Pre-prod | Redis down | TBD | TBD | carts | TBD | |
| Pre-prod | DB down | TBD | TBD | TBD | TBD | |

## SLO Alignment

Drill results feed directly into SLO tracking:

| SLO | Target | Drill Validates |
|---|---|---|
| Checkout availability | 99.9% | Stripe down + Redis down drills |
| Payment confirmation | < 30s | Webhook flood drill |
| Order data durability | 0 loss | DB crash + restore drill |
| Alert detection | < 2 min | All drills (MTTD metric) |
| Recovery time | < 15 min | All drills (MTTR metric) |

## Graduation to Production Drills

After 6 months of successful staging drills:
1. Start with read-only production drills (monitoring verification only)
2. Graduate to controlled failure injection (single service, off-peak)
3. Full production drills (with customer communication plan)

Prerequisites for production drills:
- [ ] All staging drills passed with SCORE = PASS
- [ ] Runbook validated and up-to-date
- [ ] On-call rotation established
- [ ] Customer communication template ready
- [ ] Rollback verified within RTO
