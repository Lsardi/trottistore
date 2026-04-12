#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_USER="${POSTGRES_USER:-trottistore}"
POSTGRES_DB="${POSTGRES_DB:-trottistore}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  BACKUP_FILE="$(ls -1t "${BACKUP_DIR}"/trottistore_*.sql.gz 2>/dev/null | head -1 || true)"
fi

if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found. Pass an explicit file or ensure ${BACKUP_DIR}/trottistore_*.sql.gz exists." >&2
  exit 1
fi

echo "[$(date)] Restoring ${BACKUP_FILE} into ${POSTGRES_DB}..."

gunzip -c "$BACKUP_FILE" | docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

echo "[$(date)] Restore complete."
