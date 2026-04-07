# TrottiStore — Monorepo

E-commerce platform for electric scooters (trottinettes). Shop + CRM + SAV (after-sales) + Analytics.

## Quick commands

```bash
pnpm test                        # All 112 tests
pnpm test:quick                  # --bail=1 --changed (fast agent feedback)
pnpm test:project ecommerce      # One service only
pnpm test:smoke                  # 18 smoke tests (~1s)
pnpm lint                        # Turbo lint all packages
pnpm build                       # Turbo build all packages
pnpm dev                         # Start everything (needs docker-compose.dev.yml up)
```

## Architecture

```
apps/web              → Next.js 15 storefront (App Router, SSR)
services/ecommerce    → Fastify, port 3001 — products, orders, cart, auth, checkout, Stripe
services/crm          → Fastify, port 3002 — customers, segments, campaigns, triggers
services/sav          → Fastify, port 3004 — repair tickets, appointments, technicians
services/analytics    → Fastify, port 3003 — KPIs, realtime, sales, stock, events
packages/database     → Prisma (PostgreSQL, 4 schemas: shared, ecommerce, crm, sav)
packages/shared       → RBAC roles, error classes, JWT types, pagination, domain events
packages/ui           → Placeholder (future shared components)
```

## Conventions

- **API routes**: `/api/v1/*` prefix on all services
- **Response shape**: `{ success: boolean, data?: T, error?: { code, message, details } }`
- **Auth**: JWT access token (header) + refresh token (cookie). 6 roles: SUPERADMIN, ADMIN, MANAGER, TECHNICIAN, STAFF, CLIENT
- **Validation**: Zod schemas on route inputs, return 400 VALIDATION_ERROR on failure
- **Error classes**: AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError (from @trottistore/shared)
- **Database**: Prisma with multi-schema PostgreSQL. Generate client with `pnpm db:push` or `pnpm --filter @trottistore/database db:generate`
- **Tests**: Vitest, mock-based integration tests using `app.inject()`. Mock prisma/redis, don't use real DB in unit tests
- **TypeScript**: strict mode, no `any` in route handlers

## Local dev dependencies (docker-compose.dev.yml)

PostgreSQL 16 (5432), Redis 7 (6379), ClickHouse 24.3 (8123), MinIO (9001), Mailpit (1025/8025)

## Multi-agent workflow

Multiple agents (Claude + Codex) work in parallel via git worktrees.

```bash
pnpm agent:status                # Show all worktrees + assigned agents
pnpm agent:conflicts             # Clash conflict matrix between worktrees
pnpm agent:rebase-all --dry-run  # Preview rebase of all worktrees on main
pnpm agent:cleanup --dry-run     # Preview deletion of merged branches
```

## What NOT to do

- Don't modify `packages/database/prisma/schema.prisma` without running `pnpm db:push` after
- Don't add `any` to route handlers — use Zod inference or explicit types
- Don't skip smoke tests — they're the gate before push
- Don't install new dependencies without checking `pnpm audit --audit-level=high`
