# Challenge Audit Run 2 — 2026-04-12

## Scope
- New pass only (no duplicates from Run 1)
- Real, reproducible issues from current code
- Evidence with `file:line`

## Findings (Run 2)

| ID | Severity | Bug | Evidence | Impact |
|---|---|---|---|---|
| R2-01 | HIGH | Front rewrite missing for addresses API (`/api/v1/addresses`) while frontend uses it heavily | `apps/web/next.config.ts:19-43` + `apps/web/src/lib/api.ts:179-223` + `services/ecommerce/src/routes/addresses/index.ts:33-179` | Checkout/account address CRUD can hit 404 in browser (no rewrite target). |
| R2-02 | HIGH | Front rewrite missing for pro leads + stock alerts (`/api/v1/leads/pro`, `/api/v1/stock-alerts`) | `apps/web/next.config.ts:19-43` + `apps/web/src/lib/api.ts:227-258` + `services/ecommerce/src/routes/leads/index.ts:20-57` | Pro form + stock alert form can fail in browser despite backend routes existing. |
| R2-03 | HIGH | Front rewrite missing for reviews API (`/api/v1/reviews*`) | `apps/web/next.config.ts:19-43` + `apps/web/src/lib/api.ts:477-500` + `services/ecommerce/src/routes/reviews/index.ts:31-100` | Product reviews and reviews pages can fail in browser (404). |
| R2-04 | CRITICAL | SAV RBAC gap: authenticated CLIENT can update technician availability | `services/sav/src/index.ts:87-128` + `services/sav/src/routes/technicians/index.ts:116-141` | Any logged client can set `isAvailable` for technicians (business disruption). |
| R2-05 | HIGH | SAV RBAC gap: authenticated CLIENT can read internal technician roster and schedules | `services/sav/src/index.ts:87-128` + `services/sav/src/routes/technicians/index.ts:18-114` | Leaks internal staff workload/planning to clients. |
| R2-06 | HIGH | SAV RBAC gap: authenticated CLIENT can read global SAV business stats | `services/sav/src/index.ts:87-128` + `services/sav/src/routes/stats/index.ts:7-99` | Exposes internal KPIs/cost aggregates to clients. |
| R2-07 | MEDIUM | SAV priority sort is wrong across pages (re-sort done after pagination) | `services/sav/src/routes/tickets/index.ts:312-318` + `services/sav/src/routes/tickets/index.ts:335-343` | Page 1/page 2 ordering can be inconsistent with expected global priority ordering. |
| R2-08 | HIGH | SAV appointment booking race condition (check-then-insert, no DB exclusion lock) | `services/sav/src/routes/tickets/index.ts:461-467` + `services/sav/src/routes/tickets/index.ts:479-494` + `packages/database/prisma/schema.prisma:917-920` | Concurrent requests can book the same slot twice. |
| R2-09 | MEDIUM | SAV appointment API accepts out-of-hours/past times (server trusts client time) | `services/sav/src/routes/tickets/index.ts:100-110` + `services/sav/src/routes/tickets/index.ts:457-460` (no time-window check like slots logic at `412-450`) | Invalid appointments can be created by direct API calls. |
| R2-10 | MEDIUM | SAV audit log spoofing: `performedBy` can be injected from request body | `services/sav/src/routes/tickets/index.ts:57-60` + `services/sav/src/routes/tickets/index.ts:640-647` + `services/sav/src/routes/tickets/index.ts:653-655` | Activity/status logs can attribute actions to the wrong user (audit integrity issue). |
| R2-11 | HIGH | CRM trigger RBAC mismatch: route documented as manager-only but STAFF is allowed on create | `services/crm/src/routes/triggers/index.ts:47` + `services/crm/src/routes/triggers/index.ts:66-74` + stricter checks on other trigger routes at `50` and `104` | Privilege escalation: STAFF can create automation triggers. |
| R2-12 | HIGH | CRM campaign send ignores newsletter opt-in status | Recipient selection from profiles only: `services/crm/src/routes/campaigns/index.ts:302-309`; send loop: `services/crm/src/routes/campaigns/index.ts:338-353`; newsletter consent model exists separately: `packages/database/prisma/schema.prisma:758-767` | Marketing emails can be sent to unsubscribed/non-confirmed contacts (compliance risk). |
| R2-13 | MEDIUM | Trigger idempotence is not atomic (duplicate notifications possible on concurrent manual runs) | check-before-send: `services/crm/src/routes/triggers/index.ts:219-223`; log insert later: `services/crm/src/routes/triggers/index.ts:389-399`; no unique `(triggerId,ticketId)` in schema: `packages/database/prisma/schema.prisma:735-754`; cron lock exists only for scheduler path: `services/crm/src/index.ts:235-259` | Two manager-initiated runs can double-notify same ticket. |

## Summary
- New bugs found in this run: **13**
- Hot zones: **frontend rewrites**, **SAV RBAC**, **CRM marketing/trigger controls**
- Run 1 overlaps intentionally excluded from this report.
