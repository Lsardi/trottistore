# Governance — Security specs, reviews, and merge gates

> How we translate audit findings and security requirements into
> **contractual, testable, enforceable** work items.  
> This document is the operating manual for the `.github/ISSUE_TEMPLATE/security-spec.md`
> ticket template and the CODEOWNERS + branch protection rules.

Date de dernière mise à jour: 2026-04-10  
Owners: @Lsardi  
Références: NIST SSDF v1.1, OWASP ASVS v5.0.0, RFC 2119/8174, Google SRE
Postmortem Culture, GitHub Branch Protection docs.

---

## 1. Why

Les 4 P0 récents (stock race, decimal math, x-internal-cron bypass,
customer merge transaction split) avaient un point commun : **aucun
ticket original n'énonçait d'invariant contractuel**. On a livré des
features, pas des contrats. Le code s'est conformé à l'intention
implicite de l'auteur — et l'intention a manqué des angles.

Cette gouvernance existe pour :

1. **Forcer l'explicitation** des invariants de sécurité (RFC 2119 MUST/SHOULD/MAY)
2. **Rendre chaque MUST testable** avant d'écrire une ligne de code
3. **Bloquer techniquement** le merge si un MUST n'a pas de test
4. **Tracer chaque décision** à une source de vérité versionnée (ASVS, OWASP Top 10, CWE)

Si ce process semble lourd, c'est parce qu'**il l'est**. C'est le prix
d'un système qui prend de l'argent, stocke de la donnée client, et
orchestre un SAV. "Moon-rocket grade" n'est pas une métaphore décorative.

Sources :

- [NIST SP 800-218 SSDF v1.1 (final)](https://csrc.nist.gov/pubs/sp/800/218/final) — PO.1, PW.1
- [NIST SP 800-218 Rev 1 (draft, déc. 2025)](https://csrc.nist.gov/pubs/sp/800/218/r1/ipd)
- [OWASP ASVS v5.0.0 (30 mai 2025)](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Requirements in Practice](https://devguide.owasp.org/en/03-requirements/01-requirements/)
- [Google SRE Postmortem Culture](https://sre.google/workbook/postmortem-culture/)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [RFC 2119 — Key words for requirement levels](https://www.rfc-editor.org/rfc/rfc2119)
- [RFC 8174 — Ambiguity of uppercase vs lowercase in RFC 2119 key words](https://www.rfc-editor.org/rfc/rfc8174)

---

## 2. What counts as "sensitive"

Le `.github/CODEOWNERS` est la source de vérité. Toute PR qui touche un
path listé dans CODEOWNERS est **sensitive** et déclenche le workflow
security spec.

Résumé des zones sensibles :

| Zone | Raison |
|---|---|
| `services/*/src/plugins/auth.ts` | JWT verification, CLIENT lockout |
| `services/ecommerce/src/routes/auth/` | login, register, reset password |
| `services/ecommerce/src/routes/admin/`, `admin-users/` | RBAC escalation surface |
| `services/ecommerce/src/routes/checkout/` | Stripe webhook, PaymentIntent |
| `services/ecommerce/src/routes/orders/` | stock invariants, money math |
| `services/ecommerce/src/routes/cart/`, `stock/` | inventory consistency |
| `services/ecommerce/src/lib/cart-totals.ts` | Decimal money computation |
| `services/crm/src/routes/triggers/`, `customers/` | mass messaging, account merge |
| `services/sav/src/routes/tickets/` | repair state transitions, IDOR surface |
| `packages/database/prisma/schema.prisma` + migrations | data model, irreversible |
| `packages/shared/src/` | RBAC roles, error classes, JWT types |
| `apps/web/src/lib/api.ts` + middleware | token storage, auth wrapper |
| `.github/workflows/`, `infra/` | CI/CD, deployment |

Si tu hésites : c'est sensitive. Pose-toi la question "un bug ici
peut-il coûter de l'argent, fuiter des données, ou bloquer le service ?"
Si la réponse n'est pas un "non" franc, c'est sensitive.

---

## 3. The security spec workflow

```
┌────────────────────────────────────────────────────────────────┐
│ 1. OPEN — create security spec issue                           │
│    → use .github/ISSUE_TEMPLATE/security-spec.md               │
│    → fill Context, Invariants (RFC 2119), STRIDE, AC, Sources  │
│    → assign an owner (human) who validates the spec            │
│                                                                │
│ 2. VALIDATE — owner reviews the spec BEFORE any code exists    │
│    → every MUST must be unambiguous and testable               │
│    → every MUST must map to at least one future test           │
│    → owner marks the issue "spec-approved" label               │
│                                                                │
│ 3. WORKTREE — agent creates an isolated worktree                │
│    → pnpm agent:init <agent> <topic> origin/main               │
│    → first commit: wip(coord) with the plan                    │
│                                                                │
│ 4. RED — commit a failing test that encodes a MUST              │
│    → commit message: test(scope): red test for <spec-id>#must-N│
│    → this commit MUST fail CI (that's the point)               │
│                                                                │
│ 5. GREEN — commit the minimal fix                               │
│    → commit message: fix(scope): <spec-id> <title>             │
│    → references "Refs: #<issue>#must-N"                        │
│    → the red test must now pass                                │
│                                                                │
│ 6. REPEAT — one red+green pair per MUST                         │
│                                                                │
│ 7. PR — open pull request                                       │
│    → use the PR template, check every box                      │
│    → link the security spec issue                              │
│    → CI gate must be green (5 automated layers)                │
│                                                                │
│ 8. ADVERSARIAL REVIEW — by a second agent                       │
│    → reviewer tries to DISPROVE each fix                       │
│    → finds 3 reasons it doesn't work, or blesses it            │
│                                                                │
│ 9. CODEOWNERS APPROVAL — owner of the touched path              │
│    → required by branch protection, cannot be bypassed         │
│                                                                │
│ 10. MERGE — via GitHub UI, squash or merge commit               │
│     → post-merge hook runs smoke tests against staging         │
│                                                                │
│ 11. POSTMORTEM (if applicable) — for any P0 fix                 │
│     → entry in POSTMORTEMS.md                                  │
│     → blameless, time-boxed, actionable items tracked          │
└────────────────────────────────────────────────────────────────┘
```

Aucune étape n'est optionnelle pour une sensitive PR. Les 11 étapes
sont enforce-ables :

- Steps 1, 2 : via label check in CI
- Step 4 : via commit message lint (look for "red test" in git log)
- Step 7 : via required CI checks
- Step 8 : via adversarial review label
- Step 9 : via CODEOWNERS + branch protection
- Step 10 : via branch protection (block direct push to main)
- Step 11 : via a manual gate on P0 labels

Voir `.github/workflows/audit-gate.yml` pour les gates automatisées.

---

## 4. RFC 2119 — how to write a MUST

Le template security-spec exige des lignes MUST/SHOULD/MAY. Voici
comment les écrire pour qu'elles soient **testables**.

### Bad (ambiguous, not testable)

```
- MUST be secure
- MUST handle errors properly
- MUST prevent SQL injection
- SHOULD be fast
```

Ces phrases ne permettent pas d'écrire un test. "Secure" comment ?
"Properly" selon quel standard ?

### Good (specific, testable, bounded)

```
- MUST reject POST /checkout/payment-intent if the caller is not
  authenticated AND the orderId is not bound to the caller's
  x-session-id via Redis key `checkout:guest-order:<orderId>`.
  ASVS V4.1.5, CWE-639.
  Test: `checkout.integration.test.ts::rejects guest request with
  spoofed orderId`.

- MUST compute PaymentIntent.amount server-side from `Product.priceHt`
  and `ProductVariant.priceOverride` using `new Decimal(...)` — never
  from the client payload and never via JavaScript float math.
  ASVS V11.1, CWE-840.
  Test: `cart-totals.test.ts::property: totals cent-exact vs integer oracle`.

- MUST NOT decrement `ProductVariant.stockQuantity` outside a
  `prisma.$transaction` that re-checks `stockQuantity >= quantity`
  inside the same transaction. Concurrent orders MUST NOT produce
  negative `stockQuantity` under any load.
  ASVS V11.1.1, CWE-362.
  Test: `orders.race.test.ts::stock=1 + 100 concurrent POST /orders`.

- SHOULD return HTTP 409 with `error.code = "INSUFFICIENT_STOCK"` when
  stock is insufficient, rather than 500 or silent failure.
  Test: `orders.integration.test.ts::returns 409 when stock exhausted`.
```

Règles :

1. **Specific action**: "reject", "return", "compute from", "decrement only inside"
2. **Specific condition**: "if X", "unless Y", "whenever Z"
3. **Specific target**: file + line OR endpoint + field
4. **Measurable outcome**: HTTP code, field equality, absence of state
5. **Reference**: ASVS ID, CWE, OWASP category
6. **Test name**: the file + describe/it that proves the invariant

Si tu ne peux pas nommer le test qui prouverait le MUST, c'est que
le MUST n'est pas encore assez précis.

### MUST NOT vs SHOULD NOT

- `MUST NOT` = violation = CVE, money loss, data leak. CI gate fails.
- `SHOULD NOT` = smell, performance, maintainability. CI warns, doesn't block.
- `MAY` = optional nice-to-have. No test required.

---

## 5. Mapping ASVS v5.0.0 to TrottiStore

Voici les chapitres ASVS les plus pertinents et les endpoints/modules
où ils s'appliquent. Utiliser comme index pour remplir le champ
"ASVS requirement ID" dans les specs.

| ASVS chapter | Sujet | Paths TrottiStore |
|---|---|---|
| V1 — Architecture, Design and Threat Modeling | secure-by-default, fail-closed | `services/*/src/index.ts`, `AUDIT_METHODOLOGY.md` |
| V2 — Authentication | password, session, MFA | `services/ecommerce/src/routes/auth/` |
| V3 — Session Management | tokens, cookies, logout | `services/ecommerce/src/plugins/auth.ts`, `apps/web/src/lib/api.ts` |
| V4 — Access Control | RBAC, IDOR | `services/*/src/routes/admin/`, all `/:id` routes |
| V5 — Validation, Sanitization, Encoding | Zod, sanitize-html | all `routes/**/index.ts`, `apps/web/src/lib/sanitize.ts` |
| V6 — Stored Cryptography | password hashing, secret at rest | `services/ecommerce/src/routes/auth/` (argon2/bcrypt), env vars |
| V7 — Error Handling and Logging | no stack trace leak, audit log | `services/*/src/index.ts` error handler |
| V8 — Data Protection | PII, privacy, retention | `packages/database/prisma/schema.prisma`, RGPD endpoints |
| V9 — Communications | HTTPS, HSTS | `infra/Caddyfile`, `services/*/src/index.ts` (helmet) |
| V10 — Malicious Code | SCA, supply chain | `pnpm audit`, Snyk, Socket |
| V11 — Business Logic | stock, payment, transactions | `services/ecommerce/src/routes/orders/`, `checkout/`, `cart/` |
| V12 — File and Resources | upload, path traversal | `apps/web/src/app/(shop)/produits/*` if uploads |
| V13 — API and Web Service | REST contract, CORS, rate-limit | all `routes/*`, `services/*/src/index.ts` |
| V14 — Configuration | hardening, secrets management | env validation, `.env.example`, infra |

Quand on cite `V11.1.1` dans une spec, c'est "Business Logic — 11.1
Business Logic Security — 11.1.1 Verify the application will only
process business logic flows for the same user in sequential step
order…". Lire l'ASVS pour la formulation exacte.

---

## 6. Adversarial review protocol

Partie centrale du process. Emprunte au Google SRE "blameless
postmortem" et à l'approche devil's advocate.

**Règle**: avant qu'un fix P0 soit mergé, un agent OTHER que l'auteur
(Claude ↔ Codex) lit le diff et répond en moins de 15 min à la
question : "Donne-moi 3 raisons concrètes pour lesquelles ce fix ne
marche pas."

Le reviewer a le droit de :

- Dire "APPROVE — je n'ai trouvé aucune raison" → le fix peut merger
- Dire "APPROVE with follow-ups" → le fix peut merger mais ouvre N
  tickets follow-up
- Dire "REJECT — raison principale + 2 secondaires" → le fix ne peut
  pas merger jusqu'à ce que les raisons soient traitées

Le reviewer doit citer du code (file:line) pour chaque raison. Pas de
raisonnement vague type "c'est fragile". Si une raison ne tient pas,
l'auteur peut la réfuter (et si le reviewer agree, la raison est
retirée).

**Exemple concret** (adversarial review de P0-A par Claude le 2026-04-10) :

> Fix P0-A : APPROVE avec 2 follow-ups
> - A1: Migration peut fail en prod si stock_quantity < 0 existe déjà.
>   Fix: heal les données avant le constraint.
> - A2: stockReserved a sa propre race non couverte, ouvrir ticket P1.
> - A3: Tests mockent séquentiellement, property test avec vraie DB
>   recommandé en Tier 2.
> Verdict: APPROVE — aucun de ces points n'est un blocker immédiat,
> A1 est à inclure dans la PR si deploy < 24h.

---

## 7. What happens when a P0 ships

Pour chaque P0 résolu, créer une entrée dans `POSTMORTEMS.md` (format
Google SRE) dans les 48h suivant le merge. Minimum :

```md
## <YYYY-MM-DD> — <one-line title>

### Impact
<qui a été affecté, pendant combien de temps, combien $ perdu, combien
de données corrompues>

### Root cause
<la cause racine technique, pas "une erreur humaine">

### Trigger
<ce qui a déclenché la détection — alerting, audit, user report>

### Resolution
<ce qui a fixé — commit SHA, deploy ID>

### Timeline (UTC)
- T0 YYYY-MM-DD HH:MM — event
- T1 YYYY-MM-DD HH:MM — event

### What went well
-

### What went wrong
-

### Where we got lucky
-

### Action items
| # | Owner | Priority | Ticket | Description |
|---|---|---|---|---|
| 1 | @x | P0 | #123 | <action mesurable> |

### Lessons
<1-3 phrases qui doivent remonter dans AUDIT_METHODOLOGY.md ou la
security spec template si elles sont généralisables>
```

Le postmortem est **blameless** : aucune mention nominative de qui a
introduit le bug. Focus sur le système qui a laissé passer le bug.

---

## 8. When governance itself changes

Tout changement à :

- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `.github/workflows/audit-gate.yml`
- `docs/GOVERNANCE.md` (ce fichier)
- `AUDIT_METHODOLOGY.md`
- `.github/ISSUE_TEMPLATE/security-spec.md`

…doit passer par son propre security spec (meta-spec) et être reviewé
par l'owner principal. On n'assouplit pas le process à chaud.

Si une règle bloque un hotfix urgent, ouvrir d'abord une "emergency
override" issue qui explique pourquoi le process est suspendu, puis
rétablir le process dans les 24h.

---

## 9. Escape hatches

Certaines situations justifient de court-circuiter le process :

| Situation | Escape hatch | Contrainte |
|---|---|---|
| Security incident en cours (data leak, account takeover) | Direct push sur main avec admin override | Postmortem obligatoire sous 24h |
| Panne CI qui bloque tous les merges | Bypass temporaire de required checks | PR suivante doit restaurer la gate |
| Dépendance critique en 0-day | Hotfix en dehors du spec workflow | Spec écrite a posteriori |

Chaque escape hatch est tracé dans un fichier `ESCAPE_HATCHES.log`
qui est revu trimestriellement. S'il y en a > 2 par trimestre, le
process est mal calibré et doit être ajusté.

---

## 10. TL;DR

1. Si la PR touche un path CODEOWNERS → security spec issue obligatoire
2. Écrire les MUST en RFC 2119, testables, référencés ASVS/CWE
3. Red test avant le fix, commit séparé
4. Fix minimal, référence la spec dans le commit
5. Adversarial review par l'autre agent
6. CODEOWNERS approval
7. CI gate verte (5 layers)
8. Merge via GitHub UI
9. Postmortem si P0

Chaque étape est enforce-able. Aucune n'est optionnelle. Pas d'exception sans trace.
