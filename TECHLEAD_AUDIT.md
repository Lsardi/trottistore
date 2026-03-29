# Tech Lead Audit — Baseline (Fond En Comble)

Date: 2026-03-28  
Branch: `techlead/fond-comble-audit`

## 1) Critical Findings (P0)

1. Service-level auth perimeter is inconsistent across microservices.
- `ecommerce` has auth plugin and RBAC usage ([services/ecommerce/src/plugins/auth.ts](/Users/lyes/Desktop/trottistore.fr/services/ecommerce/src/plugins/auth.ts), [services/ecommerce/src/routes/admin/index.ts](/Users/lyes/Desktop/trottistore.fr/services/ecommerce/src/routes/admin/index.ts)).
- `crm`, `sav`, `analytics` do not register auth plugin in service entrypoints.
- Risk: privileged routes accessible without auth boundary at service edge.

2. Playwright E2E orchestration is coupled to full monorepo dev startup.
- Previous `webServer.command` started `pnpm dev` from root (Turbo multi-service).
- Risk: E2E instability and false negatives when unrelated services fail startup.
- Quick-win applied in this branch: run only web app in Playwright server config.

3. Security scan was non-blocking in CI.
- `pnpm audit --audit-level=high` was softened with warning fallback.
- Risk: known high vulns can pass CI.
- Quick-win applied in this branch: make audit blocking again.

## 2) High Findings (P1)

1. HTTP validation and domain error contracts still depend on broad `any` usage in route handlers.
- Multiple route files still rely on `any`-typed request coercions.
- Risk: hidden runtime contract drift and weaker type guarantees.

2. Analytics depends on transaction DB reads for KPI endpoints.
- Current KPIs/sales endpoints are mostly direct Prisma reads.
- Risk: dashboard query load competes with transactional workload; definitions drift.

3. Frontend account/checkout flows improved but still need hard E2E pass in CI.
- Critical tests exist, but full CI run must confirm against Actions environment.

## 3) Medium Findings (P2)

1. Mixed admin UI paradigms in some admin pages (legacy gray UI vs tokenized theme UI).
2. Large number of inline styles in storefront/admin can slow theme-system evolution.
3. Limited explicit release runbooks and rollback procedure in repo docs.

## 4) What Was Improved Immediately On This Branch

1. CI security gate hardened.
- File: [ci.yml](/Users/lyes/Desktop/trottistore.fr/.github/workflows/ci.yml)
- Change: `pnpm audit --audit-level=high` is blocking.

2. Playwright server startup isolated to web app.
- File: [playwright.config.ts](/Users/lyes/Desktop/trottistore.fr/apps/web/playwright.config.ts)
- Change: `webServer.command` switched to `pnpm --filter @trottistore/web dev`.

3. Storefront now supports multi-style theme modes (not only color swaps).
- Files:
  - [themes.ts](/Users/lyes/Desktop/trottistore.fr/apps/web/src/lib/themes.ts)
  - [ThemeSwitcher.tsx](/Users/lyes/Desktop/trottistore.fr/apps/web/src/components/ThemeSwitcher.tsx)
  - [layout.tsx](/Users/lyes/Desktop/trottistore.fr/apps/web/src/app/layout.tsx)
  - [globals.css](/Users/lyes/Desktop/trottistore.fr/apps/web/src/app/globals.css)
- Change: centralized theme profiles + robust bootstrapping + style-level overrides (typography, cards, buttons, texture).

4. E2E diagnostics hardened in CI.
- Files:
  - [playwright.config.ts](/Users/lyes/Desktop/trottistore.fr/apps/web/playwright.config.ts)
  - [ci.yml](/Users/lyes/Desktop/trottistore.fr/.github/workflows/ci.yml)
- Change: CI reporter now emits HTML artifacts, screenshots/videos kept on failures, artifacts uploaded from CI, and E2E job timeout explicitly bounded.

5. Release and rollback runbook added.
- File: [RELEASE_RUNBOOK.md](/Users/lyes/Desktop/trottistore.fr/RELEASE_RUNBOOK.md)
- Change: concrete release gate, post-release verification, rollback execution, and incident communication template.

## 5) Execution Plan (30/60/90)

### 30 days (Stabilize)
- Enforce auth boundary for `crm`, `sav`, `analytics` service edges.
- Freeze API error contract and remove top `any` hotspots in route layer.
- Get deterministic CI green for unit/smoke/e2e.
- Publish release checklist + rollback checklist.

### 60 days (Harden)
- Introduce service/use-case/repository separation for top critical routes.
- Build analytics read models (fact/dim) for KPI endpoints.
- Add SLO dashboards: 5xx rate, p95 latency, queue/backlog indicators.

### 90 days (Scale)
- CD staging + gated promotion to prod.
- Data quality checks for analytics events and KPI definitions.
- Formal ownership map by domain and on-call playbook.

## 6) Next Actionable PR Batch

1. `audit-p0-auth-perimeter`
- Add auth plugin + role guard strategy for `crm`, `sav`, `analytics`.

2. `audit-p1-type-contracts`
- Replace route-level `any` in high-traffic endpoints with explicit request schemas.

3. `audit-p1-analytics-readmodels`
- Introduce first projection tables and move exec KPI endpoints to projections.

4. `audit-p1-e2e-hardening`
- Wire critical E2E suite in CI with deterministic fixtures and artifacts.

5. `audit-p2-release-runbook`
- Keep release/rollback checklist current and require a release note per tagged version.
