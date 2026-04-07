# Service: Analytics

Port 3003. KPIs, real-time dashboard, sales/customer/stock analytics, event ingestion.

## Test

```bash
pnpm test:project analytics
```

## Routes (/api/v1/analytics)

ADMIN+ role required, except public event ingestion.

| Route | Auth | Description |
|-------|------|-------------|
| POST /events/public | public | Frontend funnel tracking |
| /realtime/* | ADMIN+ | Real-time metrics |
| /kpis/* | ADMIN+ | Key performance indicators |
| /sales/* | ADMIN+ | Sales reports |
| /customers/* | ADMIN+ | Customer analytics |
| /stock/* | ADMIN+ | Inventory levels |
| /cockpit/* | ADMIN+ | Admin overview dashboard |

## Key patterns

- Current KPI endpoints do direct Prisma reads (tech debt — should use read models/projections)
- ClickHouse integration planned for time-series storage (CLICKHOUSE_URL env var)
- Public event endpoint for frontend funnel tracking (no auth required)

## Env vars

CLICKHOUSE_URL (optional, for time-series analytics).
