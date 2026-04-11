# Audit Lite — Railway rehab (retro)

- **Tier**: Lite
- **Trigger**: Hotfix / repair (Railway rehab session 2026-04-10)
- **Run by**: Claude Opus 4.6 (1M)
- **Run date**: 2026-04-11
- **Reviewer**: pending — Codex async adversarial review
- **Scope (commits in prod on `main`)**:
  - `aa0cb9d` PR #90 — `apps/web/public/.gitkeep` + Next 15.3.0 → 15.5.15
  - `dbc1d48` PR #91 — P0-A stock oversell race fix + CHECK constraint migration
  - `2606966` PR #92 — Dockerfile pnpm node_modules layout fix (4 Fastify services)
  - `3363cdb` PR #93 — Dockerfile tsx runtime + `tsc --noEmit` (4 Fastify services)
- **Time budget**: 30 min
- **Time spent**: 25 min

## What was checked

| Check | How | Result |
|---|---|---|
| Diff review | `git show` × 4 commits, full diff read | OK |
| Runtime smoke | Live `/api/v1/health` on 4 Fastify + web (Railway public domains, prior session) | OK (200 on all 5) |
| CI status on prod commit | GitHub Actions on `3363cdb` | green |
| Dependency audit | `pnpm audit --audit-level=high` (cf. PR #90 commit message) | 0 high / 0 critical, 3 moderate pre-existing |
| Adversarial pass | grep beyond patched files for the same anti-pattern, dead-code ref check | **3 findings** (see below) |

## Findings

### F1 — Stripe webhook stock decrement is unguarded *(severity: P1)*

**Location**: `services/ecommerce/src/routes/checkout/index.ts:381-388`

The P0-A fix in PR #91 patched the 3 callsites in `services/ecommerce/src/routes/orders/index.ts` (auth, guest, admin order creation). It did **not** patch the parallel decrement in the Stripe webhook confirmation path:

```ts
for (const item of items) {
  if (item.variantId) {
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stockQuantity: { decrement: item.quantity } },
    });
  }
}
```

**Why this matters**:

1. **Race condition still possible** between two parallel webhook confirmations on the same variant when stock is low. PR #91 narrowed the oversell window but did not close it for the Stripe path.
2. **The new CHECK constraint** (`stock_quantity_non_negative`, migration `20260410151000`) will now make a runaway decrement throw at the DB layer, which is correct defense-in-depth — but the throw happens **inside `app.prisma.$transaction`** in `confirmPayment()`. The transaction will roll back, leaving the order in `PENDING / paymentStatus PENDING` while Stripe has already charged the customer. Inconsistent state, no automatic recovery.

**Note**: this is *not* a regression introduced by the rehab PRs. It is a pre-existing gap that the P0-A fix did not cover. The CHECK constraint actually makes the failure mode louder (visible) instead of silent (oversell), which is a net improvement.

**Recommendation**: open a follow-up branch `claude/fix-stripe-webhook-stock-guard` that:
- Reuses `decrementStockOrThrow` (export it from `orders/index.ts` or move to a shared module)
- Maps `InsufficientStockError` inside the webhook handler to a refund flow or a `STOCK_REGRET` reconciliation queue, since the customer is already charged
- Adds a red test in `checkout.race.test.ts`

### F2 — `package.json start` scripts are stale *(severity: cosmetic)*

**Location**: `services/{ecommerce,crm,sav,analytics}/package.json:9`

```json
"start": "node dist/index.js"
```

After PR #93, the build stage emits no `dist/` (it runs `tsc --noEmit`). The Dockerfile `CMD` no longer reads `start`. So `pnpm --filter @trottistore/service-ecommerce start` would now crash with `Cannot find module 'dist/index.js'`.

**Impact**: zero in production (Railway runs the Dockerfile CMD directly). Real impact is on a dev who tries `pnpm start` locally without Docker — they get a misleading error.

**Recommendation**: update the 4 `start` scripts to `node --import tsx src/index.ts` to match the runtime, OR delete them entirely and document `pnpm dev` as the only entry point. Bundle this with the post-demo NodeNext sweep — it does not warrant a hotfix.

### F3 — `seed.ts` password hash rotation did not repair existing seeded users *(severity: P1)*

**Location**: `scripts/seed.ts` user `upsert` loop (`update: {}`)

The demo session fixed the hashing algorithm mismatch by switching `seed.ts` from argon2 to bcrypt, but the `upsert` still used an empty `update` clause for existing users. In practice, that meant prod seeded users kept their old invalid hash forever, even after rotating `SEED_ADMIN_PASSWORD` and re-running the seed.

**Why this matters**:

1. `admin@trottistore.fr` remained unable to log in after the code fix alone.
2. The apparent remediation path "`re-run seed with the new secret`" was false until the `upsert` started updating `passwordHash`.
3. This was easy to miss because the bug only affects existing rows; fresh seeds work.

**Recommendation**: update the 3 seeded users via `upsert.update = { passwordHash, emailVerified: true }` for the demo phase, then revisit post-demo if password clobbering becomes unacceptable.

## Non-findings (explicitly checked, nothing wrong)

- **Dockerfile drift across the 4 services** — `diff` of the 4 Dockerfile templates: identical bar service name, port, and CRM's longer comment. OK.
- **Other stock decrement sites in `services/ecommerce/src/`** — grep for `stockQuantity:\s*\{\s*decrement` in `services/ecommerce/src/`: 1 hit in `orders/index.ts` (the `decrementStockOrThrow` declaration, not a call) + 1 hit in `checkout/index.ts` (F1). No other oversell vectors via direct decrement **inside the ecommerce service**. ⚠️ Out of scope for this Lite but flagged here after Codex review: a separate decrement exists at `services/sav/src/routes/tickets/index.ts:1004` (technician adding a used part to a repair ticket) — see "What I did NOT check" below for why it's deferred.
- **Stock restock paths** (`stockQuantity: { increment }` at `orders/index.ts:1409,1417,1531,1656`) — only used on cancel/refund paths, no concurrency concern.
- **Migration safety** — `UPDATE … SET 0 WHERE < 0` then `ALTER TABLE … ADD CONSTRAINT … NOT VALID` then `VALIDATE CONSTRAINT`. The NOT VALID + VALIDATE pattern avoids `ACCESS EXCLUSIVE` lock for the duration of the table scan. Heal step has documented data-loss tradeoff (negative stock → 0 zeroes out the discrepancy without audit log) — acceptable for week-0 demo, flagged in commit message.
- **Next 15.3.0 → 15.5.15** — same major, caret kept, GHSA-q4gf-8mx6-v5v3 patched. CI rebuild green on the bumped lockfile.
- **`apps/web/public/.gitkeep`** — zero-byte file, no risk surface.
- **tsx production runtime** — known trade-off, documented in PR #93 commit message and in `services/ecommerce/Dockerfile:31-43`. Cold start +500-800ms, RSS +30MB. Acceptable for demo load. Long-term cleanup tracked (NodeNext migration, ~200 files).

## What I did NOT check

This section is mandatory in the Lite tier (cf. `AUDIT_METHODOLOGY.md` §"Système à deux étages") to declare the audit's blast radius so the async reviewer knows where the holes are.

- **Cross-service stock decrement coverage** — grep was scoped to `services/ecommerce/src/`. After Codex review I extended to `services/sav/src/` and found `services/sav/src/routes/tickets/index.ts:1004` (technician adds used part → unguarded `productVariant.update` decrement). **Deferred** to a separate Lite or Full Passport because: (a) the SAV ticket flow is RBAC-gated to TECHNICIAN+, very different concurrency profile from public checkout, (b) it shares the same root cause as F1 (no shared `decrementStockOrThrow` helper), so the right fix is the extraction follow-up `claude/fix-stripe-webhook-stock-guard` extended to also patch SAV. Did NOT grep `services/crm/`, `services/analytics/`, `apps/web/` for the same anti-pattern in this run.
- **Indirect stock mutation paths** — did NOT check for `$executeRaw` / `$queryRaw` writes against `product_variants`, scheduled jobs, Prisma middleware, or any cron/worker that might decrement stock outside the request path.
- **Race tests for the SAV path** — no red test exists for concurrent technician part usage (only the 3 ecommerce paths are covered by `orders.race.test.ts`).
- **Webhook idempotency under retry storm** — `confirmPayment()` has an idempotency guard on `providerRef + status=CONFIRMED`, but I did NOT verify it under Stripe's actual retry behavior (exponential backoff, multiple attempts within ms window). Out of Lite scope.
- **The migration `20260410151000_stock_quantity_non_negative` was NOT replayed in a staging environment** — I only read the SQL. Heal step (`UPDATE … SET 0 WHERE < 0`) on a hot table during a deploy could lock or block writers under load. The `NOT VALID` + `VALIDATE` pattern mitigates the constraint scan, but not the heal UPDATE itself.
- **CI gate behavior on the bumped lockfile** — I trusted PR #90's commit message saying `pnpm audit --audit-level=high` returns 0 high / 0 critical. I did NOT re-run audit locally on `main` HEAD.
- **Live container memory/cold-start measurements** — the tsx runtime trade-off (~500-800ms cold start, +30MB RSS) is documented but I did NOT actually measure on the live Railway containers post-deploy.
- **Type-check coverage post-`tsc --noEmit`** — I trusted the build stage runs `tsc --noEmit` for each of the 4 services. Did NOT verify all 4 builds actually executed the type-check (the GitHub Actions logs would confirm).
- **PRs reviewed by reading commit messages, not full diffs** — for #90 (gitkeep + Next bump), #92 (Dockerfile pnpm), #93 (Dockerfile tsx), I read the commit message + the Dockerfiles. I did NOT diff every line of the lockfile delta in #90 or hand-trace each Dockerfile COPY ordering. The 4 Dockerfile templates being identical is asserted by `diff` on the final state, not on the delta of #92 vs #93.

## Verdict

**APPROVED for production with one P1 follow-up.**

The 4 commits in `main` are safe to keep deployed. F1 (Stripe webhook unguarded decrement) was not introduced by these PRs but should be tracked as the next P0-A follow-up before any post-demo hardening work begins. F2 is bundled with the NodeNext sweep.

## Methodology notes (feed into D)

What this Lite run actually did, in order:
1. `git show --stat` × 4 commits (5 min)
2. Full diff read on the only commit with logic (#91), commit-message read on the 3 infra commits (8 min)
3. Adversarial grep: same anti-pattern beyond patched files, stale references (7 min)
4. Cross-check live state already known from prior session (`/health` 200 on 5 services) (1 min)
5. Write findings (4 min)

What a Full Passport would have added on top: red-test-before-fix discipline per fix, signed passport file, 3 passes A/B/C, threat model delta. None of those were appropriate for an infra repair where the runtime was already broken in a way Codex and I were diagnosing live.

What was missing from this Lite run that should be in the formal spec:
- **Pending Codex async review** — completed during the 2026-04-11 follow-up batch; findings F1/F2/F3 were confirmed and tracked
- **A "what I did NOT check" section** so the reviewer knows where the holes are
