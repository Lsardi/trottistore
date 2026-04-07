# Service: CRM

Port 3002. Customer profiles, segmentation, campaigns, automated triggers.

## Test

```bash
pnpm test:project crm
```

## Routes (/api/v1)

All routes require ADMIN+ role (CLIENT rejected with 403 at service edge).

| Route | Description |
|-------|-------------|
| /customers | Profiles, timeline, loyalty points, tags |
| /segments | Behavioral customer segments |
| /campaigns | Email/SMS campaigns (Brevo) |
| /triggers | Event-based automated actions |

## Domain model

- **Loyalty tiers**: BRONZE (0-500pts), SILVER (500-2000), GOLD (2000+)
- **Interactions**: EMAIL, CALL, VISIT, SMS, NOTE, ORDER, SAV (timeline)
- **Segments**: dynamic groups based on tags, spent, tier

## Env vars

BREVO_API_KEY (optional, for email/SMS sending).
