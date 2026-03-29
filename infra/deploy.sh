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
docker compose -f docker-compose.prod.yml run --rm ecommerce npx prisma migrate deploy

echo "[4/5] Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo "[5/5] Verifying health..."
sleep 10
for service in ecommerce crm analytics sav; do
  port=$(docker compose -f docker-compose.prod.yml port $service 3001 2>/dev/null | cut -d: -f2 || echo "?")
  echo "  $service: $(curl -sf http://localhost:${port}/health 2>/dev/null && echo 'OK' || echo 'PENDING')"
done

echo ""
echo "=== Deployment complete ==="
echo "Run 'docker compose -f docker-compose.prod.yml logs -f' to monitor"
