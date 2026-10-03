#!/bin/bash
set -euo pipefail

echo "=== TrottiStore Production Deployment ==="

# Pre-flight checks
if [ ! -f .env ]; then
  echo "ERROR: .env file missing. Copy .env.example and configure."
  exit 1
fi

echo "[1/5] Pulling latest code..."
git pull origin main

echo "[2/5] Building containers..."
docker compose -f docker-compose.prod.yml build

echo "[3/5] Running database migrations..."
# The Prisma schema lives in packages/database, not in the service directory.
docker compose -f docker-compose.prod.yml run --rm ecommerce \
  pnpm --filter @trottistore/database exec prisma migrate deploy --schema prisma/schema.prisma

echo "[4/5] Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo "[5/5] Verifying health..."
# Backend ports are not published on the host; probe from inside the compose
# network and wait for readiness with a bounded timeout. Any service still
# unhealthy after the deadline fails the deploy.
declare -A SERVICE_PORTS=( [ecommerce]=3001 [crm]=3002 [analytics]=3003 [sav]=3004 )
deadline=$((SECONDS + 120))
failed=0
for service in ecommerce crm analytics sav; do
  port=${SERVICE_PORTS[$service]}
  until docker compose -f docker-compose.prod.yml exec -T "$service" wget -qO- "http://localhost:${port}/health" >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      echo "  $service (:$port): FAILED (no healthy response within 120s)"
      failed=1
      break 2
    fi
    sleep 3
  done
  echo "  $service (:$port): OK"
done
if (( failed )); then
  echo "=== Deployment FAILED — services unhealthy. Logs: docker compose -f docker-compose.prod.yml logs ==="
  exit 1
fi

echo ""
echo "=== Deployment complete ==="
echo "Run 'docker compose -f docker-compose.prod.yml logs -f' to monitor"
