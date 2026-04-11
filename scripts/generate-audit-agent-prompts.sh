#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-/tmp/codex-agent-prompts}"
mkdir -p "$OUT_DIR"

write_prompt() {
  local path="$1"
  shift
  cat > "$path" <<EOF
Travaille dans /home/lyes/trottistore.

Lis d'abord:
- docs/codex-tasks/audit-matrix-agents.md
- docs/audits/project-audit-findings-2026-04-11.md

Règles:
- prends uniquement l'agent demandé
- lis seulement les fichiers de son scope
- complète ou corrige la section de cet agent dans le registre central
- mets à jour le Finding Index si tu ajoutes un finding
- garde une sortie courte et défendable
- max 5 findings
- max 5 non-findings
- max 5 angles non vérifiés
- n'audite pas le repo entier

$*
EOF
}

write_prompt "$OUT_DIR/agent-2.txt" \
"Exécute Agent 2 — Stock / Orders / Checkout / SAV.

Lis uniquement:
- services/ecommerce/src/routes/orders
- services/ecommerce/src/routes/checkout
- services/ecommerce/src/routes/stock
- services/sav/src/routes/tickets

Mission:
- auditer stock mutations, reserves, refunds, cancel, races, idempotence
- vérifier atomicité et intégrité métier
- compléter docs/audits/project-audit-findings-2026-04-11.md"

write_prompt "$OUT_DIR/agent-1.txt" \
"Exécute Agent 1 — Security / Auth / RBAC.

Lis uniquement:
- services/*/src/routes
- services/*/src/plugins/auth*
- apps/web/src/lib/api.ts

Mission:
- auditer auth, session, reset password, role checks, ownership, IDOR, public bypass
- compléter docs/audits/project-audit-findings-2026-04-11.md"

write_prompt "$OUT_DIR/agent-4.txt" \
"Exécute Agent 4 — Build / Run / Deploy / Infra.

Lis uniquement:
- package.json racine
- services/*/package.json
- Dockerfiles
- .github/workflows/*
- infra/*
- RELEASE_RUNBOOK.md

Mission:
- auditer build, start, runtime entrypoints, deploy, migrations, seed, env, healthchecks
- compléter docs/audits/project-audit-findings-2026-04-11.md"

write_prompt "$OUT_DIR/agent-5.txt" \
"Exécute Agent 5 — DB / Scripts / Data Integrity.

Lis uniquement:
- packages/database/prisma/*
- scripts/*

Mission:
- auditer schema, constraints, indexes, seed/demo, idempotence, data repair, prod safety
- compléter docs/audits/project-audit-findings-2026-04-11.md"

write_prompt "$OUT_DIR/agent-3.txt" \
"Exécute Agent 3 — CRM / Cron / Newsletter.

Lis uniquement:
- services/crm/src/routes/*
- services/crm/src/index.ts

Mission:
- auditer cron, triggers, newsletter, endpoints publics, anti-enumeration, retries/idempotence
- compléter docs/audits/project-audit-findings-2026-04-11.md"

write_prompt "$OUT_DIR/agent-6.txt" \
"Exécute Agent 6 — Frontend / UX / Accessibility.

Lis uniquement:
- apps/web/src/app
- apps/web/src/components
- apps/web/src/lib

Mission:
- auditer parcours critiques, forms, errors, accessibility, mobile, recovery UX
- compléter docs/audits/project-audit-findings-2026-04-11.md"

write_prompt "$OUT_DIR/agent-7.txt" \
"Exécute Agent 7 — SEO / Performance.

Lis uniquement:
- apps/web
- metadata
- sitemap/robots si présents

Mission:
- auditer SEO, rendering, performance, discoverability, structured data
- compléter docs/audits/project-audit-findings-2026-04-11.md"

write_prompt "$OUT_DIR/agent-8.txt" \
"Exécute Agent 8 — Privacy / Consent / Legal / Trust.

Lis uniquement:
- pages publiques pertinentes
- pages légales
- flows newsletter/contact si visibles dans le code

Mission:
- auditer consent, privacy, claims, trust signals, legal alignment
- compléter docs/audits/project-audit-findings-2026-04-11.md"

write_prompt "$OUT_DIR/agent-9.txt" \
"Exécute Agent 9 — Email / Messaging.

Lis uniquement:
- code notifications/email
- newsletter
- auth emails
- order emails
- contact/messaging flows

Mission:
- auditer deliverability, transactional correctness, fallback behavior, anti-loss of message
- compléter docs/audits/project-audit-findings-2026-04-11.md"

write_prompt "$OUT_DIR/agent-10.txt" \
"Exécute Agent 10 — Reliability / Load / Ops.

Lis uniquement:
- health/metrics/logging
- workflows
- scripts ops
- infra docs utiles

Mission:
- auditer monitoring, backup/restore, runbooks, load/resilience, incident readiness
- compléter docs/audits/project-audit-findings-2026-04-11.md"

write_prompt "$OUT_DIR/agent-11.txt" \
"Exécute Agent 11 — User Testing.

Ne fais pas une review code large.

Mission:
- définir l’audit des parcours critiques avec testeurs représentatifs
- personas: client, guest, admin, technicien, support
- mobile/desktop/iPhone/Android
- task success, confusion, recovery, trust clarity
- compléter docs/audits/project-audit-findings-2026-04-11.md

Format attendu:
- Scope proposé
- Findings probables / hypothèses à valider
- Non-findings
- Angles non vérifiés
- User testing plan
- Actions recommandées"

printf 'Prompts créés dans %s\n' "$OUT_DIR"
ls -1 "$OUT_DIR"
