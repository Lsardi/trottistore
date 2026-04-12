#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_USER="${POSTGRES_USER:-trottistore}"
POSTGRES_DB="${POSTGRES_DB:-trottistore}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
VERIFY_DB="trottistore_restore_verify_$(date +%s)"

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  BACKUP_FILE="$(ls -1t "${BACKUP_DIR}"/trottistore_*.sql.gz 2>/dev/null | head -1 || true)"
fi

if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found. Pass an explicit file or ensure ${BACKUP_DIR}/trottistore_*.sql.gz exists." >&2
  exit 1
fi

echo "[$(date)] Verifying restore with ${BACKUP_FILE} into temp DB ${VERIFY_DB}"

cleanup() {
  docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d postgres \
    -c "DROP DATABASE IF EXISTS ${VERIFY_DB};" >/dev/null
}
trap cleanup EXIT

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d postgres \
  -c "CREATE DATABASE ${VERIFY_DB};" >/dev/null

gunzip -c "$BACKUP_FILE" | docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${VERIFY_DB}" >/dev/null

TABLE_COUNT="$(docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -tA -U "${POSTGRES_USER}" -d "${VERIFY_DB}" \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('shared','ecommerce','crm','sav','analytics');" | tr -d '[:space:]')"

if [[ -z "${TABLE_COUNT}" || "${TABLE_COUNT}" -lt 10 ]]; then
  echo "Restore verification failed: suspicious table count (${TABLE_COUNT:-empty})." >&2
  exit 1
fi

echo "[$(date)] Restore verification OK (${TABLE_COUNT} tables across service schemas)."
