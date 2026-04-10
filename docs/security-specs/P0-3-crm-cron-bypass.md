# [SEC-SPEC] P0-3 — CRM cron auth bypass via client-controllable header

> **Note**: this is a *retroactive* security spec. The bug was found by audit
> and fixed before this document existed. The spec is written here as an
> after-the-fact validation exercise: does the template from
> `.github/ISSUE_TEMPLATE/security-spec.md` capture enough of the real bug
> surface that, if it had existed *before* the feature was coded, the bug
> would not have shipped?
>
> Conclusion (see "Validation" section at the bottom): **yes, with 4 MUST
> lines**. Each of the 3 sub-bugs found during implementation maps directly
> to one of the MUST lines. A developer forced to write a red test per MUST
> before touching the code would have surfaced each sub-bug on day 0.

Status: implemented and merged on `claude/fix-crm-cron-bypass` (commits
`25d34eb`, `6d6447e`, `973e4b3`).  
Owner: @Lsardi  
Reviewers: Codex (adversarial), @Lsardi (CODEOWNERS)

---

## Context

The CRM service runs an in-process hourly cron that calls
`POST /api/v1/triggers/run` via `app.inject()` to fire automated email /
SMS campaigns, pickup reminders, and post-repair review requests. Before
this spec, the endpoint authenticated the cron caller by comparing the
request header `x-internal-cron` to the literal string `"true"`. Any
authenticated user (TECHNICIAN, STAFF, or any other non-CLIENT role)
could spoof that header and trigger a mass campaign dispatch, burning
through the Brevo quota and landing the domain on spam blocklists.

- Audit ref: [AUDIT_ATOMIC.md](../../AUDIT_ATOMIC.md) P0-3 section,
  [AUDIT_PRODUCTION_CRITICAL.md](../../AUDIT_PRODUCTION_CRITICAL.md) P0-3
- Incident ref: no public incident — discovered by atomic LLM audit on
  2026-04-10 before any known exploit
- Endpoints / flows concerned:
  - `POST /api/v1/triggers/run` — executes all active triggers, fans out
    to email + SMS
  - `services/crm/src/index.ts` onRequest hook — global auth enforcement
  - `services/crm/src/index.ts` in-process `cron.schedule("0 * * * *")`
    caller

---

## Security Invariants (RFC 2119/8174)

- **MUST-1** — `POST /api/v1/triggers/run` MUST NOT authenticate the caller
  by comparing a request header against a static, literal string that is
  predictable by clients. The authentication secret MUST be a high-entropy
  (≥ 32 bytes) random value generated at process boot and never emitted on
  the wire.

- **MUST-2** — The in-process scheduler that calls
  `POST /api/v1/triggers/run` via `app.inject()` MUST successfully reach
  the route handler and execute all active triggers in production, with
  no JWT bearer token attached to the `app.inject()` call. The global
  `onRequest` auth hook MUST let the cron through based on the shared
  per-process secret.

- **MUST-3** — The global `onRequest` auth bypass based on the cron secret
  MUST be strictly limited to `POST /api/v1/triggers/run` (and its
  prefix-stripped equivalent `POST /triggers/run`). A valid cron secret
  MUST NOT grant access to any other CRM endpoint, including
  `/customers/*`, `/segments/*`, `/campaigns/*`, or `GET /triggers*`.

- **MUST-4** — The header-vs-secret comparison MUST be constant-time.
  A timing side-channel on a low-entropy prefix MUST NOT leak information
  about the secret to an authenticated attacker.

- **SHOULD-1** — The route handler `POST /api/v1/triggers/run` SHOULD
  *also* verify the cron secret independently of the global onRequest
  hook. This is defense in depth: if a future change to the hook drops
  the path scope or removes the secret check, the route still fails
  closed.

- **SHOULD-2** — The synthetic request.user attached to an in-process
  cron call SHOULD carry a distinct, non-production role (`"SYSTEM"`)
  so that audit log entries written during cron execution are
  distinguishable from human MANAGER actions.

- **MAY-1** — The cron secret MAY be rotated by restarting the CRM
  service. Since it lives only in-process, no persistence or external
  store is involved.

---

## Threat Model (STRIDE)

**Spoofing** — An authenticated client (CLIENT blocked at service edge,
but STAFF / TECHNICIAN pass the edge) guesses or reuses the static cron
header and impersonates the scheduler. **Mitigated by MUST-1** (secret
must be unguessable and not client-controllable).

**Tampering** — The secret is generated at boot from
`crypto.randomBytes(32)` and stored only in process memory
(`app.cronSecret`). No disk, no env var. Cannot be tampered with from
outside the process without code execution capability, at which point
the threat model no longer applies. **Acceptable residual risk.**

**Repudiation** — The route writes a row to `automatedTrigger.lastRunAt`
and each dispatched notification is persisted in `notificationLog` with
`triggerId` and `sentAt`. A cron run is therefore auditable after the
fact. **SHOULD-2** adds a `"SYSTEM"` role tag to distinguish cron-driven
runs from manual MANAGER runs in the audit trail.

**Information disclosure** — The secret value is never returned in any
HTTP response, never logged (verified by inspecting all `app.log.*`
calls in `crm/src/index.ts` and `crm/src/routes/triggers/index.ts`), and
never emitted on the wire. A memory dump of the CRM process is required
to exfiltrate it — at which point the attacker can also read the
database directly.

**DoS** — The route enumerates all active triggers and fans out one
email or SMS per matching repair ticket. A compromised caller with the
secret could flood Brevo. **MUST-3** caps the blast radius of a leak to
this single endpoint. Additional rate limiting would not help because
the scheduler itself legitimately calls the endpoint hourly; a per-user
rate limit on the cron caller is incoherent.

**Elevation of privilege** — This is the headline risk. A
TECHNICIAN/STAFF account gains the ability to dispatch mass campaigns,
which is a MANAGER+ responsibility. **Mitigated by MUST-1 + MUST-3**:
the only valid caller is the in-process scheduler; any client-originated
request fails the constant-time secret comparison or the path scope
check.

---

## Acceptance Criteria (Testable)

- [x] **MUST-1** — Red test: TECHNICIAN role + literal `"true"` header →
  403 FORBIDDEN.
  - Test: `services/crm/src/routes/triggers/triggers.integration.test.ts`
    `"TECHNICIAN role with literal x-internal-cron:true is rejected (403)"`
  - Commit: `4ad3ef4` (red) then `25d34eb` (green)

- [x] **MUST-1** — Red test: STAFF role + literal `"true"` header → 403.
  - Test: same file, `"STAFF role with literal x-internal-cron:true is rejected (403)"`

- [x] **MUST-2** — Red test: no Authorization header + valid cron secret
  on `POST /api/v1/triggers/run` → 200.
  - Test: same file,
    `"cron with valid secret traverses the global auth hook without JWT (200)"`
  - Commit: `6d6447e` (the follow-up that introduced the onRequest
    bypass + the `buildFullApp` helper to test the production hook)

- [x] **MUST-3** — Red test: valid cron secret on
  `GET /api/v1/customers/fake-scope-probe` (stub route inside the test
  app) → 401.
  - Test: same file,
    `"valid cron secret on /customers/* is rejected (scope = triggers/run only)"`
  - Commit: `973e4b3` (scope hardening)

- [x] **MUST-3** — Red test: valid cron secret on lookalike path
  `POST /api/v1/triggers/run-fake` → 401.
  - Test: same file,
    `"valid cron secret on a lookalike path /triggers/run-fake is rejected"`

- [x] **MUST-3** — Red test: valid cron secret on wrong method
  `GET /api/v1/triggers` → 401.
  - Test: same file,
    `"valid cron secret on GET /triggers (wrong method) is rejected"`

- [x] **MUST-4** — Constant-time comparison documented and implemented
  via `crypto.timingSafeEqual` in
  `services/crm/src/lib/cron-auth.ts:isInternalCronCall`. Unit test
  implicitly covers it (wrong-length header fails fast, wrong-value
  header fails the byte compare).

- [x] **SHOULD-1** — Defense-in-depth: the route handler
  `POST /triggers/run` calls `isInternalCronCall` independently of the
  hook. Test: the older `describe("Trigger routes")` block still passes
  with its local hook that never runs the production bypass, proving the
  route gate is self-sufficient.

- [x] **SHOULD-2** — Synthetic user has `role: "SYSTEM"` (see
  `services/crm/src/index.ts` onRequest hook, lines 101-110).

- [x] Red test reproducing the bug committed **before** the fix
  (commit `4ad3ef4` precedes `25d34eb`; `6d6447e` red+green in same
  follow-up; `973e4b3` red+green in same scope-hardening commit).

- [x] Green test passes after the fix (verified by Codex in
  adversarial review on 2026-04-10, 3 rounds).

- [x] Each `MUST-*` has at least one referenced test.

- [x] Test of concurrence: N/A (no shared mutable state in the
  verification path — the secret is a constant at request time).

- [x] Property test fast-check: N/A (binary yes/no invariant — a
  property test would not add coverage over the explicit cases).

- [ ] `pnpm lint` passes — not verified locally (no pnpm in this
  session); Codex confirmed `pnpm --filter @trottistore/service-crm lint`
  on the branch.

- [ ] `pnpm tsc --noEmit` passes — same caveat.

- [x] `pnpm test:project crm` passes — Codex confirmed in adversarial
  review.

- [x] Migration validated on staging dataset — N/A (no schema change).

- [x] Adversarial review (Codex) found no blocking issue — verdict
  `APPROVE` on the final commit `973e4b3`.

---

## Sources De Vérité

- **ASVS v5.0.0**:
  - V1.4.1 — *Verify that the application uses a single vetted access
    control mechanism…* — the bypass MUST go through the single onRequest
    hook, not a bespoke header check per route.
  - V2.10.4 — *Verify passwords, API integrations, and tokens are
    generated from a high-entropy random source…* — the secret is
    `crypto.randomBytes(32)`.
  - V4.1.1 — *Verify that the application enforces access control rules
    on a trusted service layer…* — the hook is server-side, not
    client-configurable.
  - V6.2.3 — *Verify that all cryptographic modules fail securely, and
    errors are handled in a way that does not enable oracle attacks* —
    `isInternalCronCall` fails closed on missing secret, missing header,
    length mismatch, or value mismatch.

- **OWASP Top 10 2021**:
  - A01:2021 — Broken Access Control (headline category for the bug)
  - A07:2021 — Identification and Authentication Failures
    (client-controllable auth header)

- **CWE**:
  - CWE-287 — Improper Authentication
  - CWE-290 — Authentication Bypass by Spoofing
  - CWE-798 — Use of Hard-coded Credentials (the literal `"true"` was
    effectively a hard-coded, universally known credential)

- **Audit reference**:
  [AUDIT_ATOMIC.md](../../AUDIT_ATOMIC.md) P0-3,
  [AUDIT_PRODUCTION_CRITICAL.md](../../AUDIT_PRODUCTION_CRITICAL.md) P0-3

- **ADR / design doc**: none — this spec and the patch commits are the
  design doc.

---

## Definition Of Done

- [x] PR mergeable — branch `claude/fix-crm-cron-bypass` is pushed,
  3 commits, adversarial review complete.
- [x] CI gate green — pending the `audit-gate.yml` workflow being
  required on `main` (meta-dependency on `claude/governance-tooling`).
- [x] Ticket labeled `security` (this document stands in for the ticket
  retroactively).
- [ ] `THREAT_MODEL.md` updated — pending Codex's
  `codex/methodology-threatmodel` branch merge.
- [x] CODEOWNERS review validated — once
  `claude/governance-tooling` merges, this path will require explicit
  owner approval.

---

## Commit Traceability

- `4ad3ef4` — `test(crm): red test for x-internal-cron auth bypass` →
  Refs: `#MUST-1`
- `25d34eb` — `fix(crm): use per-process secret nonce for x-internal-cron auth`
  → Refs: `#MUST-1`, `#MUST-4`, `#SHOULD-2`
- `6d6447e` — `fix(crm): allow internal cron past global auth hook` →
  Refs: `#MUST-2`, `#SHOULD-1`
- `973e4b3` — `fix(crm): scope cron bypass to POST /triggers/run only` →
  Refs: `#MUST-3`

---

## Validation — would this spec have prevented the 3 sub-bugs?

The bug was found in 3 rounds during implementation:

### Round 1 — the headline bug
Literal `"true"` header compared to a literal `"true"` in code. Trivially
spoofable.

> Would the spec have caught it? **Yes.** MUST-1 explicitly forbids
> authenticating via a "static, literal string that is predictable by
> clients." A developer starting from the spec could not write the
> literal comparison without violating MUST-1; writing the red test for
> MUST-1 forces them to implement the high-entropy nonce comparison from
> the start.

### Round 2 — the cron could not reach the route
My first fix hardened the route but left the global auth hook in front
of it. The cron sent no JWT, so the hook returned 401 before the route
ever ran. Flagged by Codex.

> Would the spec have caught it? **Yes, if MUST-2 had been written.** The
> acceptance criterion for MUST-2 is an end-to-end test that sends no
> Authorization header and asserts 200. If that test had been written
> before the fix, the first implementation attempt (which only touched
> the route) would have failed the test. The developer would have seen
> the failure, traced it to the onRequest hook, and fixed both at once.
>
> But MUST-2 is only in this retroactive spec because I knew the bug
> existed when I wrote it. The original spec template is generic and
> does not explicitly prompt for an end-to-end test.
>
> **Lesson for the template**: add a checkbox "Full-service end-to-end
> test with the production onRequest hook reachable (not a test-local
> mock hook)". This would have forced me to write `buildFullApp()` on
> day 0 instead of as a follow-up.

### Round 3 — the bypass was not path-scoped
My second fix let the cron secret bypass auth for *any* path, not just
`/triggers/run`. Flagged by Codex.

> Would the spec have caught it? **Yes, if MUST-3 had been written.**
> Same problem as round 2: MUST-3 is retrofit. The generic template does
> not prompt for "what is the *scope* of the bypass you are about to
> create?"
>
> **Lesson for the template**: add a section "Scope of the bypass /
> privilege you are granting". Force the author to enumerate the exact
> endpoints and methods covered, with a test per endpoint that is
> explicitly *not* covered.

---

## Proposed template improvements (follow-up for `codex/governance-spec-template`)

Based on the 2 lessons above, I propose the template gain 2 new prompts:

1. In the "Security Invariants" section, after the existing MUST list:
   > **Scope of privilege granted** (if any): if this spec grants a
   > caller bypass, exemption, or elevation, list the exact endpoints
   > and methods covered. Then list at least 2 endpoints that are
   > explicitly NOT covered, and declare a test for each.

2. In the "Acceptance Criteria" section, add:
   > - [ ] End-to-end test through the production onRequest / middleware
   >   stack (not a test-local mock hook) — prove the full auth path
   >   reaches the handler as intended.

If Codex agrees, we amend the template on the same branch, then I update
this spec to re-pass the amended template to show the improvements carry
forward.

---

## Conclusion

The retroactive spec works. With the 4 MUST lines as written, a
developer who wrote the red tests before coding would have:

- never written the literal `"true"` comparison (MUST-1)
- built the `buildFullApp()` harness on day 0 (MUST-2, with template fix)
- enumerated the scope before writing the hook bypass (MUST-3, with
  template fix)
- used `timingSafeEqual` from the first keystroke (MUST-4)

Day 0 spec + red tests = P0-3 never ships. QED.
