#!/usr/bin/env bash
#
# railway-set-secrets.sh
#
# One-shot secret injection for TrottiStore on Railway.
#
# WHAT THIS SCRIPT DOES
# ---------------------
# Injects the secrets that could NOT be committed to the repo or set by
# an automated agent, into the 5 application services on Railway
# (@trottistore/web + 4 Fastify services) via the public GraphQL API.
#
# WHAT GETS INJECTED
# ------------------
# Generated locally by this script (never leave your machine):
#   JWT_ACCESS_SECRET   — 64 hex chars via openssl rand
#   JWT_REFRESH_SECRET  — 64 hex chars via openssl rand
#   COOKIE_SECRET       — 64 hex chars via openssl rand
#
# Read from your environment (you set them before running):
#   STRIPE_SECRET_KEY       (sk_test_... or sk_live_...)
#   STRIPE_PUBLISHABLE_KEY  (pk_test_... or pk_live_...)  — only set on web
#   STRIPE_WEBHOOK_SECRET   (whsec_...)
#   BREVO_API_KEY           (xkeysib-... or leave empty to disable email)
#
# REQUIREMENTS
# ------------
# - Railway CLI installed and logged in (railway whoami should work)
# - openssl (for secret generation)
# - curl + node (for GraphQL calls)
# - Project linked: railway link should return "trottistore"
#
# USAGE
# -----
#   1. Export your secrets in the current shell:
#      export STRIPE_SECRET_KEY="sk_test_..."
#      export STRIPE_PUBLISHABLE_KEY="pk_test_..."
#      export STRIPE_WEBHOOK_SECRET="whsec_..."
#      export BREVO_API_KEY="xkeysib-..."    # or: export BREVO_API_KEY=""
#
#   2. Run the script:
#      bash scripts/railway-set-secrets.sh
#
#   3. The script prints a summary of what was set on each service.
#
# SAFETY
# ------
# - Secrets are NEVER printed in plaintext (only length + prefix).
# - Secrets are NEVER logged or persisted outside Railway.
# - The script is idempotent — run it twice and you overwrite with the
#   same values (except JWT/COOKIE which get regenerated — see --keep).
# - Use --keep-jwt to avoid regenerating JWT/cookie secrets on a re-run.
# - Use --dry-run to print what would be set without calling the API.
#
set -euo pipefail

PROJECT_ID="64a2a1d8-a50a-4f24-80dd-bbe5e0ef1b4d"
ENV_ID="541125d2-69cc-4d19-8269-d3e51f61f8c1"
GRAPHQL_ENDPOINT="https://backboard.railway.app/graphql/v2"

# Service IDs (from the diagnostic on 2026-04-10)
SERVICE_WEB="9f3b4a70-5b58-4eff-b2d7-8075c0f3d05f"
SERVICE_ECOMMERCE="44ed5cc5-f053-47a8-a628-16081b0cd147"
SERVICE_CRM="87fa6ed4-a015-43dd-82f5-ee067c2dd070"
SERVICE_SAV="f96ffab5-54ab-4eb2-8f5b-0dda7175dd92"
SERVICE_ANALYTICS="86069e43-9de7-4f24-8b7f-b89cde0041af"

DRY_RUN=false
KEEP_JWT=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --keep-jwt) KEEP_JWT=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# ─── Pre-flight checks ──────────────────────────────────────────────

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is required but not installed." >&2; exit 1; }
}

require_cmd openssl
require_cmd curl
require_cmd node

if [ ! -f "$HOME/.railway/config.json" ]; then
  echo "ERROR: Railway CLI is not logged in. Run: railway login" >&2
  exit 1
fi

TOKEN=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(require("os").homedir()+"/.railway/config.json","utf8")).user.accessToken)')
if [ -z "$TOKEN" ]; then
  echo "ERROR: No Railway access token found in ~/.railway/config.json" >&2
  exit 1
fi

# Check required env vars
missing=()
for v in STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET; do
  if [ -z "${!v:-}" ]; then missing+=("$v"); fi
done
# BREVO_API_KEY is allowed to be empty (disables email)
if [ "${BREVO_API_KEY+set}" != "set" ]; then missing+=("BREVO_API_KEY (set to empty string to disable email)"); fi

if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: missing required env vars:" >&2
  for v in "${missing[@]}"; do echo "  - $v" >&2; done
  echo "" >&2
  echo "Set them before running, e.g.:" >&2
  echo "  export STRIPE_SECRET_KEY='sk_test_...'" >&2
  echo "  export STRIPE_PUBLISHABLE_KEY='pk_test_...'" >&2
  echo "  export STRIPE_WEBHOOK_SECRET='whsec_...'" >&2
  echo "  export BREVO_API_KEY=''  # empty disables email" >&2
  exit 1
fi

# ─── Generate auth secrets ──────────────────────────────────────────

if [ "$KEEP_JWT" = true ]; then
  if [ -z "${JWT_ACCESS_SECRET:-}" ] || [ -z "${JWT_REFRESH_SECRET:-}" ] || [ -z "${COOKIE_SECRET:-}" ]; then
    echo "ERROR: --keep-jwt set but JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / COOKIE_SECRET not in env" >&2
    exit 1
  fi
  echo "Using JWT/cookie secrets from environment (--keep-jwt)"
else
  JWT_ACCESS_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  COOKIE_SECRET=$(openssl rand -hex 32)
  echo "Generated 3 fresh secrets (JWT access/refresh + cookie), 64 hex chars each"
fi

# ─── Helpers ────────────────────────────────────────────────────────

mask() {
  local v="$1"
  if [ -z "$v" ]; then echo "(empty)"; else echo "${v:0:8}... (len ${#v})"; fi
}

graphql_mutation() {
  local service_id="$1"
  local service_name="$2"
  local vars_json="$3"

  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] would set on $service_name:"
    echo "$vars_json" | node -e '
      const v = JSON.parse(require("fs").readFileSync(0,"utf8"));
      for (const k of Object.keys(v)) {
        const val = v[k];
        const masked = val.length > 12 ? val.slice(0,8)+"... (len "+val.length+")" : val;
        console.log("    " + k + " = " + masked);
      }
    '
    return
  fi

  local result
  result=$(curl -sS -X POST "$GRAPHQL_ENDPOINT" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(node -e "
      const vars = $vars_json;
      console.log(JSON.stringify({
        query: 'mutation (\$input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: \$input) }',
        variables: {
          input: {
            projectId: '$PROJECT_ID',
            environmentId: '$ENV_ID',
            serviceId: '$service_id',
            replace: false,
            skipDeploys: true,
            variables: vars
          }
        }
      }));
    ")")

  if echo "$result" | grep -q '"data":{"variableCollectionUpsert":true}'; then
    echo "  ✓ $service_name"
  else
    echo "  ✗ $service_name FAILED"
    echo "    response: $result"
    exit 1
  fi
}

# ─── Plan summary (non-secret-revealing) ────────────────────────────

echo ""
echo "Plan summary:"
echo "  Project: trottistore ($PROJECT_ID)"
echo "  Environment: production"
echo ""
echo "  Auth secrets (generated locally):"
echo "    JWT_ACCESS_SECRET  = $(mask "$JWT_ACCESS_SECRET")"
echo "    JWT_REFRESH_SECRET = $(mask "$JWT_REFRESH_SECRET")"
echo "    COOKIE_SECRET      = $(mask "$COOKIE_SECRET")"
echo ""
echo "  External secrets (from your env):"
echo "    STRIPE_SECRET_KEY      = $(mask "$STRIPE_SECRET_KEY")"
echo "    STRIPE_PUBLISHABLE_KEY = $(mask "$STRIPE_PUBLISHABLE_KEY")"
echo "    STRIPE_WEBHOOK_SECRET  = $(mask "$STRIPE_WEBHOOK_SECRET")"
echo "    BREVO_API_KEY          = $(mask "$BREVO_API_KEY")"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "[dry-run mode — no mutations will be sent]"
else
  echo "About to write to Railway. Press Ctrl+C within 5 seconds to abort..."
  sleep 5
fi
echo ""

# ─── The 4 Fastify services ─────────────────────────────────────────

# All 4 Fastify services need the auth secrets
for pair in "ecommerce:$SERVICE_ECOMMERCE" "crm:$SERVICE_CRM" "sav:$SERVICE_SAV" "analytics:$SERVICE_ANALYTICS"; do
  name="${pair%%:*}"
  sid="${pair##*:}"

  # Base vars common to all Fastify services
  vars_json=$(cat <<EOF
{
  "JWT_ACCESS_SECRET": "$JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET": "$JWT_REFRESH_SECRET",
  "COOKIE_SECRET": "$COOKIE_SECRET"
}
EOF
)

  # ecommerce also needs Stripe
  if [ "$name" = "ecommerce" ]; then
    vars_json=$(cat <<EOF
{
  "JWT_ACCESS_SECRET": "$JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET": "$JWT_REFRESH_SECRET",
  "COOKIE_SECRET": "$COOKIE_SECRET",
  "STRIPE_SECRET_KEY": "$STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET": "$STRIPE_WEBHOOK_SECRET",
  "BREVO_API_KEY": "$BREVO_API_KEY"
}
EOF
)
  fi

  # crm and sav need Brevo for notifications
  if [ "$name" = "crm" ] || [ "$name" = "sav" ]; then
    vars_json=$(cat <<EOF
{
  "JWT_ACCESS_SECRET": "$JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET": "$JWT_REFRESH_SECRET",
  "COOKIE_SECRET": "$COOKIE_SECRET",
  "BREVO_API_KEY": "$BREVO_API_KEY"
}
EOF
)
  fi

  graphql_mutation "$sid" "@trottistore/service-$name" "$vars_json"
done

# ─── The web service ────────────────────────────────────────────────

web_vars=$(cat <<EOF
{
  "JWT_ACCESS_SECRET": "$JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET": "$JWT_REFRESH_SECRET",
  "COOKIE_SECRET": "$COOKIE_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "$STRIPE_PUBLISHABLE_KEY"
}
EOF
)
graphql_mutation "$SERVICE_WEB" "@trottistore/web" "$web_vars"

# ─── Done ───────────────────────────────────────────────────────────

echo ""
if [ "$DRY_RUN" = true ]; then
  echo "Dry run complete. No mutations were sent to Railway."
else
  echo "All secrets injected on the 5 services."
  echo ""
  echo "Next step: tell Claude 'secrets OK' and the repair proceeds with:"
  echo "  - merge claude/fix-web-dockerfile-public to main"
  echo "  - merge codex/fix-stock-race-oversell to main"
  echo "  - railway run pnpm --filter @trottistore/database db:deploy"
  echo "  - redeploy of the 5 services"
  echo "  - /health verification"
fi
