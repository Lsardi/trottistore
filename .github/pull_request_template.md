<!--
TrottiStore pull request template.

The checklist below is NOT suggestive. Each unchecked box blocks merge
unless explicitly justified with a "Skip reason: …" inline note. Keys
references:
  - AUDIT_METHODOLOGY.md — how we audit (7 layers)
  - HANDOFF_CODEX.md — how we split work between agents
  - RELEASE_RUNBOOK.md — how we ship
  - docs/GOVERNANCE.md — how we write security specs (RFC 2119)
  - .github/ISSUE_TEMPLATE/security-spec.md — ticket template
-->

## Summary

<!-- 1-3 sentences. What changed and why. -->

## Ticket reference

<!--
Link to the security spec (if sensitive change) or the feature ticket.
Format:
  Refs: #<issue-number>, AUDIT_*.md#<section-id>
-->

Refs:

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] Security fix (P0 / P1 from an audit or spec)
- [ ] New feature (non-breaking)
- [ ] Refactor / technical improvement
- [ ] Infrastructure / CI / Ops
- [ ] Documentation
- [ ] Breaking change (describe migration in the body)

## Security classification

<!-- Check one. Uncheck applies security-spec workflow. -->

- [ ] **Non-sensitive** — changes only cosmetic / docs / non-security paths
- [ ] **Sensitive** — touches auth, payment, stock, RBAC, DB schema, infra, or any path listed in `.github/CODEOWNERS`

If **Sensitive**, the boxes below MUST be checked and the related
`security-spec` issue linked above:

- [ ] Security spec issue exists (`.github/ISSUE_TEMPLATE/security-spec.md`)
- [ ] ASVS v5.0.0 requirement ID cited: `V_._._`
- [ ] OWASP Top 10 2021 category cited: `A0_:2021-…`
- [ ] CWE identifier cited (if bug fix): `CWE-___`
- [ ] STRIDE row added/updated in `THREAT_MODEL.md`
- [ ] Red test committed **before** the fix in a separate commit
- [ ] Adversarial review by a second agent (Claude ↔ Codex) completed

## Acceptance criteria (RFC 2119)

<!--
Copy the MUST/SHOULD lines from the security spec issue or feature ticket
and check them off as you implement. Each MUST is non-negotiable.
-->

- [ ] MUST: …
- [ ] MUST: …
- [ ] SHOULD: …

## Automated gates (all 5 must be ✅ before merge)

### Layer 1 — Types + lint
- [ ] `pnpm tsc --noEmit` ✅
- [ ] `pnpm lint` zero warning ✅
- [ ] No new `as any` in route handlers (or justified below)

### Layer 2 — SAST + DAST + SCA
- [ ] `pnpm audit --audit-level=high` ✅
- [ ] Custom Semgrep rules in `.semgrep/trottistore.yml` pass (when enabled)
- [ ] No secret in diff (gitleaks / manual review)

### Layer 3 — Unit + mutation
- [ ] `pnpm test` ✅
- [ ] `pnpm test:smoke` ✅
- [ ] `pnpm test:project <service>` ✅ (name the services touched)
- [ ] Stryker mutation score unchanged or improved (when enabled)

### Layer 4 — Integration + E2E
- [ ] Integration tests added for new behavior
- [ ] Playwright E2E green for critical funnels (checkout, auth)
- [ ] Docker build OK for modified services

### Layer 5 — Property + fuzz
- [ ] fast-check property test added for any new invariant (stock,
      money, transaction) — or explicit N/A reason below

## Database changes

- [ ] No schema change
- [ ] `pnpm db:push` run locally after `schema.prisma` edit
- [ ] Migration tested on staging dataset
- [ ] Migration is forward-only AND rollback-safe
- [ ] No destructive op (DROP / ALTER TYPE) without data backup
- [ ] Data heal step included if existing rows would violate a new constraint
      (e.g. `UPDATE … SET x = 0 WHERE x < 0;` before `CHECK (x >= 0)`)

## Deployment

- [ ] `.env.example` updated if new env var added
- [ ] Rollback plan identified (see `RELEASE_RUNBOOK.md`)
- [ ] Feature flag defined (if gated rollout)
- [ ] Smoke test updated if new critical path

## Review

- [ ] Self-review of the full diff done
- [ ] CODEOWNERS reviewer approved (for sensitive paths)
- [ ] Manual test on impacted flows
- [ ] Screenshots / before-after for UI changes

---

<!--
Skip reasons: if you uncheck a required box, add a paragraph below
explaining why. The reviewer can still reject the PR if the justification
is weak. Silent skips are not allowed.
-->
