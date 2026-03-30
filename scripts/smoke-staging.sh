#!/bin/bash
#
# Smoke test staging — validates all services are up and responding
# Usage: bash scripts/smoke-staging.sh [BASE_URL]
#
# Default: http://localhost (for local testing)
# Staging: bash scripts/smoke-staging.sh https://staging.trottistore.fr
#

set -euo pipefail

BASE=${1:-"http://localhost"}
ECOMMERCE=${STAGING_ECOMMERCE_URL:-"$BASE:3001"}
CRM=${STAGING_CRM_URL:-"$BASE:3002"}
ANALYTICS=${STAGING_ANALYTICS_URL:-"$BASE:3003"}
SAV=${STAGING_SAV_URL:-"$BASE:3004"}
WEB=${STAGING_WEB_URL:-"$BASE:3000"}

PASS=0
FAIL=0
TOTAL=0

check() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local method="${4:-GET}"
  local body="${5:-}"

  TOTAL=$((TOTAL + 1))

  if [ -n "$body" ]; then
    STATUS=$(curl -s -o /tmp/smoke_body -w "%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$url" 2>/dev/null || echo "000")
  else
    STATUS=$(curl -s -o /tmp/smoke_body -w "%{http_code}" -X "$method" "$url" 2>/dev/null || echo "000")
  fi

  BODY=$(cat /tmp/smoke_body 2>/dev/null || echo "")

  if [ "$STATUS" = "$expected_status" ]; then
    echo "  ✓ $name — HTTP $STATUS"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — HTTP $STATUS (expected $expected_status)"
    [ -n "$BODY" ] && echo "    Response: ${BODY:0:200}"
    FAIL=$((FAIL + 1))
  fi
}

check_contains() {
  local name="$1"
  local url="$2"
  local expected_text="$3"

  TOTAL=$((TOTAL + 1))

  BODY=$(curl -s "$url" 2>/dev/null || echo "")
  STATUS=$?

  if echo "$BODY" | grep -q "$expected_text"; then
    echo "  ✓ $name — contains '$expected_text'"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — missing '$expected_text'"
    echo "    Response: ${BODY:0:200}"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "═══════════════════════════════════════════════"
echo " TrottiStore Staging Smoke Test"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════"
echo ""

# ── 1. Healthchecks (liveness) ──────────────────
echo "1. Healthchecks (liveness)"
check "Ecommerce /health" "$ECOMMERCE/health"
check "CRM /health" "$CRM/health"
check "SAV /health" "$SAV/health"
check "Analytics /health" "$ANALYTICS/health"
echo ""

# ── 2. Readiness (DB + Redis) ───────────────────
echo "2. Readiness (dependencies)"
check_contains "Ecommerce /ready" "$ECOMMERCE/ready" '"ready"'
check_contains "CRM /ready" "$CRM/ready" '"ready"'
check_contains "SAV /ready" "$SAV/ready" '"ready"'
check_contains "Analytics /ready" "$ANALYTICS/ready" '"ready"'
echo ""

# ── 3. Web (Next.js) ───────────────────────────
echo "3. Web (Next.js)"
check "Homepage" "$WEB/" "200"
check "Admin" "$WEB/admin" "200"
check "Produits" "$WEB/produits" "200"
check "Urgence" "$WEB/urgence" "200"
echo ""

# ── 4. API Ecommerce ───────────────────────────
echo "4. Ecommerce API"
check "GET /products" "$ECOMMERCE/api/v1/products" "200"
check "GET /categories" "$ECOMMERCE/api/v1/categories" "200"
check "GET /products/featured" "$ECOMMERCE/api/v1/products/featured" "200"
echo ""

# ── 5. API SAV ─────────────────────────────────
echo "5. SAV API"
check "POST /repairs (guest)" "$SAV/api/v1/repairs" "201" "POST" \
  '{"customerName":"Smoke Test","customerPhone":"0600000000","productModel":"Test Model","type":"REPARATION","issueDescription":"Smoke test ticket"}'
echo ""

# ── 6. API CRM ─────────────────────────────────
echo "6. CRM API"
check "GET /customers (needs auth)" "$CRM/api/v1/customers" "401"
echo ""

# ── 7. API Analytics ───────────────────────────
echo "7. Analytics API"
check "GET /analytics/realtime (needs auth)" "$ANALYTICS/api/v1/analytics/realtime" "401"
echo ""

# ── 8. Stock API ───────────────────────────────
echo "8. Stock API"
check "GET /stock/alerts (needs auth)" "$ECOMMERCE/api/v1/stock/alerts" "401"
echo ""

# ── 9. Rewrites (via web proxy) ────────────────
echo "9. Rewrites (web → backend)"
check "Web → products" "$WEB/api/v1/products" "200"
check "Web → categories" "$WEB/api/v1/categories" "200"
echo ""

# ── Summary ────────────────────────────────────
echo "═══════════════════════════════════════════════"
echo " Results: $PASS passed / $FAIL failed / $TOTAL total"
echo "═══════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "❌ STAGING NOT READY — $FAIL checks failed"
  exit 1
else
  echo "✅ STAGING READY — all $TOTAL checks passed"
  exit 0
fi
